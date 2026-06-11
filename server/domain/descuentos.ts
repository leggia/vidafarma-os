/**
 * Dominio: Descuentos en cascada de laboratorios farmacéuticos.
 * Lógica PURA (sin IO) — fácil de testear y reutilizar.
 *
 * Los laboratorios bolivianos (Bagó, Inti, etc.) aplican hasta 3 niveles:
 *  1. Comercial por producto (por línea, variable)
 *  2. Por volumen (global, ~2%)
 *  3. Por pago efectivo/contado (global, ~3%)
 */

export interface LineaCompra {
  precioLista: number;
  cantidad: number;
  descuentoComercial?: number; // monto en Bs descontado en esa línea
}

export interface DescuentosGlobales {
  pctVolumen?: number;  // ej. 2 = 2%
  pctEfectivo?: number; // ej. 3 = 3%
}

export interface ResultadoDescuento {
  subtotal: number;            // suma de líneas con descuento comercial aplicado
  descuentoGlobalBs: number;   // total de descuentos globales en Bs
  descuentoGlobalPct: number;  // % efectivo combinado sobre el subtotal
  totalFinal: number;          // lo que realmente se paga
  costoUnitarioPorLinea: number[]; // costo unitario real de cada línea (con todo el descuento)
}

const redondear = (n: number, dec = 2) => Math.round(n * 10 ** dec) / 10 ** dec;

/**
 * Calcula el total final aplicando descuentos en cascada y distribuye
 * el descuento global proporcionalmente en el costo unitario de cada línea.
 */
export function calcularDescuentosCascada(
  lineas: LineaCompra[],
  globales: DescuentosGlobales = {}
): ResultadoDescuento {
  // 1. Subtotal de cada línea (con su descuento comercial)
  const subtotalesLinea = lineas.map(
    (l) => l.precioLista * l.cantidad - (l.descuentoComercial ?? 0)
  );
  const subtotal = redondear(subtotalesLinea.reduce((s, v) => s + v, 0));

  // 2. Cascada global: primero volumen, luego efectivo
  const fVolumen = 1 - (globales.pctVolumen ?? 0) / 100;
  const fEfectivo = 1 - (globales.pctEfectivo ?? 0) / 100;
  const totalFinal = redondear(subtotal * fVolumen * fEfectivo);

  const descuentoGlobalBs = redondear(subtotal - totalFinal);
  const descuentoGlobalPct = subtotal > 0 ? redondear((descuentoGlobalBs / subtotal) * 100) : 0;

  // 3. Distribuir el descuento global en el costo unitario de cada línea
  const factorGlobal = subtotal > 0 ? totalFinal / subtotal : 1;
  const costoUnitarioPorLinea = lineas.map((l, i) => {
    const subLinea = subtotalesLinea[i];
    const subLineaConGlobal = subLinea * factorGlobal;
    return l.cantidad > 0 ? redondear(subLineaConGlobal / l.cantidad, 4) : 0;
  });

  return { subtotal, descuentoGlobalBs, descuentoGlobalPct, totalFinal, costoUnitarioPorLinea };
}

/**
 * Verifica si el total calculado cuadra con el total impreso en la factura.
 * Tolerancia por defecto: 1 Bs (redondeos del POS).
 */
export function cuadraConTotal(totalCalculado: number, totalFactura: number, tolerancia = 1): boolean {
  return Math.abs(totalCalculado - totalFactura) <= tolerancia;
}
