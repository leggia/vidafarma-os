// REGISTRO DE DISPENSACIÓN DE CONTROLADOS — libro de control exigible a una
// farmacia: cada entrega de un medicamento controlado (psicotrópico,
// estupefaciente, precursor) queda registrada con producto, cantidad, datos de
// la receta y del paciente/médico, y quién dispensó. Es un LIBRO DE AUDITORÍA:
// los registros no se editan ni se borran (solo se puede anular con motivo, y la
// anulación también queda registrada). Sirve para inspecciones sanitarias.
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { esControlado } from "./domain/controlados";

const filas = (r: any) => { const x = Array.isArray(r) ? r[0] : r?.rows ?? r; return Array.isArray(x) ? x : []; };
const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const ahoraBolivia = () => new Date(Date.now() - 4 * 3600 * 1000);

let tablaLista = false;
async function asegurarTabla(db: any) {
  if (tablaLista) return;
  try {
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS dispensacion_controlados (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fecha VARCHAR(10) NOT NULL,
      hora VARCHAR(8) NOT NULL,
      sucursal VARCHAR(120) NOT NULL,
      producto VARCHAR(500) NOT NULL,
      cantidad INT NOT NULL DEFAULT 1,
      recetaNumero VARCHAR(80),
      medico VARCHAR(200),
      matriculaMedico VARCHAR(80),
      paciente VARCHAR(200),
      documentoPaciente VARCHAR(50),
      dispensadoPor VARCHAR(200) NOT NULL,
      nota VARCHAR(400),
      estado VARCHAR(20) NOT NULL DEFAULT 'vigente',
      anuladoMotivo VARCHAR(300),
      creadoEn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_disp_fecha (fecha),
      INDEX idx_disp_producto (producto(120))
    )`));
  } catch { /* existe */ }
  tablaLista = true;
}

export const dispensacion = {
  // Indica si un producto REQUIERE registro (es controlado) — el mostrador lo usa
  // para avisar a la vendedora que debe registrar la dispensación.
  esControlado(nombre: string, descripcion?: string | null) {
    return esControlado(nombre, descripcion);
  },

  async registrar(d: {
    sucursal: string; producto: string; cantidad: number;
    recetaNumero?: string; medico?: string; matriculaMedico?: string;
    paciente?: string; documentoPaciente?: string; dispensadoPor: string; nota?: string;
  }) {
    const db = await getDb();
    if (!db) throw new Error("Sin BD");
    await asegurarTabla(db);
    if (!d.producto?.trim()) throw new Error("Falta el producto.");
    if (num(d.cantidad) < 1) throw new Error("La cantidad debe ser 1 o más.");
    // Regla legal mínima: un controlado se entrega CON receta — exige el número.
    if (!d.recetaNumero?.trim()) throw new Error("Un medicamento controlado requiere el número de receta.");
    const ahora = ahoraBolivia();
    const ins: any = await db.execute(sql`
      INSERT INTO dispensacion_controlados
        (fecha, hora, sucursal, producto, cantidad, recetaNumero, medico, matriculaMedico, paciente, documentoPaciente, dispensadoPor, nota)
      VALUES (${ahora.toISOString().slice(0, 10)}, ${ahora.toISOString().slice(11, 19)}, ${d.sucursal.slice(0, 120)},
        ${d.producto.slice(0, 500)}, ${num(d.cantidad)}, ${(d.recetaNumero || "").slice(0, 80)},
        ${(d.medico || "").slice(0, 200) || null}, ${(d.matriculaMedico || "").slice(0, 80) || null},
        ${(d.paciente || "").slice(0, 200) || null}, ${(d.documentoPaciente || "").slice(0, 50) || null},
        ${d.dispensadoPor.slice(0, 200)}, ${(d.nota || "").slice(0, 400) || null})
    `);
    return { ok: true, id: ins?.[0]?.insertId ?? ins?.insertId ?? null };
  },

  async listar(opts?: { desde?: string; hasta?: string; producto?: string; limite?: number }) {
    const db = await getDb();
    if (!db) return [];
    await asegurarTabla(db);
    const limite = Math.min(Math.max(opts?.limite ?? 100, 1), 500);
    let where = sql`1=1`;
    if (opts?.desde) where = sql`${where} AND fecha >= ${opts.desde}`;
    if (opts?.hasta) where = sql`${where} AND fecha <= ${opts.hasta}`;
    if (opts?.producto?.trim()) { const like = `%${opts.producto.trim().replace(/\s+/g, "%")}%`; where = sql`${where} AND producto LIKE ${like}`; }
    const r = filas(await db.execute(sql`
      SELECT * FROM dispensacion_controlados WHERE ${where}
      ORDER BY fecha DESC, hora DESC LIMIT ${limite}
    `));
    return r.map((x: any) => ({ ...x, cantidad: num(x.cantidad) }));
  },

  // Anular (NO borrar — libro de auditoría): queda con estado anulada y motivo.
  async anular(id: number, motivo: string, por: string) {
    const db = await getDb();
    if (!db) throw new Error("Sin BD");
    await asegurarTabla(db);
    if (!motivo?.trim()) throw new Error("La anulación requiere un motivo.");
    await db.execute(sql`
      UPDATE dispensacion_controlados
      SET estado = 'anulada', anuladoMotivo = ${`${motivo.trim()} (por ${por})`.slice(0, 300)}
      WHERE id = ${num(id)} AND estado = 'vigente'
    `);
    return { ok: true };
  },

  // Resumen para inspección: cuántas dispensaciones por producto en un rango.
  async resumen(desde: string, hasta: string) {
    const db = await getDb();
    if (!db) return { error: "Sin BD" };
    await asegurarTabla(db);
    const porProducto = filas(await db.execute(sql`
      SELECT producto, COUNT(*) AS n, COALESCE(SUM(cantidad),0) AS unidades
      FROM dispensacion_controlados
      WHERE fecha >= ${desde} AND fecha <= ${hasta} AND estado = 'vigente'
      GROUP BY producto ORDER BY unidades DESC
    `));
    const total = filas(await db.execute(sql`
      SELECT COUNT(*) AS n FROM dispensacion_controlados WHERE fecha >= ${desde} AND fecha <= ${hasta} AND estado = 'vigente'
    `));
    return {
      desde, hasta,
      totalDispensaciones: num(total[0]?.n),
      porProducto: porProducto.map((p: any) => ({ producto: p.producto, dispensaciones: num(p.n), unidades: num(p.unidades) })),
    };
  },
};
