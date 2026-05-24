/**
 * Sistema de Confirmaciones Aprendidas
 *
 * Guarda emparejamientos confirmados por el usuario:
 * Proveedor + Nombre en factura → ID del producto en el sistema
 *
 * Con el tiempo el sistema aprende y no necesita matching fuzzy.
 */

import fs from "fs";
import path from "path";
import { inventarios365, ArticuloAPI } from "./inventarios365";

const CONFIRMACIONES_FILE = path.join(process.cwd(), "confirmaciones.json");

interface Confirmacion {
  id: number;
  nombreSistema: string;
  codigo: string;
  confirmadoEn: string;
  valido: boolean;
}

interface ConfirmacionesData {
  [proveedor: string]: {
    [nombreFactura: string]: Confirmacion;
  };
}

class ConfirmacionesService {
  private data: ConfirmacionesData = {};

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    try {
      if (fs.existsSync(CONFIRMACIONES_FILE)) {
        const raw = fs.readFileSync(CONFIRMACIONES_FILE, "utf-8");
        this.data = JSON.parse(raw);
        const total = Object.values(this.data).reduce(
          (acc, proveedor) => acc + Object.keys(proveedor).length, 0
        );
        console.log(`[Confirmaciones] Cargadas: ${total} confirmaciones de ${Object.keys(this.data).length} proveedores`);
      }
    } catch {
      console.warn("[Confirmaciones] No se pudo cargar, iniciando vacío");
      this.data = {};
    }
  }

  private guardar(): void {
    try {
      fs.writeFileSync(CONFIRMACIONES_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (error) {
      console.error("[Confirmaciones] Error guardando:", error);
    }
  }

  private normalizar(s: string): string {
    return s.toUpperCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  /**
   * Buscar confirmación existente para un producto de un proveedor
   */
  buscar(proveedor: string, nombreFactura: string): Confirmacion | null {
    const provNorm = this.normalizar(proveedor);
    const nombreNorm = this.normalizar(nombreFactura);

    // Buscar por proveedor normalizado
    for (const [prov, productos] of Object.entries(this.data)) {
      if (this.normalizar(prov) !== provNorm) continue;
      for (const [nombre, conf] of Object.entries(productos)) {
        if (this.normalizar(nombre) === nombreNorm && conf.valido) {
          console.log(`[Confirmaciones] ✅ "${nombreFactura}" (${proveedor}) → "${conf.nombreSistema}" (ID:${conf.id})`);
          return conf;
        }
      }
    }
    return null;
  }

  /**
   * Guardar una nueva confirmación
   */
  confirmar(
    proveedor: string,
    nombreFactura: string,
    articulo: ArticuloAPI
  ): void {
    if (!this.data[proveedor]) {
      this.data[proveedor] = {};
    }
    this.data[proveedor][nombreFactura] = {
      id: articulo.id,
      nombreSistema: articulo.nombre,
      codigo: articulo.codigo,
      confirmadoEn: new Date().toISOString().split("T")[0],
      valido: true,
    };
    this.guardar();
    console.log(`[Confirmaciones] 💾 Guardado: "${nombreFactura}" (${proveedor}) → "${articulo.nombre}" (ID:${articulo.id})`);
  }

  /**
   * Invalidar una confirmación (si el producto cambia)
   */
  invalidar(proveedor: string, nombreFactura: string): void {
    if (this.data[proveedor]?.[nombreFactura]) {
      this.data[proveedor][nombreFactura].valido = false;
      this.guardar();
      console.log(`[Confirmaciones] ❌ Invalidado: "${nombreFactura}" (${proveedor})`);
    }
  }

  /**
   * Verificar que todos los IDs guardados siguen siendo válidos
   * Se ejecuta periódicamente
   */
  async verificar(): Promise<{ verificados: number; invalidos: number }> {
    console.log("[Confirmaciones] Iniciando verificación periódica...");
    let verificados = 0;
    let invalidos = 0;

    for (const [proveedor, productos] of Object.entries(this.data)) {
      for (const [nombreFactura, conf] of Object.entries(productos)) {
        if (!conf.valido) continue;
        try {
          // Verificar que el artículo sigue existiendo
          const articulos = await inventarios365.listarArticulos(conf.nombreSistema.split(" ")[0]);
          const existe = articulos.some(a => a.id === conf.id);
          if (!existe) {
            console.warn(`[Confirmaciones] ID ${conf.id} (${conf.nombreSistema}) ya no existe — invalidando`);
            this.data[proveedor][nombreFactura].valido = false;
            invalidos++;
          } else {
            verificados++;
          }
        } catch {
          // Error de red — no invalidar
        }
        await new Promise(r => setTimeout(r, 100));
      }
    }

    this.guardar();
    console.log(`[Confirmaciones] Verificación completa: ${verificados} válidos, ${invalidos} invalidados`);
    return { verificados, invalidos };
  }

  /**
   * Estadísticas del sistema de confirmaciones
   */
  estadisticas(): object {
    const porProveedor: Record<string, number> = {};
    let totalValidas = 0;
    let totalInvalidas = 0;

    for (const [proveedor, productos] of Object.entries(this.data)) {
      const validas = Object.values(productos).filter(c => c.valido).length;
      porProveedor[proveedor] = validas;
      totalValidas += validas;
      totalInvalidas += Object.values(productos).filter(c => !c.valido).length;
    }

    return {
      totalValidas,
      totalInvalidas,
      proveedores: Object.keys(this.data).length,
      porProveedor,
    };
  }

  /**
   * Listar todas las confirmaciones de un proveedor
   */
  listarPorProveedor(proveedor: string): Record<string, Confirmacion> {
    return this.data[proveedor] || {};
  }

  /**
   * Obtener todos los datos
   */
  todos(): ConfirmacionesData {
    return this.data;
  }
}

export const confirmacionesService = new ConfirmacionesService();

// Verificación automática cada 7 días
setInterval(() => {
  confirmacionesService.verificar().catch(console.error);
}, 7 * 24 * 60 * 60 * 1000);
