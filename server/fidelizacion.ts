// Fidelización de clientes crónicos.
//
// Detecta clientes que compran el MISMO medicamento en intervalos regulares
// (tratamientos crónicos: hipertensión, diabetes, tiroides, etc.) y predice
// cuándo se les acaba, para recordarles por WhatsApp antes de que se vayan a
// la competencia.
//
// Solo considera clientes IDENTIFICADOS y con TELÉFONO (los contactables); eso
// descarta automáticamente las ventas a "consumidor final" sin datos.

import { getDb } from "./db";
import { sql } from "drizzle-orm";

const rows = (r: any): any[] => {
  const x = Array.isArray(r) ? r[0] : r?.rows ?? r;
  return Array.isArray(x) ? x : [];
};
const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };

export type ClienteRecordatorio = {
  idCliente: number;
  nombre: string;
  telefono: string;
  telefonoWhatsapp: string | null; // normalizado para wa.me (591XXXXXXXX) o null si no es válido
  producto: string;
  veces: number;              // cuántas veces compró este producto
  ultimaCompra: string;       // YYYY-MM-DD
  diasDesdeUltima: number;
  intervaloDias: number;      // cada cuántos días compra (promedio)
  proximaEsperada: string;    // YYYY-MM-DD estimado
  diasParaProxima: number;    // negativo = atrasado
  estado: "por_acabar" | "atrasado";
  confianza: "alta" | "media"; // alta = 3+ compras, media = 2
  sucursal: string | null;
  yaContactado?: boolean; // true si se le envió recordatorio de este producto en los últimos 20 días
};

export type ResultadoFidelizacion = {
  recordatorios: ClienteRecordatorio[];
  resumen: {
    total: number;
    porAcabar: number;
    atrasados: number;
    clientesUnicos: number;
  };
  cobertura: {
    clientesConTelefono: number;
    nota: string;
  };
  error?: string;
};

// Normaliza un teléfono boliviano para link de WhatsApp (wa.me/591XXXXXXXX).
// Celulares en Bolivia: 8 dígitos que empiezan con 6 o 7. Devuelve null si no
// parece un celular válido (fijos, números incompletos, etc.).
export function normalizarWhatsapp(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  let d = String(telefono).replace(/\D/g, ""); // solo dígitos
  // Quitar prefijo internacional si ya lo trae
  if (d.startsWith("591")) d = d.slice(3);
  if (d.startsWith("00591")) d = d.slice(5);
  // Celular boliviano válido: 8 dígitos, empieza en 6 o 7
  if (d.length === 8 && (d[0] === "6" || d[0] === "7")) {
    return `591${d}`;
  }
  return null;
}

/**
 * Genera la lista de clientes crónicos por recordar.
 *
 * @param opts.minCompras       mínimo de compras del mismo producto para considerarlo crónico (default 2)
 * @param opts.anticipacionDias avisar cuántos días ANTES de que se le acabe (default 5)
 * @param opts.toleranciaAtraso hasta cuántos días de atraso seguir mostrándolo (default 45; más allá se considera perdido)
 * @param opts.sucursal         filtrar por sucursal (opcional)
 * @param opts.incluir          "ambos" | "por_acabar" | "atrasado" (default "ambos")
 */
export async function clientesPorRecordar(opts: {
  minCompras?: number;
  anticipacionDias?: number;
  toleranciaAtraso?: number;
  sucursal?: string;
  incluir?: "ambos" | "por_acabar" | "atrasado";
} = {}): Promise<ResultadoFidelizacion> {
  const minCompras = Math.max(2, opts.minCompras ?? 2);
  const anticipacionDias = opts.anticipacionDias ?? 5;
  const toleranciaAtraso = opts.toleranciaAtraso ?? 45;
  const incluir = opts.incluir ?? "ambos";

  const db = await getDb();
  if (!db) return vacio("Sin BD");

  try {
    const filtroSuc = opts.sucursal ? sql`AND v.nombreSucursal LIKE ${"%" + opts.sucursal + "%"}` : sql``;

    // Patrón de recompra por cliente + producto. Solo clientes con teléfono.
    // Se excluyen "ventas menores" (no es un medicamento real).
    const patrones = rows(await db.execute(sql`
      SELECT
        v.idCliente,
        c.nombre AS nombre,
        c.telefono AS telefono,
        d.articuloNombre AS producto,
        COUNT(DISTINCT v.id) AS veces,
        MIN(d.fecha) AS primera,
        MAX(d.fecha) AS ultima,
        DATEDIFF(MAX(d.fecha), MIN(d.fecha)) AS spanDias,
        SUBSTRING_INDEX(GROUP_CONCAT(v.nombreSucursal ORDER BY d.fecha DESC SEPARATOR '||'), '||', 1) AS ultimaSucursal
      FROM ventas v
      JOIN ventas_detalle d ON d.ventaId = v.id
      JOIN clientes c ON c.id = v.idCliente
      WHERE v.idCliente IS NOT NULL
        AND c.telefono IS NOT NULL AND c.telefono <> ''
        AND d.articuloNombre NOT LIKE '%venta menor%'
        AND d.articuloNombre NOT LIKE '%ventas menores%'
        ${filtroSuc}
      GROUP BY v.idCliente, c.nombre, c.telefono, d.articuloNombre
      HAVING veces >= ${minCompras} AND spanDias > 0
    `));

    const hoy = new Date();
    const hoyMid = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const diaMs = 24 * 60 * 60 * 1000;

    const recordatorios: ClienteRecordatorio[] = [];
    for (const p of patrones) {
      const veces = num(p.veces);
      const spanDias = num(p.spanDias);
      // Intervalo promedio entre compras consecutivas.
      const intervaloDias = Math.round(spanDias / (veces - 1));
      if (intervaloDias <= 0) continue;

      const ultima = String(p.ultima);
      const [uy, um, ud] = ultima.split("-").map(Number);
      const ultimaMid = Date.UTC(uy, um - 1, ud);
      const diasDesdeUltima = Math.round((hoyMid - ultimaMid) / diaMs);

      const proximaMid = ultimaMid + intervaloDias * diaMs;
      const diasParaProxima = Math.round((proximaMid - hoyMid) / diaMs);
      const proximaEsperada = new Date(proximaMid).toISOString().slice(0, 10);

      // Clasificar
      let estado: "por_acabar" | "atrasado" | null = null;
      if (diasParaProxima > 0 && diasParaProxima <= anticipacionDias) {
        estado = "por_acabar";
      } else if (diasParaProxima <= 0 && Math.abs(diasParaProxima) <= toleranciaAtraso) {
        estado = "atrasado";
      }
      if (!estado) continue;
      if (incluir !== "ambos" && incluir !== estado) continue;

      recordatorios.push({
        idCliente: num(p.idCliente),
        nombre: p.nombre || "Sin nombre",
        telefono: String(p.telefono),
        telefonoWhatsapp: normalizarWhatsapp(p.telefono),
        producto: p.producto,
        veces,
        ultimaCompra: ultima,
        diasDesdeUltima,
        intervaloDias,
        proximaEsperada,
        diasParaProxima,
        estado,
        confianza: veces >= 3 ? "alta" : "media",
        sucursal: p.ultimaSucursal || null,
      });
    }

    // Ordenar: atrasados primero (más urgente recuperarlos), luego por acabar;
    // dentro de cada grupo, mayor confianza y más cerca de la fecha.
    recordatorios.sort((a, b) => {
      if (a.estado !== b.estado) return a.estado === "atrasado" ? -1 : 1;
      if (a.confianza !== b.confianza) return a.confianza === "alta" ? -1 : 1;
      return a.diasParaProxima - b.diasParaProxima;
    });

    // Marcar los ya contactados hace poco (no se quitan; se marcan para que el
    // staff no repita el mismo recordatorio y sepa a quién ya escribió).
    const yaContactados = await contactadosRecientes(20);
    for (const r of recordatorios) {
      (r as any).yaContactado = yaContactados.has(`${r.idCliente}|${r.producto.toLowerCase()}`);
    }

    const clientesUnicos = new Set(recordatorios.map((r) => r.idCliente)).size;
    const porAcabar = recordatorios.filter((r) => r.estado === "por_acabar").length;
    const atrasados = recordatorios.filter((r) => r.estado === "atrasado").length;

    // Cobertura: cuántos clientes con teléfono hay en total (para ser honestos
    // sobre el alcance de la función).
    const cob = rows(await db.execute(sql`
      SELECT COUNT(*) AS n FROM clientes WHERE telefono IS NOT NULL AND telefono <> ''
    `));
    const clientesConTelefono = num(cob[0]?.n);

    return {
      recordatorios,
      resumen: { total: recordatorios.length, porAcabar, atrasados, clientesUnicos },
      cobertura: {
        clientesConTelefono,
        nota: clientesConTelefono === 0
          ? "No hay clientes con teléfono registrado. Para aprovechar esta función, registra el teléfono de los clientes de tratamientos crónicos al venderles."
          : `Se analizan ${clientesConTelefono} clientes con teléfono registrado. Mientras más clientes con teléfono y tratamiento crónico, más útil es esta lista.`,
      },
    };
  } catch (err: any) {
    return vacio(err.message);
  }
}

function vacio(error: string): ResultadoFidelizacion {
  return {
    recordatorios: [],
    resumen: { total: 0, porAcabar: 0, atrasados: 0, clientesUnicos: 0 },
    cobertura: { clientesConTelefono: 0, nota: "" },
    error,
  };
}

// ─── Registro de contactos (para no repetir el mismo recordatorio) ───
import { getDb as _getDb } from "./db";
import { sql as _sql } from "drizzle-orm";

let _tablaContactos = false;
async function _asegurarContactos() {
  if (_tablaContactos) return;
  const db = await _getDb();
  if (!db) return;
  try {
    await db.execute(_sql.raw(`CREATE TABLE IF NOT EXISTS recordatorios_enviados (
      id INT AUTO_INCREMENT PRIMARY KEY,
      idCliente INT NOT NULL,
      producto VARCHAR(300) NOT NULL,
      telefono VARCHAR(30),
      estado VARCHAR(20),
      canal VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
      enviadoEn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_re_cliente (idCliente), INDEX idx_re_fecha (enviadoEn)
    )`));
  } catch { /* ya existe */ }
  _tablaContactos = true;
}

// Registrar que se contactó a un cliente por un producto (evita repetir en N días).
export async function registrarRecordatorioEnviado(idCliente: number, producto: string, telefono: string, estado: string) {
  await _asegurarContactos();
  const db = await _getDb();
  if (!db) return { ok: false };
  await db.execute(_sql`
    INSERT INTO recordatorios_enviados (idCliente, producto, telefono, estado)
    VALUES (${idCliente}, ${String(producto).slice(0, 300)}, ${telefono || null}, ${estado || null})
  `);
  return { ok: true };
}

// Set de "cliente|producto" contactados en los últimos N días (para filtrar la lista).
export async function contactadosRecientes(dias = 20): Promise<Set<string>> {
  await _asegurarContactos();
  const db = await _getDb();
  if (!db) return new Set();
  try {
    const r: any = await db.execute(_sql`
      SELECT idCliente, producto FROM recordatorios_enviados
      WHERE enviadoEn >= DATE_SUB(NOW(), INTERVAL ${dias} DAY)
    `);
    const filas = Array.isArray(r) ? r[0] : r?.rows ?? r;
    const set = new Set<string>();
    for (const f of (Array.isArray(filas) ? filas : [])) {
      set.add(`${f.idCliente}|${String(f.producto).toLowerCase()}`);
    }
    return set;
  } catch { return new Set(); }
}
