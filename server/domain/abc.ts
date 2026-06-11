/**
 * Dominio: Clasificación ABC de inventario (análisis de Pareto 80/15/5).
 * Lógica PURA (sin IO).
 *
 * Clase A: ~80% del valor acumulado (alto valor/rotación)
 * Clase B: siguiente ~15%
 * Clase C: último ~5%
 */

export interface ItemABC {
  stock: number;
  costoUnit: number;
  valorStock: number;
}

export type Clase = "A" | "B" | "C";

export interface ResultadoABC<T> {
  items: Array<T & { clase: Clase }>;
  resumen: {
    total: number;
    valorTotal: number;
    claseA: number;
    claseB: number;
    claseC: number;
    criterio: "valor" | "cantidad";
  };
}

const redondear = (n: number, dec = 2) => Math.round(n * 10 ** dec) / 10 ** dec;

/**
 * Clasifica items por ABC. Si hay costo usa el valor (stock×costo);
 * si no, usa la cantidad de stock como aproximación de importancia.
 */
export function clasificarABC<T extends ItemABC>(items: T[]): ResultadoABC<T> {
  const hayCosto = items.some((p) => p.costoUnit > 0);
  const criterio = (p: ItemABC) => (hayCosto ? p.valorStock : p.stock);

  const ordenados = [...items].sort((a, b) => criterio(b) - criterio(a));
  const valorTotal = ordenados.reduce((acc, p) => acc + criterio(p), 0);

  let acumulado = 0;
  const conClase = ordenados.map((p, i) => {
    const antes = acumulado;
    acumulado += criterio(p);
    // Usar el punto MEDIO del rango que ocupa el item para clasificar,
    // así un primer item muy grande no cae automáticamente fuera de A.
    const pctMedio = valorTotal > 0 ? ((antes + acumulado) / 2 / valorTotal) * 100 : 0;
    const clase: Clase = i === 0 || pctMedio <= 80 ? "A" : pctMedio <= 95 ? "B" : "C";
    return { ...p, clase };
  });

  return {
    items: conClase,
    resumen: {
      total: conClase.length,
      valorTotal: redondear(items.reduce((acc, p) => acc + p.valorStock, 0)),
      claseA: conClase.filter((p) => p.clase === "A").length,
      claseB: conClase.filter((p) => p.clase === "B").length,
      claseC: conClase.filter((p) => p.clase === "C").length,
      criterio: hayCosto ? "valor" : "cantidad",
    },
  };
}
