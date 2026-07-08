// Conector ENCHUFABLE de publicación en redes (misma filosofía que pagos QR):
// la arquitectura se construye hoy; se activa con credenciales, sin reprogramar.
//
// Proveedores soportados (en orden de prioridad):
//   1. AYRSHARE (API unificado ya auditado): publica a Facebook + TikTok + Instagram
//      con una llamada. Variable: AYRSHARE_API_KEY. Redes: AYRSHARE_PLATFORMS
//      (por defecto "facebook,tiktok,instagram", separadas por coma).
//   2. FACEBOOK directo (Graph API de páginas, gratis): FB_PAGE_ID + FB_PAGE_TOKEN
//      (token de página de larga duración).
//   3. Sin credenciales → modo MANUAL: devuelve el texto para copiar/pegar.

export function redesDisponibles(): { modo: string; redes: string[] } {
  if (process.env.AYRSHARE_API_KEY) {
    const redes = (process.env.AYRSHARE_PLATFORMS || "facebook,tiktok,instagram").split(",").map(s => s.trim()).filter(Boolean);
    return { modo: "ayrshare", redes };
  }
  if (process.env.FB_PAGE_ID && process.env.FB_PAGE_TOKEN) {
    return { modo: "facebook", redes: ["facebook"] };
  }
  return { modo: "manual", redes: [] };
}

export async function publicarEnRedes(texto: string, imagenUrl?: string): Promise<{
  modo: string; ok?: boolean; detalles?: any; error?: string;
}> {
  const disp = redesDisponibles();

  // ─── 1. Ayrshare (Facebook + TikTok + Instagram con una llamada) ───
  if (disp.modo === "ayrshare") {
    try {
      const body: any = { post: texto, platforms: disp.redes };
      if (imagenUrl) body.mediaUrls = [imagenUrl];
      const resp = await fetch("https://api.ayrshare.com/api/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.AYRSHARE_API_KEY}`,
        },
        body: JSON.stringify(body),
      });
      const data = await resp.json() as any;
      if (!resp.ok || data.status === "error") {
        return { modo: "ayrshare", ok: false, error: JSON.stringify(data.errors || data).slice(0, 300) };
      }
      return { modo: "ayrshare", ok: true, detalles: { redes: disp.redes, ids: data.postIds || data.id } };
    } catch (e: any) {
      return { modo: "ayrshare", ok: false, error: e?.message || "error de red" };
    }
  }

  // ─── 2. Facebook directo (Graph API de la página) ───
  if (disp.modo === "facebook") {
    try {
      const pageId = process.env.FB_PAGE_ID;
      const token = process.env.FB_PAGE_TOKEN;
      const url = imagenUrl
        ? `https://graph.facebook.com/v21.0/${pageId}/photos`
        : `https://graph.facebook.com/v21.0/${pageId}/feed`;
      const params = new URLSearchParams(
        imagenUrl
          ? { url: imagenUrl, caption: texto, access_token: token! }
          : { message: texto, access_token: token! }
      );
      const resp = await fetch(url, { method: "POST", body: params });
      const data = await resp.json() as any;
      if (!resp.ok || data.error) {
        return { modo: "facebook", ok: false, error: (data.error?.message || "error").slice(0, 300) };
      }
      return { modo: "facebook", ok: true, detalles: { postId: data.id || data.post_id } };
    } catch (e: any) {
      return { modo: "facebook", ok: false, error: e?.message || "error de red" };
    }
  }

  // ─── 3. Modo manual ───
  return { modo: "manual" };
}
