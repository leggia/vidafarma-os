// Lógica PURA del libro de psicotrópicos (testeable sin BD).
// El corazón legal del informe: saldo anterior + ingresos − egresos = saldo actual.

export type MovimientoPsico = {
  fecha: string;          // YYYY-MM-DD
  tipo: "ingreso" | "egreso";
  cantidad: number;
  recetaNumero?: string;
  paciente?: string;
  medico?: string;
  numFactura?: string;
};

export type LineaLibro = {
  fecha: string;
  ingreso: number;
  egreso: number;
  saldoAnterior: number;
  saldoActual: number;
  recetaNumero?: string;
  paciente?: string;
  medico?: string;
  numFactura?: string;
};

/**
 * Construye el libro de movimientos de UN producto en orden cronológico,
 * arrastrando el saldo. saldoInicial = saldo al comienzo del período.
 */
export function construirLibro(saldoInicial: number, movimientos: MovimientoPsico[]): { lineas: LineaLibro[]; totalIngreso: number; totalEgreso: number; saldoFinal: number } {
  const ordenados = [...movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  let saldo = saldoInicial;
  let totalIngreso = 0, totalEgreso = 0;
  const lineas: LineaLibro[] = ordenados.map((m) => {
    const ingreso = m.tipo === "ingreso" ? Math.max(0, m.cantidad) : 0;
    const egreso = m.tipo === "egreso" ? Math.max(0, m.cantidad) : 0;
    const saldoAnterior = saldo;
    saldo = saldo + ingreso - egreso;
    totalIngreso += ingreso;
    totalEgreso += egreso;
    return {
      fecha: m.fecha, ingreso, egreso, saldoAnterior, saldoActual: saldo,
      recetaNumero: m.recetaNumero, paciente: m.paciente, medico: m.medico, numFactura: m.numFactura,
    };
  });
  return { lineas, totalIngreso, totalEgreso, saldoFinal: saldo };
}

/**
 * Resumen de un período para el informe (trimestral/semestral/anual): una fila
 * por producto con ingreso, egreso, saldo anterior y saldo actual del período.
 */
export function resumenPeriodo(saldoInicial: number, movimientos: MovimientoPsico[]): { ingreso: number; egreso: number; saldoAnterior: number; saldoActual: number; sinMovimiento: boolean } {
  const { totalIngreso, totalEgreso, saldoFinal } = construirLibro(saldoInicial, movimientos);
  return {
    ingreso: totalIngreso, egreso: totalEgreso,
    saldoAnterior: saldoInicial, saldoActual: saldoFinal,
    sinMovimiento: totalIngreso === 0 && totalEgreso === 0,
  };
}

// Rango de fechas de un trimestre (1..4) de un año → [desde, hasta) exclusivo.
export function rangoTrimestre(anio: number, trimestre: number): { desde: string; hasta: string } {
  const mesInicio = (trimestre - 1) * 3; // 0,3,6,9
  const desde = new Date(anio, mesInicio, 1);
  const hasta = new Date(anio, mesInicio + 3, 1);
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { desde: f(desde), hasta: f(hasta) };
}
