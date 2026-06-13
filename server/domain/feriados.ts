/**
 * Dominio: Feriados de Bolivia (nacionales) + Cochabamba.
 * Lógica PURA (sin IO).
 *
 * Incluye feriados de fecha fija (se repiten cada año) y los principales
 * feriados móviles de años conocidos (Carnaval, Viernes Santo, Corpus Christi,
 * que dependen de la Pascua). Para años sin datos móviles, se aplican solo los fijos.
 */

// Feriados de FECHA FIJA (mismo día cada año). Formato "MM-DD".
// Nacionales de Bolivia + departamental de Cochabamba (14 de septiembre).
const FERIADOS_FIJOS: Record<string, string> = {
  "01-01": "Año Nuevo",
  "01-22": "Estado Plurinacional",
  "05-01": "Día del Trabajador",
  "06-21": "Año Nuevo Andino",
  "08-06": "Independencia de Bolivia",
  "09-14": "Gesta Libertaria de Cochabamba", // departamental Cochabamba
  "11-02": "Día de los Difuntos",
  "12-25": "Navidad",
};

// Feriados MÓVILES por año (dependen de la Pascua). Formato "YYYY-MM-DD".
// Se agregan los años conocidos; para otros años solo se aplican los fijos.
const FERIADOS_MOVILES: Record<string, string> = {
  // 2026 (según calendario oficial)
  "2026-02-16": "Carnaval",
  "2026-02-17": "Carnaval",
  "2026-04-03": "Viernes Santo",
  "2026-06-04": "Corpus Christi",
  // 2025 (referencia)
  "2025-03-03": "Carnaval",
  "2025-03-04": "Carnaval",
  "2025-04-18": "Viernes Santo",
  "2025-06-19": "Corpus Christi",
  // 2027
  "2027-02-08": "Carnaval",
  "2027-02-09": "Carnaval",
  "2027-03-26": "Viernes Santo",
  "2027-05-27": "Corpus Christi",
};

/**
 * Devuelve el nombre del feriado si la fecha lo es, o null.
 * @param fecha "YYYY-MM-DD"
 */
export function nombreFeriado(fecha: string): string | null {
  if (!fecha || fecha.length < 10) return null;
  const mmdd = fecha.slice(5, 10); // "MM-DD"
  if (FERIADOS_FIJOS[mmdd]) return FERIADOS_FIJOS[mmdd];
  if (FERIADOS_MOVILES[fecha]) return FERIADOS_MOVILES[fecha];
  return null;
}

export function esFeriado(fecha: string): boolean {
  return nombreFeriado(fecha) !== null;
}

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/**
 * Devuelve el nombre del día de la semana de una fecha "YYYY-MM-DD".
 * Se calcula sin zona horaria para evitar desfases.
 */
export function nombreDiaSemana(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  if (!a || !m || !d) return "";
  const dt = new Date(Date.UTC(a, m - 1, d));
  return DIAS_SEMANA[dt.getUTCDay()];
}

/**
 * Formatea una fecha como "Lunes 21/04/2026".
 */
export function formatearFechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split("-");
  if (!a || !m || !d) return fecha;
  return `${nombreDiaSemana(fecha)} ${d}/${m}/${a}`;
}

/**
 * Clasifica el tipo de día: feriado, domingo o normal.
 */
export function tipoDia(fecha: string): "feriado" | "domingo" | "normal" {
  if (esFeriado(fecha)) return "feriado";
  const [a, m, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCDay() === 0) return "domingo";
  return "normal";
}
