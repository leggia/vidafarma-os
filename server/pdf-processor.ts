/**
 * Procesador de PDFs y imágenes
 * Usa pdf-parse para extraer texto y manejo simple de imágenes
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Convertir PDF a base64 PNG
 * Intenta múltiples estrategias:
 * 1. pdf2pic (si GraphicsMagick está disponible)
 * 2. Fallback: retorna null para usar OCR o texto
 */
export async function pdfToBase64Png(fileKey: string): Promise<string | null> {
  const pdfPath = path.join(process.cwd(), "uploads", fileKey);

  // Opción 1: Intentar con pdf2pic (requiere GraphicsMagick)
  try {
    const { fromPath } = await import("pdf2pic");
    const outputDir = path.join(process.cwd(), "uploads", "pdf-pages");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const converter = fromPath(pdfPath, {
      density: 150,
      saveFilename: path.basename(fileKey, ".pdf"),
      savePath: outputDir,
      format: "png",
      width: 1200,
      height: 1600,
    });

    const result = await converter(1);
    if (!result.path || !fs.existsSync(result.path)) {
      throw new Error("No se pudo convertir PDF");
    }

    const buffer = fs.readFileSync(result.path);
    try {
      fs.unlinkSync(result.path);
    } catch {}

    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.warn("[PDF] pdf2pic no disponible, usando extracción de texto:", error);
  }

  // Opción 2: Si pdf2pic falla, retornar null para que se use OCR
  return null;
}

/**
 * Extraer texto de PDF usando pdf-parse
 */
export async function extractTextFromPdf(fileKey: string): Promise<string> {
  try {
    const pdfParse = await import("pdf-parse");
    const pdfPath = path.join(process.cwd(), "uploads", fileKey);
    const data = fs.readFileSync(pdfPath);
    
    // pdf-parse puede exportarse como default o como named export
    const parser = (pdfParse as any).default || pdfParse;
    const pdf = await parser(data);
    
    return pdf.text || "";
  } catch (error) {
    console.error("[PDF] Error extrayendo texto:", error);
    return "";
  }
}

/**
 * Convertir imagen a base64 (para fotos).
 * Redimensiona a máx 1800px por lado: una factura se lee perfecto a esa
 * resolución y consume MUCHOS menos tokens de visión (el tier gratuito de
 * Groq limita a 8000 tokens/minuto; una foto de celular a resolución
 * completa podía reventar ese límite → error 413).
 */
const MAX_LADO_PX = 1800;

export async function imageToBase64(fileKey: string): Promise<string> {
  const imagePath = path.join(process.cwd(), "uploads", fileKey);
  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(fileKey).toLowerCase().slice(1);
  const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;

  try {
    const { createCanvas, loadImage } = await import("canvas");
    const img = await loadImage(buffer);
    const mayor = Math.max(img.width, img.height);
    if (mayor > MAX_LADO_PX) {
      const escala = MAX_LADO_PX / mayor;
      const w = Math.round(img.width * escala);
      const h = Math.round(img.height * escala);
      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const jpeg = canvas.toBuffer("image/jpeg", { quality: 0.85 });
      console.log(`[Imagen] Redimensionada ${img.width}x${img.height} → ${w}x${h} (${Math.round(buffer.length / 1024)}KB → ${Math.round(jpeg.length / 1024)}KB)`);
      return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    }
  } catch (e: any) {
    // Si canvas no puede con el formato (ej. HEIC), enviar original
    console.warn("[Imagen] No se pudo redimensionar, enviando original:", e?.message);
  }

  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
