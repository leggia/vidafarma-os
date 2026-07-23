/**
 * BANDEJA DE FACTURAS XML.
 *
 * Guarda cada factura XML (subida manual o llegada por correo) en espera, con su
 * estado, para retomarla luego. Base de la cámara-inteligente (reconoce la
 * factura física contra esta bandeja) y de la ingesta por correo.
 *
 * Estados: recibida → emparejada → vencimientos_pendientes → validada.
 */
import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "./db";
import { bandejaFacturas } from "../drizzle/schema";
import { detectarServicio, type FacturaXmlResult } from "./factura-xml";

interface ItemBandeja {
  productName: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
  descuento: number;
  expiryDate: string | null;
  codigoProducto: string | null;
  articuloId: number | null;      // producto de 365 emparejado (null = sin emparejar)
  articuloNombre: string | null;
}

/** Recalcula el estado de una factura según su progreso de emparejamiento/vencimientos. */
function calcularEstado(items: ItemBandeja[]): {
  estado: "recibida" | "emparejada" | "vencimientos_pendientes" | "validada";
  emparejados: number;
  conVencimiento: number;
} {
  const total = items.length;
  const emparejados = items.filter((i) => i.articuloId != null && i.articuloId > 0).length;
  const conVencimiento = items.filter((i) => !!i.expiryDate).length;
  let estado: "recibida" | "emparejada" | "vencimientos_pendientes" | "validada";
  if (emparejados < total) {
    estado = "recibida";
  } else if (conVencimiento < total) {
    estado = "vencimientos_pendientes";
  } else {
    estado = "emparejada"; // todo emparejado y con vencimiento; 'validada' se marca al sincronizar
  }
  return { estado, emparejados, conVencimiento };
}

/**
 * NITs de la farmacia. Se factura a más de un NIT, así que se maneja una lista:
 * cualquiera de ellos es "nuestro" y no genera aviso.
 *
 * Se toman de la variable de entorno NIT_FARMACIA (separados por coma) si está
 * configurada; si no, se usan los conocidos. Además se APRENDEN solos: cualquier
 * NIT que ya se haya repetido 3 o más veces en la bandeja se considera propio,
 * así un NIT nuevo deja de avisar por sí mismo tras unas facturas.
 */
const NITS_CONOCIDOS = ["6512529017", "8033811015"];

async function nitsDeLaFarmacia(db: any): Promise<string[]> {
  const configurado = (process.env.NIT_FARMACIA || "").trim();
  const base = configurado
    ? configurado.split(/[,;\s]+/).map((n) => n.trim()).filter(Boolean)
    : [...NITS_CONOCIDOS];

  // Aprendidos: los que ya aparecieron varias veces son nuestros
  try {
    const { sql } = await import("drizzle-orm");
    const r: any = await db.execute(sql`
      SELECT nitCliente, COUNT(*) AS n FROM bandeja_facturas
      WHERE nitCliente IS NOT NULL AND nitCliente <> ''
      GROUP BY nitCliente HAVING n >= 3
    `);
    const filas = Array.isArray(r) ? r[0] : r?.rows ?? r;
    for (const f of (filas || []) as any[]) {
      const nit = String(f.nitCliente);
      if (!base.includes(nit)) base.push(nit);
    }
  } catch { /* la columna puede no existir todavía */ }
  return base;
}

class BandejaService {
  /** Ingresa una factura XML parseada a la bandeja. Idempotente por CUF: si ya
   *  existe esa factura, no la duplica (devuelve la existente). */
  async ingresar(f: FacturaXmlResult, origen: "manual" | "correo" = "manual"): Promise<{ id: number; duplicada: boolean }> {
    const db = await getDb();
    if (!db) throw new Error("Sin BD");

    // ¿Ya está esta factura (mismo CUF)?
    if (f.cuf) {
      const existente = await db.select().from(bandejaFacturas).where(eq(bandejaFacturas.cuf, f.cuf)).limit(1);
      if (existente.length > 0) return { id: existente[0].id, duplicada: true };
    }

    const items: ItemBandeja[] = f.items.map((it) => ({
      productName: it.productName,
      quantity: it.quantity,
      unitCost: it.unitCost,
      subtotal: it.subtotal,
      descuento: it.descuento,
      expiryDate: it.expiryDate,
      codigoProducto: it.codigoProducto,
      articuloId: null,
      articuloNombre: null,
    }));
    const { estado, emparejados, conVencimiento } = calcularEstado(items);

    // ¿La factura viene a nombre de la farmacia? Si sabemos cuál es nuestro NIT y
    // el de la factura es otro, se marca para revisarla (no se rechaza: puede ser
    // un NIT nuevo o un error de tipeo del proveedor).
    const nuestros = await nitsDeLaFarmacia(db);
    const nitFactura = (f.nitCliente || "").trim();
    const esAjena = !!(nitFactura && nuestros.length > 0 && !nuestros.includes(nitFactura));
    if (esAjena) {
      console.warn(`[Bandeja] Factura a nombre de otro NIT (${nitFactura}, propios: ${nuestros.join("/")}): ${f.razonSocialCliente ?? "?"}`);
    }

    // ¿Es una factura de servicio (luz, internet, agua)? Eso es un GASTO, no una
    // compra de mercadería: se avisa para que no se procese como productos.
    const servicio = detectarServicio(f.tipoDocumento, f.razonSocialEmisor);
    if (servicio) {
      console.warn(`[Bandeja] Factura de ${servicio}: ${f.razonSocialEmisor} — corresponde a Gastos, no a Compras`);
    }

    const res = await db.insert(bandejaFacturas).values({
      nitEmisor: f.nitEmisor,
      proveedor: f.razonSocialEmisor,
      razonSocialCliente: f.razonSocialCliente ?? null,
      nitCliente: f.nitCliente ?? null,
      ajena: esAjena ? 1 : 0,
      servicioDetectado: servicio,
      numeroFactura: f.numeroFactura,
      cuf: f.cuf,
      fechaEmision: f.fechaEmision,
      montoTotal: String(f.montoTotal),
      estado,
      origen,
      items,
      totalItems: items.length,
      itemsEmparejados: emparejados,
      itemsConVencimiento: conVencimiento,
    });
    const id = Number((res as any).insertId ?? (res as any)[0]?.insertId);
    return { id, duplicada: false };
  }

  /** Lista las facturas de la bandeja. Por defecto solo pendientes (no validadas). */
  async listar(incluirValidadas = false) {
    const db = await getDb();
    if (!db) return [];
    const where = incluirValidadas ? undefined : ne(bandejaFacturas.estado, "validada");
    const q = db.select({
      id: bandejaFacturas.id,
      proveedor: bandejaFacturas.proveedor,
      numeroFactura: bandejaFacturas.numeroFactura,
      montoTotal: bandejaFacturas.montoTotal,
      estado: bandejaFacturas.estado,
      origen: bandejaFacturas.origen,
      totalItems: bandejaFacturas.totalItems,
      itemsEmparejados: bandejaFacturas.itemsEmparejados,
      itemsConVencimiento: bandejaFacturas.itemsConVencimiento,
      fechaEmision: bandejaFacturas.fechaEmision,
      recibidaEn: bandejaFacturas.recibidaEn,
    }).from(bandejaFacturas);
    const rows = where ? await q.where(where).orderBy(desc(bandejaFacturas.recibidaEn)) : await q.orderBy(desc(bandejaFacturas.recibidaEn));
    return rows;
  }

  /** Detalle completo de una factura de la bandeja. */
  async detalle(id: number) {
    const db = await getDb();
    if (!db) return null;
    const r = await db.select().from(bandejaFacturas).where(eq(bandejaFacturas.id, id)).limit(1);
    return r[0] ?? null;
  }

  /** Reconoce una factura por número y/o proveedor (para la cámara inteligente).
   *  Devuelve las coincidencias PENDIENTES de la bandeja. */
  async reconocer(numeroFactura?: string, proveedor?: string) {
    const db = await getDb();
    if (!db) return [];
    const pend = await db.select().from(bandejaFacturas).where(ne(bandejaFacturas.estado, "validada"));
    const numNorm = (numeroFactura || "").replace(/\D/g, "");
    const provNorm = (proveedor || "").trim().toLowerCase();
    return pend
      .map((f) => {
        let score = 0;
        if (numNorm && f.numeroFactura && f.numeroFactura.replace(/\D/g, "") === numNorm) score += 0.7;
        if (provNorm && f.proveedor && f.proveedor.toLowerCase().includes(provNorm)) score += 0.3;
        return { factura: f, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => ({
        id: x.factura.id,
        proveedor: x.factura.proveedor,
        numeroFactura: x.factura.numeroFactura,
        estado: x.factura.estado,
        score: x.score,
        totalItems: x.factura.totalItems,
        itemsConVencimiento: x.factura.itemsConVencimiento,
      }));
  }

  /** Actualiza los items (emparejamiento y/o vencimientos) y recalcula el estado. */
  async actualizarItems(id: number, items: ItemBandeja[]) {
    const db = await getDb();
    if (!db) throw new Error("Sin BD");
    const { estado, emparejados, conVencimiento } = calcularEstado(items);

    await db.update(bandejaFacturas).set({
      items,
      totalItems: items.length,
      itemsEmparejados: emparejados,
      itemsConVencimiento: conVencimiento,
      estado,
    }).where(eq(bandejaFacturas.id, id));
    return { estado, emparejados, conVencimiento };
  }

  /** Marca una factura como validada (ya sincronizada como compra real). */
  async marcarValidada(id: number, purchaseId?: number) {
    const db = await getDb();
    if (!db) throw new Error("Sin BD");
    await db.update(bandejaFacturas).set({
      estado: "validada",
      purchaseId: purchaseId ?? null,
    }).where(eq(bandejaFacturas.id, id));
  }

  /** Elimina una factura de la bandeja (descartar). */
  async eliminar(id: number) {
    const db = await getDb();
    if (!db) throw new Error("Sin BD");
    await db.delete(bandejaFacturas).where(eq(bandejaFacturas.id, id));
  }
}

export const bandejaService = new BandejaService();
