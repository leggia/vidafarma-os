// Cuadre de líneas de factura — lógica PURA compartida entre cliente y servidor.
// Vive en shared/ porque la usan la pantalla de Nueva Compra (para sugerir el
// precio o la cantidad que cuadra) y los smoke tests del servidor (para que este
// cálculo de dinero nunca se rompa en silencio).

/**
 * Cuadre de una línea contra el total que realmente cobra la factura.
 * Si al corregir la cantidad (o el precio) la línea deja de dar el total del
 * proveedor, sugiere el valor que la hace cuadrar. Devuelve null si ya cuadra.
 * Tolerancia de 2 centavos (redondeos del proveedor).
 */
export type SugerenciaCuadre = { calculado: number; totalFactura: number; precioSugerido: number | null; cantidadSugerida: number | null };
export function sugerenciaCuadre(cantidad: number, precioUnit: number, totalFactura: number | null | undefined): SugerenciaCuadre | null {
  if (totalFactura == null || !(totalFactura > 0)) return null;
  const calculado = Math.round((cantidad || 0) * (precioUnit || 0) * 100) / 100;
  if (Math.abs(calculado - totalFactura) <= 0.02) return null; // ya cuadra
  const precioSugerido = cantidad > 0 ? Math.round((totalFactura / cantidad) * 10000) / 10000 : null;
  // La cantidad solo se sugiere si da un entero exacto: media unidad no existe.
  let cantidadSugerida: number | null = null;
  if (precioUnit > 0) {
    const c = Math.round(totalFactura / precioUnit);
    if (c > 0 && Math.abs(c * precioUnit - totalFactura) <= 0.02) cantidadSugerida = c;
  }
  return { calculado, totalFactura, precioSugerido, cantidadSugerida };
}
