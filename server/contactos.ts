// DIRECTORIO DE CONTACTOS — clientes y proveedores (persona o empresa) con su
// celular, a la mano y bien guardados en NUESTRA base. El teléfono normalizado
// (normTel: últimos 8 dígitos, formato Bolivia) es la LLAVE anti-duplicados:
// evita tener "77712345" y "+591 7771-2345" como dos contactos distintos.
// Un mismo contacto puede ser cliente Y proveedor a la vez.
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { normTel } from "./domain/telefono";

const filas = (r: any) => { const x = Array.isArray(r) ? r[0] : r?.rows ?? r; return Array.isArray(x) ? x : []; };
const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };

let tablaLista = false;
async function asegurarTabla(db: any) {
  if (tablaLista) return;
  try {
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS contactos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(200) NOT NULL,
      telefono VARCHAR(30) NOT NULL,
      telefonoNorm VARCHAR(15) NOT NULL,
      tipo VARCHAR(20) NOT NULL DEFAULT 'cliente',
      empresa VARCHAR(200),
      email VARCHAR(320),
      nota VARCHAR(400),
      activo TINYINT NOT NULL DEFAULT 1,
      creadoEn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_tel_tipo (telefonoNorm, tipo),
      INDEX idx_cont_nombre (nombre),
      INDEX idx_cont_tipo (tipo)
    )`));
  } catch { /* existe */ }
  tablaLista = true;
}

export const contactos = {
  async guardar(d: { id?: number; nombre: string; telefono: string; tipo: "cliente" | "proveedor"; empresa?: string; email?: string; nota?: string }) {
    const db = await getDb();
    if (!db) throw new Error("Sin BD");
    await asegurarTabla(db);
    if (!d.nombre?.trim()) throw new Error("Falta el nombre.");
    const tel = normTel(d.telefono);
    if (!tel) throw new Error("El número de celular no es válido (debe tener al menos 7 dígitos).");

    if (d.id) {
      await db.execute(sql`
        UPDATE contactos SET nombre=${d.nombre.trim().slice(0,200)}, telefono=${d.telefono.trim().slice(0,30)},
          telefonoNorm=${tel}, tipo=${d.tipo}, empresa=${(d.empresa||"").slice(0,200)||null},
          email=${(d.email||"").trim().toLowerCase().slice(0,320)||null}, nota=${(d.nota||"").slice(0,400)||null}
        WHERE id=${num(d.id)}
      `);
      return { ok: true, id: d.id, creado: false };
    }
    // Anti-duplicado: mismo teléfono + mismo tipo → actualiza en vez de duplicar
    const ya = filas(await db.execute(sql`SELECT id FROM contactos WHERE telefonoNorm = ${tel} AND tipo = ${d.tipo} LIMIT 1`));
    if (ya.length > 0) {
      const id = num(ya[0].id);
      await db.execute(sql`
        UPDATE contactos SET nombre=${d.nombre.trim().slice(0,200)}, telefono=${d.telefono.trim().slice(0,30)},
          empresa=${(d.empresa||"").slice(0,200)||null}, email=${(d.email||"").trim().toLowerCase().slice(0,320)||null},
          nota=${(d.nota||"").slice(0,400)||null}, activo=1
        WHERE id=${id}
      `);
      return { ok: true, id, creado: false, yaExistia: true };
    }
    const ins: any = await db.execute(sql`
      INSERT INTO contactos (nombre, telefono, telefonoNorm, tipo, empresa, email, nota)
      VALUES (${d.nombre.trim().slice(0,200)}, ${d.telefono.trim().slice(0,30)}, ${tel}, ${d.tipo},
        ${(d.empresa||"").slice(0,200)||null}, ${(d.email||"").trim().toLowerCase().slice(0,320)||null}, ${(d.nota||"").slice(0,400)||null})
    `);
    return { ok: true, id: ins?.[0]?.insertId ?? ins?.insertId ?? null, creado: true };
  },

  // Búsqueda por nombre, empresa o teléfono (en cualquier formato que se escriba)
  async buscar(q: string, tipo?: "cliente" | "proveedor") {
    const db = await getDb();
    if (!db) return [];
    await asegurarTabla(db);
    const limpio = (q || "").trim();
    let where = sql`activo = 1`;
    if (tipo) where = sql`${where} AND tipo = ${tipo}`;
    if (limpio) {
      const like = `%${limpio.replace(/\s+/g, "%")}%`;
      const tel = normTel(limpio);
      where = tel
        ? sql`${where} AND (nombre LIKE ${like} OR empresa LIKE ${like} OR telefonoNorm LIKE ${`%${tel}%`})`
        : sql`${where} AND (nombre LIKE ${like} OR empresa LIKE ${like})`;
    }
    const r = filas(await db.execute(sql`
      SELECT id, nombre, telefono, tipo, empresa, email, nota FROM contactos
      WHERE ${where} ORDER BY nombre LIMIT 50
    `));
    return r;
  },

  async eliminar(id: number) {
    const db = await getDb();
    if (!db) throw new Error("Sin BD");
    await asegurarTabla(db);
    // Baja lógica: el contacto no se borra (puede estar referenciado en historial)
    await db.execute(sql`UPDATE contactos SET activo = 0 WHERE id = ${num(id)}`);
    return { ok: true };
  },
};
