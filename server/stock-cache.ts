// CACHE DE STOCK — cada extracción de stock desde inventarios365 queda REGISTRADA
// en la BD local (regla del proyecto: todo dato extraído de 365 se persiste).
// Beneficios:
//   1. AGILIDAD: si el snapshot es reciente (TTL), el asistente responde del cache
//      sin esperar a 365 (y sin gastar su rate limit).
//   2. RESILIENCIA: si 365 falla o está lento, se responde del último snapshot
//      indicando la antigüedad — el agente nunca queda mudo.
//   3. Operaciones sensibles (conteo de inventario, verificación de reintento,
//      proponer ajustes de stock) SIEMPRE van en vivo (ttlSeg=0, sin fallback):
//      nunca se decide un cambio de stock con datos viejos.
// Diseño: un snapshot JSON por almacén (una escritura por extracción, una lectura
// por fallback) — simple, sin miles de upserts fila a fila.
import { getDb } from "./db";
import { sql } from "drizzle-orm";

const filas = (r: any) => { const x = Array.isArray(r) ? r[0] : r?.rows ?? r; return Array.isArray(x) ? x : []; };

let tablaLista = false;
async function asegurarTabla(db: any) {
  if (tablaLista) return;
  try {
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS stock_snapshot (
      almacenId INT PRIMARY KEY,
      datos MEDIUMTEXT NOT NULL,
      actualizadoEn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`));
  } catch { /* existe */ }
  tablaLista = true;
}

export type ResultadoStock = {
  lista: any[];
  desdeCache: boolean;
  antiguedadSeg?: number; // solo si desdeCache
};

/**
 * Obtiene el stock de un almacén, registrando SIEMPRE la extracción en la BD.
 * - ttlSeg > 0: si el snapshot local tiene menos de esa edad, se usa directo
 *   (rápido, sin tocar 365). ttlSeg = 0 fuerza ir en vivo.
 * - fallbackCache: si 365 falla, responder del último snapshot (con antigüedad).
 * - idProveedor: si se filtra por proveedor, SIEMPRE va en vivo y no se cachea
 *   (el snapshot es solo del almacén completo, para no mezclar subconjuntos).
 */
export async function obtenerStockAlmacen(
  almacenId: number,
  opts?: { idProveedor?: string; ttlSeg?: number; fallbackCache?: boolean }
): Promise<ResultadoStock> {
  const idProveedor = opts?.idProveedor || "";
  const ttlSeg = opts?.ttlSeg ?? 180;
  const fallbackCache = opts?.fallbackCache ?? true;
  const db = await getDb();
  const esCompleto = idProveedor === "";

  // 1. Cache fresco (solo consultas del almacén completo)
  if (db && esCompleto && ttlSeg > 0) {
    try {
      await asegurarTabla(db);
      const r = filas(await db.execute(sql`
        SELECT datos, TIMESTAMPDIFF(SECOND, actualizadoEn, NOW()) AS edad
        FROM stock_snapshot WHERE almacenId = ${almacenId} LIMIT 1
      `));
      if (r.length > 0 && Number(r[0].edad) <= ttlSeg) {
        const lista = JSON.parse(r[0].datos);
        if (Array.isArray(lista) && lista.length > 0) return { lista, desdeCache: true, antiguedadSeg: Number(r[0].edad) };
      }
    } catch { /* seguir a la red */ }
  }

  // 2. En vivo desde 365 — y REGISTRAR la extracción
  try {
    const { inventarios365 } = await import("./inventarios365");
    const lista = await inventarios365.listarParaInventario(almacenId, idProveedor);
    if (db && esCompleto && Array.isArray(lista) && lista.length > 0) {
      try {
        await asegurarTabla(db);
        const datos = JSON.stringify(lista);
        await db.execute(sql`
          INSERT INTO stock_snapshot (almacenId, datos) VALUES (${almacenId}, ${datos})
          ON DUPLICATE KEY UPDATE datos = ${datos}, actualizadoEn = CURRENT_TIMESTAMP
        `);
      } catch { /* el registro no bloquea la respuesta */ }
    }
    return { lista, desdeCache: false };
  } catch (e) {
    // 3. Fallback: último snapshot conocido, con su antigüedad declarada
    if (db && esCompleto && fallbackCache) {
      try {
        await asegurarTabla(db);
        const r = filas(await db.execute(sql`
          SELECT datos, TIMESTAMPDIFF(SECOND, actualizadoEn, NOW()) AS edad
          FROM stock_snapshot WHERE almacenId = ${almacenId} LIMIT 1
        `));
        if (r.length > 0) {
          const lista = JSON.parse(r[0].datos);
          if (Array.isArray(lista) && lista.length > 0) return { lista, desdeCache: true, antiguedadSeg: Number(r[0].edad) };
        }
      } catch { /* sin fallback */ }
    }
    throw e;
  }
}

export function textoAntiguedad(seg?: number): string {
  if (seg == null) return "";
  if (seg < 90) return "hace menos de 2 min";
  if (seg < 3600) return `hace ${Math.round(seg / 60)} min`;
  return `hace ${Math.round(seg / 3600)} h`;
}
