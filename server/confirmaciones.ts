/**
 * Sistema de Confirmaciones Aprendidas — usando MySQL
 * Persiste aunque el Codespace se reinicie
 */

import { getDb } from "./db";
import { confirmaciones as confirmacionesTable } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { ArticuloAPI } from "./inventarios365";

class ConfirmacionesService {

  private normalizar(s: string): string {
    return s.toUpperCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar tildes
      .replace(/[.,;:()\[\]]/g, " ")                      // puntuación → espacio
      .replace(/\bX\s*\d+\b/g, " ")                        // quitar "x10", "x 100" (presentación)
      .replace(/\b(\d+)\s*(MG|ML|GR|G|MCG|UI|CC)\b/g, "$1$2") // "400 mg" → "400MG" (unir número+unidad)
      .replace(/\b(CAPS?|COMP|TAB|TABL|CPR|JBE|JARABE|SOBRE|GEL|AMP|AMPOLLA|SUSP|GOTAS|CREMA|UNGUENTO|SOL)\b/g, " ") // quitar presentación
      .replace(/\s+/g, " ")                                 // espacios múltiples → uno
      .trim();
  }

  // Similitud entre dos nombres ya normalizados (0 a 1).
  // Tolera variaciones del LLM por mala calidad de foto,
  // pero los NÚMEROS (concentraciones) deben coincidir exactamente.
  private similitud(a: string, b: string): number {
    if (a === b) return 1;
    const tokensA = a.split(" ").filter(t => t.length >= 2);
    const tokensB = b.split(" ").filter(t => t.length >= 2);
    if (tokensA.length === 0 || tokensB.length === 0) return 0;

    // SEGURIDAD: los números/concentraciones deben coincidir exactamente.
    // "IBUPROFENO 400" y "IBUPROFENO 600" son productos DISTINTOS.
    const numerosA = (a.match(/\d+/g) || []).sort();
    const numerosB = (b.match(/\d+/g) || []).sort();
    // Si ambos tienen números, deben ser el mismo conjunto
    if (numerosA.length > 0 || numerosB.length > 0) {
      if (numerosA.join(",") !== numerosB.join(",")) return 0;
    }

    // El primer token (nombre principal) debe coincidir o ser muy parecido
    const principalA = tokensA[0];
    const principalB = tokensB[0];
    const principalMatch = principalA === principalB ||
      this.distanciaLevenshtein(principalA, principalB) <= Math.max(1, Math.floor(principalA.length * 0.2));
    if (!principalMatch) return 0; // si el nombre principal no coincide, no es el mismo producto

    // Contar tokens compartidos (bidireccional). Los números ya se validaron arriba.
    let compartidos = 0;
    for (const t of tokensA) {
      if (/^\d+$/.test(t)) { compartidos++; continue; } // números ya validados
      if (tokensB.some(u => u === t || (!/^\d+$/.test(u) && this.distanciaLevenshtein(t, u) <= 1))) compartidos++;
    }
    const scoreA = compartidos / tokensA.length;
    const scoreB = compartidos / tokensB.length;
    return (scoreA + scoreB) / 2;
  }

  // Distancia de Levenshtein (número de ediciones entre dos strings)
  private distanciaLevenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
        prev = tmp;
      }
    }
    return dp[n];
  }

  async buscar(proveedor: string, nombreFactura: string): Promise<{ id: number; nombreSistema: string; codigo: string } | null> {
    try {
      const db = await getDb();
      if (!db) return null;

      const provNorm = this.normalizar(proveedor);
      const nombreNorm = this.normalizar(nombreFactura);

      const rows = await db.select().from(confirmacionesTable)
        .where(eq(confirmacionesTable.valido, 1));

      // 1. MATCH EXACTO (normalizado) — máxima prioridad
      for (const row of rows) {
        if (
          this.normalizar(row.proveedor) === provNorm &&
          this.normalizar(row.nombreFactura) === nombreNorm
        ) {
          console.log(`[Confirmaciones] ✅ exacto "${nombreFactura}" → "${row.articuloNombre}" (ID:${row.articuloId})`);
          return { id: row.articuloId, nombreSistema: row.articuloNombre, codigo: row.articuloCodigo || "" };
        }
      }

      // 2. MATCH APROXIMADO contra alias del mismo proveedor (tolera mala foto)
      let mejor: { row: any; score: number } | null = null;
      for (const row of rows) {
        if (this.normalizar(row.proveedor) !== provNorm) continue; // mismo proveedor
        const score = this.similitud(nombreNorm, this.normalizar(row.nombreFactura));
        if (score >= 0.7 && (!mejor || score > mejor.score)) {
          mejor = { row, score };
        }
      }
      if (mejor) {
        console.log(`[Confirmaciones] ≈ aproximado "${nombreFactura}" → "${mejor.row.articuloNombre}" (ID:${mejor.row.articuloId}, score:${mejor.score.toFixed(2)})`);
        return { id: mejor.row.articuloId, nombreSistema: mejor.row.articuloNombre, codigo: mejor.row.articuloCodigo || "" };
      }

      return null;
    } catch (error) {
      console.error("[Confirmaciones] Error buscando:", error);
      return null;
    }
  }

  async confirmar(proveedor: string, nombreFactura: string, articulo: ArticuloAPI): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;

      const provNorm = this.normalizar(proveedor);
      const nombreNorm = this.normalizar(nombreFactura);
      const MAX_ALIAS = 4;

      const todas = await db.select().from(confirmacionesTable);

      // 1. ¿Existe ESTE nombre exacto (normalizado)? → actualizar
      const exacta = todas.find(row =>
        this.normalizar(row.proveedor) === provNorm &&
        this.normalizar(row.nombreFactura) === nombreNorm
      );
      if (exacta) {
        await db.update(confirmacionesTable)
          .set({ articuloId: articulo.id, articuloNombre: articulo.nombre, articuloCodigo: articulo.codigo, valido: 1 })
          .where(eq(confirmacionesTable.id, exacta.id));
        console.log(`[Confirmaciones] 🔄 Actualizado alias "${nombreFactura}" → "${articulo.nombre}" (ID:${articulo.id})`);
        return;
      }

      // 2. Es una VARIACIÓN nueva: ver cuántos alias ya tiene este producto (mismo proveedor + mismo articuloId)
      const aliasDelProducto = todas.filter(row =>
        this.normalizar(row.proveedor) === provNorm &&
        row.articuloId === articulo.id
      );

      if (aliasDelProducto.length >= MAX_ALIAS) {
        // Ya alcanzó el límite: reemplazar el más antiguo (menor id)
        const masAntiguo = aliasDelProducto.reduce((a, b) => (a.id < b.id ? a : b));
        await db.update(confirmacionesTable)
          .set({ nombreFactura, articuloNombre: articulo.nombre, articuloCodigo: articulo.codigo, valido: 1 })
          .where(eq(confirmacionesTable.id, masAntiguo.id));
        console.log(`[Confirmaciones] ♻️ Alias reemplazado (límite ${MAX_ALIAS}): "${nombreFactura}" → "${articulo.nombre}"`);
      } else {
        // Agregar como nuevo alias
        await db.insert(confirmacionesTable).values({
          proveedor, nombreFactura,
          articuloId: articulo.id, articuloNombre: articulo.nombre, articuloCodigo: articulo.codigo,
          valido: 1,
        });
        console.log(`[Confirmaciones] 💾 Nuevo alias ${aliasDelProducto.length + 1}/${MAX_ALIAS}: "${nombreFactura}" → "${articulo.nombre}" (ID:${articulo.id})`);
      }
    } catch (error) {
      console.error("[Confirmaciones] Error guardando:", error);
    }
  }

  async invalidar(proveedor: string, nombreFactura: string): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;
      await db.update(confirmacionesTable)
        .set({ valido: 0 })
        .where(and(
          eq(confirmacionesTable.proveedor, proveedor),
          eq(confirmacionesTable.nombreFactura, nombreFactura)
        ));
      console.log(`[Confirmaciones] ❌ Invalidado: "${nombreFactura}" (${proveedor})`);
    } catch (error) {
      console.error("[Confirmaciones] Error invalidando:", error);
    }
  }

  async verificar(): Promise<{ verificados: number; invalidos: number }> {
    const { inventarios365 } = await import("./inventarios365");
    const db = await getDb();
    if (!db) return { verificados: 0, invalidos: 0 };

    const rows = await db.select().from(confirmacionesTable)
      .where(eq(confirmacionesTable.valido, 1));

    let verificados = 0;
    let invalidos = 0;

    for (const row of rows) {
      try {
        const articulos = await inventarios365.listarArticulos(row.articuloNombre.split(" ")[0]);
        const existe = articulos.some(a => a.id === row.articuloId);
        if (!existe) {
          await db.update(confirmacionesTable)
            .set({ valido: 0 })
            .where(eq(confirmacionesTable.id, row.id));
          invalidos++;
          console.warn(`[Confirmaciones] ID ${row.articuloId} ya no existe — invalidado`);
        } else {
          verificados++;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`[Confirmaciones] Verificación: ${verificados} válidos, ${invalidos} invalidados`);
    return { verificados, invalidos };
  }

  async estadisticas(): Promise<object> {
    try {
      const db = await getDb();
      if (!db) return {};
      const rows = await db.select().from(confirmacionesTable);
      const porProveedor: Record<string, number> = {};
      let totalValidas = 0;
      let totalInvalidas = 0;
      for (const row of rows) {
        if (row.valido) {
          porProveedor[row.proveedor] = (porProveedor[row.proveedor] || 0) + 1;
          totalValidas++;
        } else {
          totalInvalidas++;
        }
      }
      return { totalValidas, totalInvalidas, proveedores: Object.keys(porProveedor).length, porProveedor };
    } catch {
      return {};
    }
  }

  async todos(): Promise<any[]> {
    try {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(confirmacionesTable).where(eq(confirmacionesTable.valido, 1));
    } catch {
      return [];
    }
  }
}

export const confirmacionesService = new ConfirmacionesService();

// Verificación automática cada 7 días
setInterval(() => {
  confirmacionesService.verificar().catch(console.error);
}, 7 * 24 * 60 * 60 * 1000);
