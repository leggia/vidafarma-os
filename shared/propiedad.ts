// Verificación de PROPIEDAD de una reserva — lógica pura y compartida.
// Vive aparte y testeada porque protege un endpoint PÚBLICO: si esta comparación
// se rompe, cualquiera podría operar sobre la reserva de otro cliente (IDOR).

/**
 * ¿Quien opera es dueño de la reserva? Se acepta el email del usuario logueado o
 * el código de la reserva (que el cliente tiene en pantalla).
 * Ojo: los vacíos NUNCA autorizan — si la reserva no tiene email y no se manda
 * email, eso no puede contar como coincidencia.
 */
export function esDueno(
  reserva: { emailCliente?: string | null; codigo?: string | null },
  prueba: { email?: string | null; codigo?: string | null }
): boolean {
  const emailR = String(reserva.emailCliente || "").trim().toLowerCase();
  const emailP = String(prueba.email || "").trim().toLowerCase();
  if (emailR && emailP && emailR === emailP) return true;
  const codR = String(reserva.codigo || "").trim().toUpperCase();
  const codP = String(prueba.codigo || "").trim().toUpperCase();
  if (codR && codP && codR === codP) return true;
  return false;
}
