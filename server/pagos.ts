// Módulo de PAGOS QR con arquitectura ENCHUFABLE (Company of One: preparar la
// infraestructura hoy, activar el banco cuando lleguen las credenciales).
//
// El proveedor de QR (BNB "QR Simple", OpenBCB, etc.) se conecta mediante variables
// de entorno. Mientras no haya credenciales, el sistema funciona en modo "manual":
// muestra los datos de pago y el cliente sube su comprobante. Cuando se configuran
// las credenciales del banco, el mismo flujo pasa a QR dinámico + confirmación
// automática por webhook, sin cambiar nada del resto de la app.
import { getDb } from "./db";
import { sql } from "drizzle-orm";

const rows = (r: any) => { const x = Array.isArray(r) ? r[0] : r?.rows ?? r; return Array.isArray(x) ? x : []; };
const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };

// ¿Está configurado un proveedor de QR automático?
export function proveedorQR(): "bnb" | "openbcb" | null {
  if (process.env.BNB_QR_CLIENT_ID && process.env.BNB_QR_CLIENT_SECRET) return "bnb";
  if (process.env.OPENBCB_API_KEY) return "openbcb";
  return null;
}
export const pagoAutomaticoDisponible = () => proveedorQR() !== null;

let tablasListas = false;
async function asegurarTablas() {
  if (tablasListas) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS pagos_qr (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reservaId INT,
      codigoReserva VARCHAR(12),
      monto DECIMAL(12,2) NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      proveedor VARCHAR(20),
      qrExternoId VARCHAR(100),
      qrImagen MEDIUMTEXT,
      comprobanteUrl VARCHAR(600),
      pagadoEn DATETIME,
      creadoEn DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pqr_reserva (reservaId), INDEX idx_pqr_estado (estado), INDEX idx_pqr_ext (qrExternoId)
    )`));
  } catch { /* ya existe */ }
  try { await db.execute(sql.raw("ALTER TABLE reservas_tienda ADD COLUMN estadoPago VARCHAR(20) NOT NULL DEFAULT 'no_pagado'")); } catch { /* ya existe */ }
  tablasListas = true;
}

// ─── Conectores de proveedor (se completan al tener credenciales) ───
// Cada conector recibe monto + referencia y devuelve { qrImagen, qrExternoId }.

async function generarQR_BNB(monto: number, referencia: string): Promise<{ qrImagen: string; qrExternoId: string } | null> {
  // Estructura lista para el API Market del BNB (QR Simple). Endpoints reales:
  //   POST {BNB_QR_BASE}/api/v1/auth/token           -> token (cachear)
  //   POST {BNB_QR_BASE}/api/v1/main/getQRWithImageAsync -> { id, qr (base64) }
  // Se activa cuando existan BNB_QR_CLIENT_ID / BNB_QR_CLIENT_SECRET.
  try {
    const base = process.env.BNB_QR_BASE_URL || "https://marketapi.bnb.com.bo";
    const tokenResp = await fetch(`${base}/api/v1/auth/token`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: process.env.BNB_QR_CLIENT_ID, authorizationId: process.env.BNB_QR_CLIENT_SECRET }),
    });
    if (!tokenResp.ok) throw new Error(`token ${tokenResp.status}`);
    const { message: token } = await tokenResp.json() as any;
    const vence = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
    const qrResp = await fetch(`${base}/api/v1/main/getQRWithImageAsync`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currency: "BOB", gloss: referencia, amount: monto, singleUse: true, expirationDate: vence }),
    });
    if (!qrResp.ok) throw new Error(`qr ${qrResp.status}`);
    const data = await qrResp.json() as any;
    return { qrImagen: data.qr || data.image || "", qrExternoId: String(data.id || data.qrId || "") };
  } catch (e: any) {
    console.error("[Pagos] BNB QR falló:", e?.message);
    return null;
  }
}

async function generarQR_OpenBCB(monto: number, referencia: string): Promise<{ qrImagen: string; qrExternoId: string } | null> {
  try {
    const base = process.env.OPENBCB_BASE_URL || "https://openbcb.bcb.gob.bo";
    const resp = await fetch(`${base}/api/qr/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.OPENBCB_API_KEY || "" },
      body: JSON.stringify({ amount: monto, reference: referencia, currency: "BOB" }),
    });
    if (!resp.ok) throw new Error(`openbcb ${resp.status}`);
    const data = await resp.json() as any;
    return { qrImagen: data.qrImage || data.qr || "", qrExternoId: String(data.operationId || data.id || "") };
  } catch (e: any) {
    console.error("[Pagos] OpenBCB QR falló:", e?.message);
    return null;
  }
}

// ─── API pública ───
/**
 * SEGURIDAD — Verifica que quien opera sobre una reserva sea su dueño.
 * Sin esto, los endpoints públicos de pago sufren IDOR: cualquiera podría pasar
 * un reservaId ajeno (son correlativos: 1, 2, 3…) y ver el estado de pago de
 * otro cliente, generar su QR o —lo más grave— subir un "comprobante" a la
 * reserva de otro para que el personal la dé por pagada.
 *
 * Se acepta como prueba de propiedad:
 *  a) el email del usuario logueado coincide con el de la reserva, o
 *  b) el CÓDIGO de la reserva (lo tiene el cliente en pantalla y en su mensaje).
 * El código es corto (VF-XXXX) y por sí solo sería adivinable, pero exige
 * acertar código Y id a la vez, y no reemplaza al email cuando este existe.
 */
async function esDuenoDeReserva(db: any, reservaId: number, email?: string | null, codigo?: string | null): Promise<boolean> {
  const r = rows(await db.execute(sql`SELECT emailCliente, codigo FROM reservas_tienda WHERE id = ${num(reservaId)} LIMIT 1`))[0];
  if (!r) return false;
  const { esDueno } = await import("../shared/propiedad");
  return esDueno({ emailCliente: r.emailCliente, codigo: r.codigo }, { email, codigo });
}

export const pagos = {
  // Iniciar el pago de una reserva: genera QR (si hay proveedor) o devuelve modo manual.
  async iniciarPagoReserva(reservaId: number, auth?: { email?: string | null; codigo?: string | null }) {
    await asegurarTablas();
    const db = await getDb();
    if (!db) return { error: "Servicio no disponible." };
    // Generar el QR de pago de una reserva ajena no roba dinero, pero filtra que
    // la reserva existe y su monto: se exige la misma prueba de propiedad.
    if (!(await esDuenoDeReserva(db, reservaId, auth?.email, auth?.codigo))) {
      return { error: "No se pudo verificar que esta reserva sea tuya." };
    }
    const res = rows(await db.execute(sql`
      SELECT id, codigo, precio, estadoPago FROM reservas_tienda WHERE id = ${num(reservaId)} LIMIT 1
    `))[0];
    if (!res) return { error: "Reserva no encontrada." };
    if (res.estadoPago === "pagado") return { yaPagado: true, mensaje: "Esta reserva ya está pagada." };
    const monto = num(res.precio);
    if (monto <= 0) return { error: "Monto inválido." };

    // ¿Ya hay un QR pendiente para esta reserva? Reutilizar.
    const existente = rows(await db.execute(sql`
      SELECT qrImagen, estado FROM pagos_qr WHERE reservaId = ${num(reservaId)} AND estado = 'pendiente' ORDER BY id DESC LIMIT 1
    `))[0];
    if (existente && existente.qrImagen) {
      return { modo: "qr", qrImagen: existente.qrImagen, monto, codigo: res.codigo };
    }

    const prov = proveedorQR();
    if (prov) {
      const ref = `VidaFarma ${res.codigo}`;
      const qr = prov === "bnb" ? await generarQR_BNB(monto, ref) : await generarQR_OpenBCB(monto, ref);
      if (qr && qr.qrImagen) {
        await db.execute(sql`
          INSERT INTO pagos_qr (reservaId, codigoReserva, monto, estado, proveedor, qrExternoId, qrImagen)
          VALUES (${num(reservaId)}, ${res.codigo}, ${monto}, 'pendiente', ${prov}, ${qr.qrExternoId}, ${qr.qrImagen})
        `);
        return { modo: "qr", qrImagen: qr.qrImagen, monto, codigo: res.codigo };
      }
      // Si el proveedor falla, caer a modo manual (no bloquear la venta)
    }

    // Modo MANUAL (sin proveedor o si falló): datos de pago + subir comprobante.
    await db.execute(sql`
      INSERT INTO pagos_qr (reservaId, codigoReserva, monto, estado, proveedor)
      VALUES (${num(reservaId)}, ${res.codigo}, ${monto}, 'pendiente', 'manual')
    `);
    return {
      modo: "manual", monto, codigo: res.codigo,
      datosPago: {
        titular: process.env.PAGO_TITULAR || "VidaFarma",
        banco: process.env.PAGO_BANCO || "",
        cuenta: process.env.PAGO_CUENTA || "",
        qrEstatico: process.env.PAGO_QR_ESTATICO_URL || null, // imagen de QR fijo del banco, si la subes
      },
      mensaje: "Escanea el QR o transfiere el monto exacto, y sube tu comprobante.",
    };
  },

  // Cliente sube el comprobante (modo manual). Queda para que el staff verifique.
  async subirComprobante(reservaId: number, comprobanteUrl: string, auth?: { email?: string | null; codigo?: string | null }) {
    await asegurarTablas();
    const db = await getDb();
    if (!db) return { error: "Sin BD" };
    // Sin esta verificación, cualquiera podría subir un comprobante a la reserva
    // de otro cliente y lograr que el personal la dé por pagada.
    if (!(await esDuenoDeReserva(db, reservaId, auth?.email, auth?.codigo))) {
      return { error: "No se pudo verificar que esta reserva sea tuya." };
    }
    await db.execute(sql`
      UPDATE pagos_qr SET comprobanteUrl = ${String(comprobanteUrl).slice(0, 600)}, estado = 'por_verificar'
      WHERE reservaId = ${num(reservaId)} AND estado = 'pendiente'
    `);
    await db.execute(sql`UPDATE reservas_tienda SET estadoPago = 'por_verificar' WHERE id = ${num(reservaId)}`);
    return { ok: true, mensaje: "Comprobante recibido. Verificaremos tu pago y prepararemos tu pedido." };
  },

  // Webhook del banco: marca el pago como confirmado automáticamente.
  // El banco llama a POST /api/pagos/webhook con el id externo del QR.
  async confirmarPagoWebhook(qrExternoId: string, montoPagado?: number) {
    await asegurarTablas();
    const db = await getDb();
    if (!db) return { ok: false };
    const pago = rows(await db.execute(sql`
      SELECT id, reservaId, monto FROM pagos_qr WHERE qrExternoId = ${String(qrExternoId)} AND estado = 'pendiente' LIMIT 1
    `))[0];
    if (!pago) return { ok: false, motivo: "QR no encontrado o ya procesado" };
    await db.execute(sql`UPDATE pagos_qr SET estado = 'pagado', pagadoEn = NOW() WHERE id = ${pago.id}`);
    if (pago.reservaId) {
      await db.execute(sql`UPDATE reservas_tienda SET estadoPago = 'pagado' WHERE id = ${pago.reservaId}`);
      // Otorgar puntos de una vez (el pago confirma la compra)
      try { const { otorgarPuntosPorReserva } = await import("./puntos-fidelidad"); await otorgarPuntosPorReserva(num(pago.reservaId)); } catch { /* no bloquear */ }
    }
    return { ok: true };
  },

  // Staff: confirmar manualmente un pago (tras revisar el comprobante).
  async confirmarPagoManual(reservaId: number) {
    await asegurarTablas();
    const db = await getDb();
    if (!db) return { error: "Sin BD" };
    await db.execute(sql`UPDATE pagos_qr SET estado = 'pagado', pagadoEn = NOW() WHERE reservaId = ${num(reservaId)} AND estado IN ('pendiente','por_verificar')`);
    await db.execute(sql`UPDATE reservas_tienda SET estadoPago = 'pagado' WHERE id = ${num(reservaId)}`);
    return { ok: true };
  },

  // Estado de pago de una reserva (para la tienda)
  async estadoPago(reservaId: number, auth?: { email?: string | null; codigo?: string | null }) {
    await asegurarTablas();
    const db = await getDb();
    if (!db) return { estado: "no_pagado" };
    // El estado de pago de una reserva es dato del cliente: no se expone a
    // cualquiera que adivine un id correlativo.
    if (!(await esDuenoDeReserva(db, reservaId, auth?.email, auth?.codigo))) {
      return { estado: "no_pagado", error: "No se pudo verificar que esta reserva sea tuya." };
    }
    const r = rows(await db.execute(sql`SELECT estadoPago FROM reservas_tienda WHERE id = ${num(reservaId)} LIMIT 1`))[0];
    return { estado: r?.estadoPago || "no_pagado", pagoAutomatico: pagoAutomaticoDisponible() };
  },
};
