import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ShieldCheck, Search, Plus, FileText, AlertTriangle, X, Ban } from "lucide-react";
import { useAuth } from "../_core/hooks/useAuth";

const SUCURSALES = ["Casa Matriz", "Sucursal Petrolera", "Sucursal Lanza", "Casa Matriz Cobol"];

/**
 * REGISTRO DE DISPENSACIÓN DE CONTROLADOS — libro de control legal. Cada entrega
 * de un medicamento controlado se registra con receta, médico y paciente. Es un
 * libro de auditoría: no se edita ni se borra, solo se anula con motivo.
 */
export default function Dispensacion() {
  const { user } = useAuth();
  const esAdmin = user?.role === "admin" || user?.role === "regente";
  const utils = trpc.useUtils();

  const [sucursal, setSucursal] = useState("");
  const [q, setQ] = useState("");
  const [producto, setProducto] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [recetaNumero, setRecetaNumero] = useState("");
  const [medico, setMedico] = useState("");
  const [matriculaMedico, setMatriculaMedico] = useState("");
  const [paciente, setPaciente] = useState("");
  const [documentoPaciente, setDocumentoPaciente] = useState("");
  const [nota, setNota] = useState("");

  const { data: sugerencias } = trpc.contingencia.buscarProducto.useQuery({ q }, { enabled: q.trim().length >= 2 });
  const { data: verificacion } = trpc.dispensacion.esControlado.useQuery({ nombre: producto }, { enabled: producto.trim().length > 2 });

  const registrar = trpc.dispensacion.registrar.useMutation({
    onSuccess: () => {
      toast.success("Dispensación registrada en el libro de control");
      setProducto(""); setCantidad(1); setRecetaNumero(""); setMedico(""); setMatriculaMedico(""); setPaciente(""); setDocumentoPaciente(""); setNota(""); setQ("");
      utils.dispensacion.listar.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: registros } = trpc.dispensacion.listar.useQuery({}, { enabled: esAdmin });
  const anular = trpc.dispensacion.anular.useMutation({
    onSuccess: () => { toast.success("Registro anulado"); utils.dispensacion.listar.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const guardar = () => {
    if (!sucursal) { toast.error("Elige la sucursal"); return; }
    if (!producto.trim()) { toast.error("Falta el producto"); return; }
    if (!recetaNumero.trim()) { toast.error("Un controlado requiere el número de receta"); return; }
    registrar.mutate({
      sucursal, producto: producto.trim(), cantidad,
      recetaNumero: recetaNumero.trim(), medico: medico || undefined, matriculaMedico: matriculaMedico || undefined,
      paciente: paciente || undefined, documentoPaciente: documentoPaciente || undefined, nota: nota || undefined,
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="border-b pb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-black tracking-tight">Dispensación de Controlados</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Libro de control legal. Registra cada entrega de un medicamento controlado con su receta. Los registros no se borran — quedan para inspección.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <select value={sucursal} onChange={(e) => setSucursal(e.target.value)} className="w-full h-10 px-3 rounded-xl border text-sm bg-background">
          <option value="">— Sucursal —</option>
          {SUCURSALES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Buscar producto */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setProducto(e.target.value); }} placeholder="Producto controlado…"
            className="w-full h-10 pl-9 pr-3 rounded-xl border text-sm bg-background" />
          {q.trim().length >= 2 && (sugerencias?.length || 0) > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white dark:bg-card border rounded-xl shadow-lg max-h-56 overflow-y-auto">
              {sugerencias!.map((p: any) => (
                <button key={p.articuloId} onClick={() => { setProducto(p.nombre); setQ(""); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted truncate">{p.nombre}</button>
              ))}
            </div>
          )}
        </div>

        {/* Aviso de si es controlado */}
        {producto.trim().length > 2 && verificacion && (
          verificacion.controlado ? (
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 text-[11px] text-indigo-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 shrink-0" /> Producto controlado — requiere receta y este registro.
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" /> No detecté este producto como controlado. Si lo es igual, puedes registrarlo; si no, quizá no necesita este libro.
            </div>
          )
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-bold text-muted-foreground">Cantidad
            <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))} className="mt-0.5 w-full h-9 px-2 rounded-lg border text-sm bg-background" />
          </label>
          <label className="text-[11px] font-bold text-red-600">N° de receta *
            <input value={recetaNumero} onChange={(e) => setRecetaNumero(e.target.value)} className="mt-0.5 w-full h-9 px-2 rounded-lg border text-sm bg-background" placeholder="obligatorio" />
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">Médico
            <input value={medico} onChange={(e) => setMedico(e.target.value)} className="mt-0.5 w-full h-9 px-2 rounded-lg border text-sm bg-background" />
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">Matrícula médico
            <input value={matriculaMedico} onChange={(e) => setMatriculaMedico(e.target.value)} className="mt-0.5 w-full h-9 px-2 rounded-lg border text-sm bg-background" />
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">Paciente
            <input value={paciente} onChange={(e) => setPaciente(e.target.value)} className="mt-0.5 w-full h-9 px-2 rounded-lg border text-sm bg-background" />
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">Documento paciente
            <input value={documentoPaciente} onChange={(e) => setDocumentoPaciente(e.target.value)} className="mt-0.5 w-full h-9 px-2 rounded-lg border text-sm bg-background" />
          </label>
        </div>
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" className="w-full h-9 px-3 rounded-xl border text-xs bg-background" />

        <button onClick={guardar} disabled={registrar.isPending}
          className="w-full h-11 rounded-xl bg-indigo-600 text-white font-black disabled:opacity-50 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> {registrar.isPending ? "Registrando…" : "Registrar dispensación"}
        </button>
      </div>

      {/* Libro (admin/regente) */}
      {esAdmin && (registros?.length || 0) > 0 && (
        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <p className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1.5"><FileText className="w-4 h-4" /> Libro de control ({registros!.length})</p>
          {registros!.map((r: any) => (
            <div key={r.id} className={`rounded-xl border p-2.5 text-xs ${r.estado === "anulada" ? "opacity-50 line-through" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-black">{r.fecha} {String(r.hora).slice(0, 5)} · {r.producto}</span>
                <span className="font-bold">×{r.cantidad}</span>
              </div>
              <p className="text-muted-foreground">
                Receta {r.recetaNumero}{r.medico ? ` · Dr. ${r.medico}` : ""}{r.paciente ? ` · Pac. ${r.paciente}` : ""} · {r.sucursal} · {r.dispensadoPor}
              </p>
              {r.estado === "anulada" && <p className="text-red-600 text-[10px]">Anulada: {r.anuladoMotivo}</p>}
              {r.estado === "vigente" && (
                <button onClick={() => { const m = window.prompt("Motivo de la anulación:"); if (m && m.trim().length >= 3) anular.mutate({ id: r.id, motivo: m.trim() }); }}
                  className="mt-1 text-[10px] font-bold text-red-600 flex items-center gap-1"><Ban className="w-3 h-3" /> Anular</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
