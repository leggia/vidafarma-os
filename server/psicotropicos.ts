// LIBRO DE PSICOTRÓPICOS — control legal exigible (informes trimestral, semestral
// y anual a SEDES). Cada producto tiene sus DATOS MAESTROS (registro sanitario =
// clave, DCI, concentración, etc.) y sus MOVIMIENTOS. Los egresos se capturan en
// mostrador (con receta y foto), el saldo parte del stock real de 365. Los
// informes se calculan con la lógica pura testeada en domain/psicotropicos.ts.
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { construirLibro, resumenPeriodo, rangoTrimestre, type MovimientoPsico } from "./domain/psicotropicos";

const filas = (r: any) => { const x = Array.isArray(r) ? r[0] : r?.rows ?? r; return Array.isArray(x) ? x : []; };
const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const ahoraBolivia = () => new Date(Date.now() - 4 * 3600 * 1000);

let tablasListas = false;
async function asegurarTablas(db: any) {
  if (tablasListas) return;
  try {
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS psico_productos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombreComercial VARCHAR(255) NOT NULL,
      dci VARCHAR(255),
      concentracion VARCHAR(120),
      presentacion VARCHAR(120),
      laboratorio VARCHAR(255),
      registroSanitario VARCHAR(120) NOT NULL,
      origen VARCHAR(120),
      articuloId365 INT,
      activo TINYINT NOT NULL DEFAULT 1,
      creadoEn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_rs (registroSanitario)
    )`));
  } catch { /* existe */ }
  try {
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS psico_movimientos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productoId INT NOT NULL,
      fecha VARCHAR(10) NOT NULL,
      tipo VARCHAR(10) NOT NULL,
      cantidad INT NOT NULL,
      recetaNumero VARCHAR(80),
      paciente VARCHAR(200),
      medico VARCHAR(200),
      numFactura VARCHAR(80),
      recetaFotoUrl VARCHAR(500),
      facturaFotoUrl VARCHAR(500),
      registradoPor VARCHAR(200),
      nota VARCHAR(400),
      estado VARCHAR(20) NOT NULL DEFAULT 'vigente',
      creadoEn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pm_prod (productoId),
      INDEX idx_pm_fecha (fecha)
    )`));
  } catch { /* existe */ }
  tablasListas = true;
}

export const psico = {
  async listarProductos() {
    const db = await getDb();
    if (!db) return [];
    await asegurarTablas(db);
    const r = filas(await db.execute(sql`SELECT * FROM psico_productos WHERE activo = 1 ORDER BY nombreComercial`));
    return r;
  },

  async guardarProducto(d: {
    id?: number; nombreComercial: string; dci?: string; concentracion?: string;
    presentacion?: string; laboratorio?: string; registroSanitario: string; origen?: string; articuloId365?: number;
  }) {
    const db = await getDb();
    if (!db) throw new Error("Sin BD");
    await asegurarTablas(db);
    if (!d.nombreComercial?.trim()) throw new Error("Falta el nombre comercial.");
    if (!d.registroSanitario?.trim()) throw new Error("Falta el registro sanitario (es la clave del producto).");
    if (d.id) {
      await db.execute(sql`
        UPDATE psico_productos SET nombreComercial=${d.nombreComercial.slice(0,255)}, dci=${(d.dci||"").slice(0,255)||null},
          concentracion=${(d.concentracion||"").slice(0,120)||null}, presentacion=${(d.presentacion||"").slice(0,120)||null},
          laboratorio=${(d.laboratorio||"").slice(0,255)||null}, registroSanitario=${d.registroSanitario.slice(0,120)},
          origen=${(d.origen||"").slice(0,120)||null}, articuloId365=${d.articuloId365 ?? null}
        WHERE id=${d.id}
      `);
      return { ok: true, id: d.id };
    }
    const ins: any = await db.execute(sql`
      INSERT INTO psico_productos (nombreComercial, dci, concentracion, presentacion, laboratorio, registroSanitario, origen, articuloId365)
      VALUES (${d.nombreComercial.slice(0,255)}, ${(d.dci||"").slice(0,255)||null}, ${(d.concentracion||"").slice(0,120)||null},
        ${(d.presentacion||"").slice(0,120)||null}, ${(d.laboratorio||"").slice(0,255)||null}, ${d.registroSanitario.slice(0,120)},
        ${(d.origen||"").slice(0,120)||null}, ${d.articuloId365 ?? null})
    `);
    return { ok: true, id: ins?.[0]?.insertId ?? ins?.insertId ?? null };
  },

  async registrarMovimiento(d: {
    productoId: number; tipo: "ingreso" | "egreso"; cantidad: number; fecha?: string;
    recetaNumero?: string; paciente?: string; medico?: string; numFactura?: string;
    recetaFotoUrl?: string; facturaFotoUrl?: string; registradoPor: string; nota?: string;
  }) {
    const db = await getDb();
    if (!db) throw new Error("Sin BD");
    await asegurarTablas(db);
    if (num(d.cantidad) < 1) throw new Error("La cantidad debe ser 1 o más.");
    // Un egreso de psicotrópico exige receta (regla legal)
    if (d.tipo === "egreso" && !d.recetaNumero?.trim()) throw new Error("El egreso de un psicotrópico requiere el número de receta.");
    const fecha = d.fecha || ahoraBolivia().toISOString().slice(0, 10);
    const ins: any = await db.execute(sql`
      INSERT INTO psico_movimientos (productoId, fecha, tipo, cantidad, recetaNumero, paciente, medico, numFactura, recetaFotoUrl, facturaFotoUrl, registradoPor, nota)
      VALUES (${num(d.productoId)}, ${fecha}, ${d.tipo}, ${num(d.cantidad)}, ${(d.recetaNumero||"").slice(0,80)||null},
        ${(d.paciente||"").slice(0,200)||null}, ${(d.medico||"").slice(0,200)||null}, ${(d.numFactura||"").slice(0,80)||null},
        ${(d.recetaFotoUrl||"").slice(0,500)||null}, ${(d.facturaFotoUrl||"").slice(0,500)||null}, ${d.registradoPor.slice(0,200)}, ${(d.nota||"").slice(0,400)||null})
    `);
    return { ok: true, id: ins?.[0]?.insertId ?? ins?.insertId ?? null };
  },

  async movimientosDe(productoId: number, desde?: string, hasta?: string) {
    const db = await getDb();
    if (!db) return [];
    await asegurarTablas(db);
    let where = sql`productoId = ${num(productoId)} AND estado = 'vigente'`;
    if (desde) where = sql`${where} AND fecha >= ${desde}`;
    if (hasta) where = sql`${where} AND fecha < ${hasta}`;
    return filas(await db.execute(sql`SELECT * FROM psico_movimientos WHERE ${where} ORDER BY fecha, id`));
  },

  // Saldo inicial de un producto al comienzo de un período = stock actual de 365
  // menos los movimientos netos posteriores... pero como partimos del stock real
  // HOY, para períodos pasados usamos: saldo al inicio = stock365 - (ingresos -
  // egresos desde el inicio del período hasta hoy). Para el período vigente, el
  // saldo inicial es el stock365 menos los movimientos del período ya cargados.
  async saldoInicialPeriodo(db: any, prod: any, desde: string): Promise<number> {
    let stock365 = 0;
    if (prod.articuloId365) {
      try {
        const { inventarios365 } = await import("./inventarios365");
        // Busca el artículo en el almacén principal (Casa Matriz, id 1)
        const lista = await inventarios365.listarParaInventario(1, "");
        const encontrado = lista.find((p: any) => p.id === prod.articuloId365);
        stock365 = encontrado ? num(encontrado.stock) : 0;
      } catch { /* si 365 falla, stock365 = 0 y se avisa arriba */ }
    }
    // Movimientos desde 'desde' hasta hoy (para retroceder el saldo)
    const movs = filas(await db.execute(sql`
      SELECT tipo, COALESCE(SUM(cantidad),0) AS total FROM psico_movimientos
      WHERE productoId = ${num(prod.id)} AND estado = 'vigente' AND fecha >= ${desde} GROUP BY tipo
    `));
    let ingresoDesde = 0, egresoDesde = 0;
    for (const m of movs) { if (m.tipo === "ingreso") ingresoDesde = num(m.total); else egresoDesde = num(m.total); }
    // saldo al inicio del período = stock hoy - (ingresos - egresos ocurridos en el período)
    return stock365 - (ingresoDesde - egresoDesde);
  },

  // Libro completo de un producto en un rango (para el informe "para libro")
  async libroProducto(productoId: number, desde: string, hasta: string) {
    const db = await getDb();
    if (!db) return { error: "Sin BD" };
    await asegurarTablas(db);
    const prod = filas(await db.execute(sql`SELECT * FROM psico_productos WHERE id = ${num(productoId)}`))[0];
    if (!prod) return { error: "Producto no encontrado" };
    const saldoInicial = await this.saldoInicialPeriodo(db, prod, desde);
    const movs = await this.movimientosDe(productoId, desde, hasta);
    const movsPuros: MovimientoPsico[] = movs.map((m: any) => ({
      fecha: m.fecha, tipo: m.tipo, cantidad: num(m.cantidad),
      recetaNumero: m.recetaNumero, paciente: m.paciente, medico: m.medico, numFactura: m.numFactura,
    }));
    const libro = construirLibro(saldoInicial, movsPuros);
    return { producto: prod, saldoInicial, ...libro };
  },

  // Informe consolidado (trimestral/semestral/anual): una fila por producto
  async informe(tipo: "trimestral" | "semestral" | "anual", anio: number, trimestre?: number) {
    const db = await getDb();
    if (!db) return { error: "Sin BD" };
    await asegurarTablas(db);
    let desde: string, hasta: string, etiqueta: string;
    if (tipo === "trimestral") {
      const t = trimestre || 1;
      ({ desde, hasta } = rangoTrimestre(anio, t));
      etiqueta = `${t}/${anio}`;
    } else if (tipo === "semestral") {
      const t = trimestre || 1; // semestre 1 → trim 1-2, semestre 2 → trim 3-4
      desde = rangoTrimestre(anio, t === 1 ? 1 : 3).desde;
      hasta = rangoTrimestre(anio, t === 1 ? 2 : 4).hasta;
      etiqueta = t === 1 ? `1,2/${anio}` : `3,4/${anio}`;
    } else {
      desde = `${anio}-01-01`; hasta = `${anio + 1}-01-01`; etiqueta = `${anio}`;
    }

    const productos = await this.listarProductos();
    const detalle = [];
    for (const prod of productos) {
      const saldoInicial = await this.saldoInicialPeriodo(db, prod, desde);
      const movs = await this.movimientosDe(prod.id, desde, hasta);
      const movsPuros: MovimientoPsico[] = movs.map((m: any) => ({ fecha: m.fecha, tipo: m.tipo, cantidad: num(m.cantidad) }));
      const res = resumenPeriodo(saldoInicial, movsPuros);
      detalle.push({
        producto: prod.nombreComercial, dci: prod.dci, concentracion: prod.concentracion,
        presentacion: prod.presentacion, laboratorio: prod.laboratorio, registroSanitario: prod.registroSanitario,
        origen: prod.origen, ...res,
      });
    }
    return { tipo, etiqueta, desde, hasta, detalle };
  },

  // Importar productos maestros en lote (semilla inicial desde el libro Excel).
  // Idempotente: no duplica si el registro sanitario ya existe.
  async importarProductos(productos: any[]) {
    const db = await getDb();
    if (!db) throw new Error("Sin BD");
    await asegurarTablas(db);
    let creados = 0, existentes = 0;
    for (const p of productos) {
      if (!p.nombreComercial?.trim() || !p.registroSanitario?.trim()) continue;
      const ya = filas(await db.execute(sql`SELECT id FROM psico_productos WHERE registroSanitario = ${p.registroSanitario.slice(0,120)} LIMIT 1`));
      if (ya.length > 0) { existentes++; continue; }
      await this.guardarProducto(p);
      creados++;
    }
    return { ok: true, creados, existentes };
  },
};
