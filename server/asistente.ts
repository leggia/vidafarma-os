// Servicio del Asistente VidaFarma (Fase 1: solo consultas / lectura)
// Cada función es una "herramienta" que el asistente puede invocar.
import { getDb } from "./db";
import { sql } from "drizzle-orm";

const rows = (r: any): any[] => {
  const x = Array.isArray(r) ? r[0] : r?.rows ?? r;
  return Array.isArray(x) ? x : [];
};
const esc = (v: string) => `'${String(v ?? "").replace(/'/g, "''")}'`;
const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const fmtBs = (n: any) => num(n).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Rango de fechas según un período de texto
function rangoFechas(periodo: string): { desde: string; hasta: string; etiqueta: string } {
  const hoy = new Date();
  const y = hoy.getFullYear(), m = hoy.getMonth(), d = hoy.getDate();
  const iso = (dt: Date) => dt.toISOString().slice(0, 10);
  const p = (periodo || "hoy").toLowerCase();
  if (p.includes("hoy")) {
    const t = iso(hoy);
    return { desde: t, hasta: t, etiqueta: "hoy" };
  }
  if (p.includes("ayer")) {
    const a = new Date(y, m, d - 1);
    return { desde: iso(a), hasta: iso(a), etiqueta: "ayer" };
  }
  if (p.includes("semana")) {
    const ini = new Date(y, m, d - 6);
    return { desde: iso(ini), hasta: iso(hoy), etiqueta: "los últimos 7 días" };
  }
  if (p.includes("mes")) {
    const ini = new Date(y, m, 1);
    return { desde: iso(ini), hasta: iso(hoy), etiqueta: "este mes" };
  }
  // Si viene formato YYYY-MM
  const match = p.match(/(\d{4})-(\d{2})/);
  if (match) {
    const anio = Number(match[1]), mes = Number(match[2]);
    const ultimo = new Date(anio, mes, 0).getDate();
    return { desde: `${match[1]}-${match[2]}-01`, hasta: `${match[1]}-${match[2]}-${String(ultimo).padStart(2, "0")}`, etiqueta: `${match[1]}-${match[2]}` };
  }
  const t = iso(hoy);
  return { desde: t, hasta: t, etiqueta: "hoy" };
}

export const asistenteTools = {
  // 1. Cuánto vendí en un período
  async ventasPeriodo(periodo: string, sucursal?: string) {
    const db = await getDb();
    if (!db) return { error: "Sin BD" };
    const { desde, hasta, etiqueta } = rangoFechas(periodo);
    const filtroSuc = sucursal ? ` AND nombreSucursal LIKE ${esc("%" + sucursal + "%")}` : "";
    const r = rows(await db.execute(sql.raw(
      `SELECT COUNT(*) as numVentas, COALESCE(SUM(total),0) as total
       FROM ventas WHERE fecha >= ${esc(desde)} AND fecha <= ${esc(hasta)}${filtroSuc}`
    )));
    const data = r[0] || { numVentas: 0, total: 0 };
    return {
      periodo: etiqueta,
      sucursal: sucursal || "todas las sucursales",
      numeroVentas: num(data.numVentas),
      totalVendido: `Bs ${fmtBs(data.total)}`,
    };
  },

  // 2. Productos por agotarse (stock bajo)
  // NOTA: el cache local no guarda stock. Esta función informa esa limitación
  // de forma honesta en vez de inventar datos.
  async productosPorAgotarse(limite = 15) {
    return {
      mensaje: "El stock en tiempo real no está disponible localmente. El sistema guarda precios y costos de los productos, pero el stock se consulta directamente en inventarios365. Para ver productos por agotarse, te recomiendo revisar el módulo de inventario.",
      disponible: false,
    };
  },

  // 3. Cuánto le compré a un proveedor en un período
  async comprasProveedor(proveedor: string, periodo: string) {
    const db = await getDb();
    if (!db) return { error: "Sin BD" };
    const { desde, hasta, etiqueta } = rangoFechas(periodo.includes("mes") || periodo.match(/\d{4}-\d{2}/) ? periodo : "mes");
    const r = rows(await db.execute(sql.raw(
      `SELECT COUNT(*) as n, COALESCE(SUM(totalAmount),0) as total FROM purchases
       WHERE status='completed' AND supplier LIKE ${esc("%" + proveedor + "%")}
       AND createdAt >= ${esc(desde + " 00:00:00")} AND createdAt <= ${esc(hasta + " 23:59:59")}`
    )));
    const data = r[0] || { n: 0, total: 0 };
    return {
      proveedor, periodo: etiqueta,
      numeroCompras: num(data.n),
      totalComprado: `Bs ${fmtBs(data.total)}`,
    };
  },

  // 4. Producto más vendido en un período
  async productoMasVendido(periodo: string, porValor = false) {
    const db = await getDb();
    if (!db) return { error: "Sin BD" };
    const { desde, hasta, etiqueta } = rangoFechas(periodo.includes("mes") ? periodo : "mes");
    const orden = porValor ? "SUM(subtotal)" : "SUM(cantidad)";
    const r = rows(await db.execute(sql.raw(
      `SELECT articuloNombre, SUM(cantidad) as cant, SUM(subtotal) as valor
       FROM ventas_detalle WHERE fecha >= ${esc(desde)} AND fecha <= ${esc(hasta)}
       AND articuloNombre NOT LIKE '%venta menor%'
       GROUP BY articuloNombre ORDER BY ${orden} DESC LIMIT 5`
    )));
    if (r.length === 0) return { mensaje: `No hay ventas registradas en ${etiqueta}.` };
    return {
      periodo: etiqueta,
      criterio: porValor ? "por valor (Bs)" : "por cantidad",
      ranking: r.map((p: any, i: number) => ({
        puesto: i + 1, producto: p.articuloNombre,
        unidades: num(p.cant), valor: `Bs ${fmtBs(p.valor)}`,
      })),
    };
  },

  // 5. Cuánto gané en un período (ingresos - costo de productos)
  async gananciaPeriodo(periodo: string) {
    const db = await getDb();
    if (!db) return { error: "Sin BD" };
    const { desde, hasta, etiqueta } = rangoFechas(periodo.includes("mes") ? periodo : "mes");
    const rIngreso = rows(await db.execute(sql.raw(
      `SELECT COALESCE(SUM(total),0) as ingreso FROM ventas WHERE fecha >= ${esc(desde)} AND fecha <= ${esc(hasta)}`
    )));
    const rCosto = rows(await db.execute(sql.raw(
      `SELECT COALESCE(SUM(d.cantidad * c.precioCostoUnid),0) as costo
       FROM ventas_detalle d JOIN productos_cache c ON c.nombre = d.articuloNombre
       WHERE d.fecha >= ${esc(desde)} AND d.fecha <= ${esc(hasta)} AND c.precioCostoUnid > 0`
    )));
    const ingreso = num(rIngreso[0]?.ingreso);
    const costo = num(rCosto[0]?.costo);
    const ganancia = ingreso - costo;
    return {
      periodo: etiqueta,
      ingresos: `Bs ${fmtBs(ingreso)}`,
      costoProductos: `Bs ${fmtBs(costo)}`,
      gananciaBruta: `Bs ${fmtBs(ganancia)}`,
      nota: "Ganancia bruta = ventas - costo de productos vendidos (con costo conocido). No descuenta sueldos ni gastos.",
    };
  },

  // 6. Precio y stock de un producto
  async infoProducto(nombre: string) {
    const db = await getDb();
    if (!db) return { error: "Sin BD" };
    const palabras = nombre.trim().split(/\s+/).filter(Boolean);
    const cond = palabras.map(w => `nombre LIKE ${esc("%" + w + "%")}`).join(" AND ");
    const r = rows(await db.execute(sql.raw(
      `SELECT nombre, codigo, precioUno, precioCostoUnid, nombreProveedor
       FROM productos_cache WHERE ${cond} LIMIT 5`
    )));
    if (r.length === 0) return { mensaje: `No encontré un producto que coincida con "${nombre}".` };
    return {
      productos: r.map((p: any) => ({
        nombre: p.nombre, codigo: p.codigo,
        precioVenta: `Bs ${fmtBs(p.precioUno)}`,
        precioCosto: `Bs ${fmtBs(p.precioCostoUnid)}`,
        proveedor: p.nombreProveedor || "no especificado",
      })),
      nota: "El stock en tiempo real se consulta en inventarios365, no está en estos datos.",
    };
  },

  // 7. Productos vendidos a un cliente
  async ventasCliente(cliente: string, periodo?: string) {
    const db = await getDb();
    if (!db) return { error: "Sin BD" };
    const { desde, hasta, etiqueta } = periodo ? rangoFechas(periodo) : { desde: "2000-01-01", hasta: "2099-12-31", etiqueta: "todo el historial" };
    const r = rows(await db.execute(sql.raw(
      `SELECT d.articuloNombre, SUM(d.cantidad) as cant, SUM(d.subtotal) as valor
       FROM ventas_detalle d JOIN ventas v ON v.id = d.ventaId
       WHERE v.razonSocialCliente LIKE ${esc("%" + cliente + "%")}
       AND d.fecha >= ${esc(desde)} AND d.fecha <= ${esc(hasta)}
       GROUP BY d.articuloNombre ORDER BY cant DESC LIMIT 20`
    )));
    if (r.length === 0) return { mensaje: `No encontré ventas al cliente "${cliente}" en ${etiqueta}.` };
    return {
      cliente, periodo: etiqueta,
      productos: r.map((p: any) => ({ producto: p.articuloNombre, unidades: num(p.cant), valor: `Bs ${fmtBs(p.valor)}` })),
    };
  },

  // 8. Quién está en una sucursal (trabajadores con sucursalFija)
  async trabajadoresSucursal(sucursal: string) {
    const db = await getDb();
    if (!db) return { error: "Sin BD" };
    const r = rows(await db.execute(sql.raw(
      `SELECT nombre, sucursalFija, tipoTrabajador FROM trabajadores
       WHERE activo=1 AND sucursalFija LIKE ${esc("%" + sucursal + "%")}`
    )));
    if (r.length === 0) return { mensaje: `No encontré trabajadores asignados a la sucursal "${sucursal}".` };
    return { sucursal, trabajadores: r.map((t: any) => ({ nombre: t.nombre, tipo: t.tipoTrabajador })) };
  },

  // 9. Lista de sucursales disponibles (apoyo)
  async listarSucursales() {
    const db = await getDb();
    if (!db) return { error: "Sin BD" };
    const r = rows(await db.execute(sql.raw(
      `SELECT DISTINCT nombreSucursal FROM ventas WHERE nombreSucursal IS NOT NULL`
    )));
    return { sucursales: r.map((s: any) => s.nombreSucursal) };
  },
};
