import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Megaphone, Sparkles, Check, X, Copy, Send, Pencil, Loader2 } from "lucide-react";

/**
 * PANEL DE MARKETING (solo admin): el agente redacta publicaciones con datos reales
 * del negocio; Luis revisa, edita, aprueba y publica. Conector enchufable:
 * sin credenciales → copiar/pegar; con credenciales → publica directo.
 */
export default function Marketing() {
  const utils = trpc.useUtils();
  const { data: tipos } = trpc.marketing.tipos.useQuery();
  const { data: redes } = trpc.marketing.redes.useQuery();
  const [tab, setTab] = useState<string>("borrador");
  const { data: lista, isFetching } = trpc.marketing.listar.useQuery({ estado: tab });
  const [indicaciones, setIndicaciones] = useState("");
  const [generando, setGenerando] = useState<string | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [textoEdit, setTextoEdit] = useState("");
  const [modalManual, setModalManual] = useState<string | null>(null);

  const generar = trpc.marketing.generar.useMutation({
    onSuccess: (r: any) => {
      setGenerando(null);
      if (r?.error) { toast.error(r.error); return; }
      toast.success("Borrador generado ✨");
      setTab("borrador");
      utils.marketing.listar.invalidate();
    },
    onError: (e) => { setGenerando(null); toast.error(e.message); },
  });
  const cambiarEstado = trpc.marketing.cambiarEstado.useMutation({
    onSuccess: () => utils.marketing.listar.invalidate(),
  });
  const editar = trpc.marketing.editar.useMutation({
    onSuccess: () => { setEditando(null); utils.marketing.listar.invalidate(); toast.success("Guardado"); },
  });
  const publicar = trpc.marketing.publicar.useMutation({
    onSuccess: (r: any) => {
      if (r?.error) { toast.error(r.error); return; }
      if (r?.modo === "manual") { setModalManual(r.texto); return; }
      toast.success("¡Publicado en redes! 🎉");
      utils.marketing.listar.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const TABS = [
    { id: "borrador", txt: "Borradores" },
    { id: "aprobado", txt: "Aprobados" },
    { id: "publicado", txt: "Publicados" },
  ];

  const copiarTexto = (p: any) => {
    const texto = `${p.titulo ? p.titulo + "\n\n" : ""}${p.contenido}\n\n${p.hashtags || ""}`.trim();
    navigator.clipboard?.writeText(texto);
    toast.success("Texto copiado — pégalo en tu red social");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-1">
        <Megaphone className="w-5 h-5 text-emerald-600" />
        <h1 className="text-xl font-black">Marketing</h1>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        El agente redacta con tus datos reales (ofertas, más vendidos, temporada). Tú apruebas antes de publicar.
        {redes && redes.modo !== "manual"
          ? ` · Publicación conectada: ${redes.redes.join(", ")}`
          : " · Sin redes conectadas: publica copiando el texto (o configura las credenciales)."}
      </p>

      {/* Generador */}
      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 mb-6">
        <p className="text-sm font-bold mb-2 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-emerald-600" /> Generar publicación</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {(tipos?.tipos || []).map((t: any) => (
            <button key={t.id}
              disabled={!!generando}
              onClick={() => { setGenerando(t.id); generar.mutate({ tipo: t.id, indicaciones: indicaciones.trim() || undefined }); }}
              className="h-9 px-3 rounded-xl bg-white dark:bg-card border border-emerald-200 text-xs font-bold text-emerald-800 dark:text-emerald-300 active:scale-95 disabled:opacity-50 flex items-center gap-1.5">
              {generando === t.id && <Loader2 className="w-3 h-3 animate-spin" />}
              {t.nombre}
            </button>
          ))}
        </div>
        <input value={indicaciones} onChange={e => setIndicaciones(e.target.value)}
          placeholder="Indicaciones opcionales (ej: 'menciona la sucursal Petrolera', 'tono divertido')"
          className="w-full h-10 px-3 rounded-xl border border-emerald-200 bg-white dark:bg-card outline-none text-xs" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`h-10 px-4 rounded-xl text-sm font-bold ${tab === t.id ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
            {t.txt}
          </button>
        ))}
      </div>

      {isFetching && !lista && <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>}
      {(lista?.posts?.length || 0) === 0 && !isFetching && (
        <p className="text-sm text-muted-foreground py-10 text-center">
          {tab === "borrador" ? "No hay borradores. Genera uno arriba ✨" : `No hay posts ${tab}s.`}
        </p>
      )}

      <div className="space-y-4">
        {(lista?.posts || []).map((p: any) => (
          <div key={p.id} className="p-4 rounded-2xl bg-white dark:bg-card border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {(tipos?.tipos || []).find((t: any) => t.id === p.tipo)?.nombre || p.tipo}
              </span>
              <span className="text-[10px] text-muted-foreground">{String(p.creadoEn).slice(0, 16).replace("T", " ")}</span>
            </div>

            {editando === p.id ? (
              <>
                <textarea value={textoEdit} onChange={e => setTextoEdit(e.target.value)} rows={6}
                  className="w-full p-3 rounded-xl border text-sm outline-none focus:border-emerald-500 bg-white dark:bg-background" />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => editar.mutate({ id: p.id, contenido: textoEdit })}
                    className="h-9 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold">Guardar</button>
                  <button onClick={() => setEditando(null)} className="h-9 px-4 rounded-xl bg-muted text-xs font-bold">Cancelar</button>
                </div>
              </>
            ) : (
              <>
                {p.titulo && <p className="font-black text-sm mb-1">{p.titulo}</p>}
                <p className="text-sm whitespace-pre-wrap">{p.contenido}</p>
                {p.hashtags && <p className="text-xs text-sky-600 mt-1.5">{p.hashtags}</p>}
                {p.sugerenciaImagen && (
                  <p className="text-[11px] text-muted-foreground mt-2 italic">📷 Imagen sugerida: {p.sugerenciaImagen}</p>
                )}
              </>
            )}

            {/* Acciones según estado */}
            {editando !== p.id && (
              <div className="flex flex-wrap gap-2 mt-3">
                {p.estado === "borrador" && (
                  <>
                    <button onClick={() => cambiarEstado.mutate({ id: p.id, estado: "aprobado" })}
                      className="h-9 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95">
                      <Check className="w-3.5 h-3.5" /> Aprobar
                    </button>
                    <button onClick={() => { setEditando(p.id); setTextoEdit(p.contenido); }}
                      className="h-9 px-4 rounded-xl bg-muted text-xs font-bold flex items-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button onClick={() => cambiarEstado.mutate({ id: p.id, estado: "descartado" })}
                      className="h-9 px-3 rounded-xl bg-muted text-muted-foreground text-xs font-bold">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {p.estado === "aprobado" && (
                  <>
                    <button onClick={() => publicar.mutate({ id: p.id })} disabled={publicar.isPending}
                      className="h-9 px-4 rounded-xl bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 disabled:opacity-50">
                      <Send className="w-3.5 h-3.5" /> {redes?.modo !== "manual" ? "Publicar en redes" : "Obtener texto"}
                    </button>
                    <button onClick={() => copiarTexto(p)}
                      className="h-9 px-4 rounded-xl bg-muted text-xs font-bold flex items-center gap-1.5">
                      <Copy className="w-3.5 h-3.5" /> Copiar
                    </button>
                    <button onClick={() => cambiarEstado.mutate({ id: p.id, estado: "publicado" })}
                      className="h-9 px-4 rounded-xl bg-muted text-xs font-bold">✓ Ya lo publiqué</button>
                  </>
                )}
                {p.estado === "publicado" && (
                  <span className="text-[11px] text-emerald-700 font-bold">✓ Publicado {p.publicadoEn ? String(p.publicadoEn).slice(0, 16).replace("T", " ") : ""}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal de publicación manual */}
      {modalManual && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setModalManual(null)}>
          <div className="bg-white dark:bg-card rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-black mb-2">Publica este texto</h3>
            <p className="text-xs text-muted-foreground mb-3">No hay redes conectadas todavía. Copia el texto y pégalo en Facebook/TikTok. Luego márcalo "Ya lo publiqué".</p>
            <div className="p-3 rounded-xl bg-muted text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">{modalManual}</div>
            <button onClick={() => { navigator.clipboard?.writeText(modalManual); toast.success("Copiado"); setModalManual(null); }}
              className="w-full h-11 mt-3 rounded-xl bg-emerald-600 text-white font-bold">Copiar texto</button>
          </div>
        </div>
      )}
    </div>
  );
}
