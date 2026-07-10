// Emparejado DIFUSO de nombres de productos (puro, sin dependencias, testeable).
// Problema que resuelve: las listas de transferencia se escriben A MANO y cada
// trabajadora tiene su letra — la visión IA transcribe con variaciones
// ("parasetamol", "Amoxi 500", "ibup 400"). Este motor encuentra el producto REAL
// del catálogo aunque el nombre venga imperfecto, con un puntaje de confianza.
//
// Técnica: combinación de solapamiento de TOKENS (palabras/números, con prefijos)
// y similitud de BIGRAMAS (coeficiente de Dice) — robusta a errores de ortografía,
// abreviaciones y orden distinto de palabras.

const normalizar = (s: string) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // sin tildes
    .replace(/[^a-z0-9ñ\s.,]/g, " ")
    .replace(/(\d+)[.,](\d+)/g, "$1$2") // 0.5 → 05 (dosis)
    .replace(/\s+/g, " ")
    .trim();

const tokens = (s: string) => normalizar(s).split(" ").filter((t) => t.length > 0);

// Bigramas de caracteres de una cadena sin espacios
function bigramas(s: string): Map<string, number> {
  const limpio = normalizar(s).replace(/\s/g, "");
  const m = new Map<string, number>();
  for (let i = 0; i < limpio.length - 1; i++) {
    const b = limpio.slice(i, i + 2);
    m.set(b, (m.get(b) || 0) + 1);
  }
  return m;
}

// Coeficiente de Dice entre bigramas (0..1) — tolera errores de ortografía
function similitudDice(a: string, b: string): number {
  const ba = bigramas(a), bb = bigramas(b);
  if (ba.size === 0 || bb.size === 0) return 0;
  let inter = 0, totA = 0, totB = 0;
  for (const [, n] of ba) totA += n;
  for (const [, n] of bb) totB += n;
  for (const [big, n] of ba) inter += Math.min(n, bb.get(big) || 0);
  return (2 * inter) / (totA + totB);
}

// COBERTURA de los bigramas de la consulta dentro del candidato (recall, 0..1).
// A diferencia de Dice, un candidato LARGO del catálogo no penaliza: importa cuánto
// de lo escrito a mano está contenido en el nombre real.
function coberturaBigramas(consulta: string, candidato: string): number {
  const bq = bigramas(consulta), bc = bigramas(candidato);
  if (bq.size === 0) return 0;
  let inter = 0, totQ = 0;
  for (const [, n] of bq) totQ += n;
  for (const [big, n] of bq) inter += Math.min(n, bc.get(big) || 0);
  return inter / totQ;
}

const soloDigitos = (t: string) => t.replace(/\D/g, "");

// Solapamiento de tokens con tolerancia manuscrita. Un token de la consulta casa si:
//   1. es igual a un token del catálogo, o
//   2. sus DÍGITOS coinciden ("500" ↔ "500mg", "05" ↔ "0.5g" ya normalizado), o
//   3. es prefijo/extensión (≥4 chars): "amoxi"→"amoxicilina", "ibup"→"ibuprofeno", o
//   4. se parece por bigramas (Dice ≥ 0.7): "parasetamol"≈"paracetamol",
//      "omeprasol"≈"omeprazol" — errores de ortografía al leer letra a mano.
function solapamientoTokens(consulta: string, candidato: string): number {
  const tq = tokens(consulta), tc = tokens(candidato);
  if (tq.length === 0) return 0;
  let hits = 0;
  for (const q of tq) {
    const dq = soloDigitos(q);
    const match = tc.some((c) => {
      if (c === q) return true;
      if (dq.length > 0 && dq === soloDigitos(c)) return true;
      if (q.length >= 4 && c.startsWith(q)) return true;
      if (c.length >= 4 && q.startsWith(c)) return true;
      if (q.length >= 5 && c.length >= 5 && similitudDice(q, c) >= 0.7) return true;
      return false;
    });
    if (match) hits++;
  }
  return hits / tq.length;
}

export type Candidato = { nombre: string; puntaje: number; confianza: "alta" | "media" | "baja" };

// Puntaje combinado 0..1
export function puntuarCandidato(consulta: string, nombreCatalogo: string): number {
  const tok = solapamientoTokens(consulta, nombreCatalogo);
  const cob = coberturaBigramas(consulta, nombreCatalogo);
  // Los tokens pesan más (dosis y abreviaciones); la cobertura rescata ortografía
  // sin que el largo del nombre del catálogo penalice.
  return Math.min(1, tok * 0.7 + cob * 0.4);
}

// Mejores N candidatos del catálogo para una consulta manuscrita.
export function mejoresCandidatos(
  consulta: string,
  catalogo: string[],
  n = 3
): Candidato[] {
  const puntuados = catalogo
    .map((nombre) => ({ nombre, puntaje: puntuarCandidato(consulta, nombre) }))
    .filter((c) => c.puntaje >= 0.4)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, n);
  return puntuados.map((c) => ({
    ...c,
    confianza: c.puntaje >= 0.78 ? "alta" : c.puntaje >= 0.58 ? "media" : "baja",
  }));
}
