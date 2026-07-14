import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Pill, FileText, Camera, Download, Plus, Loader2, X, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

const TRIMESTRE_ACTUAL = Math.floor(new Date().getMonth() / 3) + 1;
const ANIO_ACTUAL = new Date().getFullYear();

/**
 * LIBRO DE PSICOTRÓPICOS — control legal. Egresos capturados en mostrador con
 * receta (y foto), saldo desde el stock real de 365. Informes trimestral,
 * semestral y anual para SEDES.
 */
export default function Psicotropicos() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"movimiento" | "informe" | "productos">("movimiento");

  const { data: productos } = trpc.psico.listarProductos.useQuery();
  const importar = trpc.psico.importarSemilla.useMutation({
    onSuccess: (r) => { toast.success(`${r.creados} producto(s) importado(s)${r.existentes ? `, ${r.existentes} ya existían` : ""}`); utils.psico.listarProductos.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="border-b pb-4">
        <div className="flex items-center gap-2">
          <Pill className="w-6 h-6 text-violet-600" />
          <h1 className="text-2xl font-black tracking-tight">Libro de Psicotrópicos</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Control legal de psicotrópicos: captura de egresos con receta e informes trimestral, semestral y anual para SEDES.
        </p>
      </div>

      <div className="flex gap-1 bg-muted rounded-xl p-1">
        {[["movimiento", "Capturar"], ["informe", "Informes"], ["productos", "Productos"]].map(([k, t]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`flex-1 h-9 rounded-lg text-xs font-black ${tab === k ? "bg-background shadow" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "movimiento" && <CapturaMovimiento productos={productos || []} />}
      {tab === "informe" && <Informes />}
      {tab === "productos" && (
        <div className="space-y-3">
          {(productos?.length || 0) === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-2xl">
              <p className="text-sm font-medium mb-1">No hay productos cargados</p>
              <p className="text-xs text-muted-foreground mb-4">Importa los 8 productos de tu libro actual con un clic.</p>
              <button onClick={() => importar.mutate()} disabled={importar.isPending}
                className="h-10 px-4 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-50">
                {importar.isPending ? "Importando…" : "Importar mis psicotrópicos"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <button onClick={() => importar.mutate()} disabled={importar.isPending} className="text-xs font-bold text-violet-600">+ Re-importar semilla</button>
              </div>
              {(productos || []).map((p: any) => (
                <div key={p.id} className="rounded-xl border p-3 text-xs">
                  <p className="font-black">{p.nombreComercial} <span className="font-normal text-muted-foreground">— {p.dci} {p.concentracion}</span></p>
                  <p className="text-muted-foreground">{p.presentacion} · {p.laboratorio} · {p.origen}</p>
                  <p className="text-[10px] text-muted-foreground">R.S.: {p.registroSanitario}{p.articuloId365 ? ` · vinculado a 365 #${p.articuloId365}` : " · sin vincular a 365"}</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CapturaMovimiento({ productos }: { productos: any[] }) {
  const utils = trpc.useUtils();
  const [productoId, setProductoId] = useState<number | "">("");
  const [tipo, setTipo] = useState<"ingreso" | "egreso">("egreso");
  const [cantidad, setCantidad] = useState(1);
  const [recetaNumero, setRecetaNumero] = useState("");
  const [paciente, setPaciente] = useState("");
  const [medico, setMedico] = useState("");
  const [numFactura, setNumFactura] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string>("");
  const [subiendo, setSubiendo] = useState(false);

  const subirFoto = trpc.psico.subirFoto.useMutation();
  const registrar = trpc.psico.registrarMovimiento.useMutation({
    onSuccess: () => {
      toast.success("Movimiento registrado en el libro");
      setCantidad(1); setRecetaNumero(""); setPaciente(""); setMedico(""); setNumFactura(""); setFotoUrl("");
      utils.psico.listarProductos.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const onFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSubiendo(true);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(f);
      });
      const r = await subirFoto.mutateAsync({ fileBase64: b64, mimeType: f.type, tipo: tipo === "egreso" ? "receta" : "factura" });
      setFotoUrl(r.url);
      toast.success(tipo === "egreso" ? "Receta adjuntada" : "Factura adjuntada");
    } catch { toast.error("No se pudo subir la foto"); } finally { setSubiendo(false); }
  };

  const guardar = () => {
    if (!productoId) { toast.error("Elige el producto"); return; }
    if (tipo === "egreso" && !recetaNumero.trim()) { toast.error("El egreso requiere número de receta"); return; }
    registrar.mutate({
      productoId: Number(productoId), tipo, cantidad,
      recetaNumero: recetaNumero || undefined, paciente: paciente || undefined, medico: medico || undefined,
      numFactura: numFactura || undefined,
      recetaFotoUrl: tipo === "egreso" ? fotoUrl || undefined : undefined,
      facturaFotoUrl: tipo === "ingreso" ? fotoUrl || undefined : undefined,
    });
  };

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setTipo("egreso")} className={`flex-1 h-10 rounded-xl text-xs font-black flex items-center justify-center gap-1 ${tipo === "egreso" ? "bg-violet-600 text-white" : "bg-muted"}`}>
          <ArrowUpCircle className="w-4 h-4" /> Egreso (venta)
        </button>
        <button onClick={() => setTipo("ingreso")} className={`flex-1 h-10 rounded-xl text-xs font-black flex items-center justify-center gap-1 ${tipo === "ingreso" ? "bg-emerald-600 text-white" : "bg-muted"}`}>
          <ArrowDownCircle className="w-4 h-4" /> Ingreso (compra)
        </button>
      </div>

      <select value={productoId} onChange={(e) => setProductoId(e.target.value ? Number(e.target.value) : "")} className="w-full h-10 px-3 rounded-xl border text-sm bg-background">
        <option value="">— Producto psicotrópico —</option>
        {productos.map((p) => <option key={p.id} value={p.id}>{p.nombreComercial} — {p.dci} {p.concentracion}</option>)}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-bold text-muted-foreground">Cantidad
          <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))} className="mt-0.5 w-full h-9 px-2 rounded-lg border text-sm bg-background" />
        </label>
        {tipo === "egreso" ? (
          <label className="text-[11px] font-bold text-red-600">N° receta *
            <input value={recetaNumero} onChange={(e) => setRecetaNumero(e.target.value)} className="mt-0.5 w-full h-9 px-2 rounded-lg border text-sm bg-background" placeholder="obligatorio" />
          </label>
        ) : (
          <label className="text-[11px] font-bold text-muted-foreground">N° factura
            <input value={numFactura} onChange={(e) => setNumFactura(e.target.value)} className="mt-0.5 w-full h-9 px-2 rounded-lg border text-sm bg-background" />
          </label>
        )}
      </div>

      {tipo === "egreso" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-bold text-muted-foreground">Paciente
            <input value={paciente} onChange={(e) => setPaciente(e.target.value)} className="mt-0.5 w-full h-9 px-2 rounded-lg border text-sm bg-background" />
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">Médico
            <input value={medico} onChange={(e) => setMedico(e.target.value)} className="mt-0.5 w-full h-9 px-2 rounded-lg border text-sm bg-background" />
          </label>
        </div>
      )}

      {/* Foto de receta (egreso) o factura (ingreso) */}
      <label className={`flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-dashed cursor-pointer text-xs font-bold ${fotoUrl ? "border-emerald-400 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20" : "border-muted-foreground/30 text-muted-foreground"}`}>
        {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        {fotoUrl ? `✓ ${tipo === "egreso" ? "Receta" : "Factura"} adjuntada` : `Adjuntar foto de ${tipo === "egreso" ? "la receta" : "la factura"}`}
        <input type="file" accept="image/*" capture="environment" onChange={onFoto} className="hidden" />
      </label>

      <button onClick={guardar} disabled={registrar.isPending}
        className="w-full h-11 rounded-xl bg-violet-600 text-white font-black disabled:opacity-50 flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> {registrar.isPending ? "Registrando…" : "Registrar movimiento"}
      </button>
    </div>
  );
}

function Informes() {
  const [tipo, setTipo] = useState<"trimestral" | "semestral" | "anual">("trimestral");
  const [anio, setAnio] = useState(ANIO_ACTUAL);
  const [trimestre, setTrimestre] = useState(TRIMESTRE_ACTUAL);
  const informe = trpc.psico.informe.useQuery({ tipo, anio, trimestre: tipo === "anual" ? undefined : trimestre });

  const exportarCSV = () => {
    if (!informe.data || "error" in informe.data) return;
    const cols = ["Producto", "DCI", "Concentración", "Presentación", "Laboratorio", "Registro Sanitario", "Origen", "Ingreso", "Egreso", "Saldo Anterior", "Saldo Actual", "Observación"];
    const rows = informe.data.detalle.map((d: any) => [d.producto, d.dci, d.concentracion, d.presentacion, d.laboratorio, d.registroSanitario, d.origen, d.ingreso, d.egreso, d.saldoAnterior, d.saldoActual, d.sinMovimiento ? "SIN MOVIMIENTO" : ""]);
    const csv = [cols, ...rows].map((r) => r.map((c: any) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `psicotropicos_${tipo}_${informe.data.etiqueta.replace(/[^0-9a-z]/gi, "-")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="h-9 px-2 rounded-lg border text-xs bg-background">
          <option value="trimestral">Trimestral</option>
          <option value="semestral">Semestral</option>
          <option value="anual">Anual</option>
        </select>
        <input type="number" value={anio} onChange={(e) => setAnio(parseInt(e.target.value) || ANIO_ACTUAL)} className="h-9 w-20 px-2 rounded-lg border text-xs bg-background" />
        {tipo !== "anual" && (
          <select value={trimestre} onChange={(e) => setTrimestre(parseInt(e.target.value))} className="h-9 px-2 rounded-lg border text-xs bg-background">
            {tipo === "trimestral"
              ? [1, 2, 3, 4].map((t) => <option key={t} value={t}>Trim. {t}</option>)
              : [1, 2].map((t) => <option key={t} value={t}>Semestre {t}</option>)}
          </select>
        )}
        <button onClick={exportarCSV} className="h-9 px-3 rounded-lg bg-violet-600 text-white text-xs font-bold flex items-center gap-1">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      {informe.isLoading ? <p className="text-xs text-muted-foreground py-6 text-center">Calculando…</p> :
        informe.data && !("error" in informe.data) ? (
          <div className="rounded-2xl border bg-card overflow-x-auto">
            <div className="p-3 border-b">
              <p className="text-xs font-black">Informe {tipo} · {informe.data.etiqueta}</p>
              <p className="text-[10px] text-muted-foreground">VIDAFARMA · Cochabamba · {informe.data.desde} a {informe.data.hasta}</p>
            </div>
            <table className="w-full text-[11px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Producto</th>
                  <th className="text-center p-2">Ing.</th>
                  <th className="text-center p-2">Egr.</th>
                  <th className="text-center p-2">S. Ant.</th>
                  <th className="text-center p-2">S. Act.</th>
                </tr>
              </thead>
              <tbody>
                {informe.data.detalle.map((d: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">
                      <p className="font-bold">{d.producto}</p>
                      <p className="text-[9px] text-muted-foreground">{d.dci} {d.concentracion} · {d.registroSanitario}</p>
                    </td>
                    <td className="text-center p-2">{d.ingreso}</td>
                    <td className="text-center p-2">{d.egreso}</td>
                    <td className="text-center p-2">{d.saldoAnterior}</td>
                    <td className="text-center p-2 font-black">{d.saldoActual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-red-600 py-6 text-center">No se pudo generar el informe.</p>}
    </div>
  );
}
