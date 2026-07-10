import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Wallet2, Plus, X, ArrowUpCircle, ArrowDownCircle, Trash2, Lock } from "lucide-react";

const bs = (n: number) => `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * APARTADO PERSONAL (privado, solo dueño/admin): ingresos (sueldo, retiros de la
 * farmacia, otros) y gastos personales con detalle. TOTALMENTE separado de los
 * reportes de rentabilidad de la farmacia — no afecta ni se mezcla con ellos.
 */
export default function Personal() {
  const utils = trpc.useUtils();
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(hoy.toISOString().slice(0, 10));
  const { data, isLoading } = trpc.personal.resumen.useQuery({ desde, hasta });
  const { data: cats } = trpc.personal.categorias.useQuery();
  const [nuevo, setNuevo] = useState<"ingreso" | "gasto" | null>(null);
  const [form, setForm] = useState({ categoria: "", detalle: "", monto: "", fecha: hoy.toISOString().slice(0, 10) });

  const registrar = trpc.personal.registrar.useMutation({
    onSuccess: () => { toast.success("Registrado"); utils.personal.resumen.invalidate(); setNuevo(null); setForm({ categoria: "", detalle: "", monto: "", fecha: hoy.toISOString().slice(0, 10) }); },
    onError: (e) => toast.error(e.message),
  });
  const eliminar = trpc.personal.eliminar.useMutation({
    onSuccess: () => { toast.success("Eliminado"); utils.personal.resumen.invalidate(); },
  });

  const abrirNuevo = (tipo: "ingreso" | "gasto") => {
    setForm({ categoria: (tipo === "ingreso" ? cats?.ingreso[0] : cats?.gasto[0]) || "", detalle: "", monto: "", fecha: hoy.toISOString().slice(0, 10) });
    setNuevo(tipo);
  };

  const enviar = () => {
    if (!form.monto || parseFloat(form.monto) <= 0) { toast.error("Ingresa un monto válido"); return; }
    registrar.mutate({ tipo: nuevo!, categoria: form.categoria, detalle: form.detalle.trim() || undefined, monto: parseFloat(form.monto), fecha: form.fecha });
  };

  const opcionesCategoria = nuevo === "ingreso" ? cats?.ingreso || [] : cats?.gasto || [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-1">
        <Wallet2 className="w-5 h-5 text-emerald-600" />
        <h1 className="text-xl font-black">Personal</h1>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-800 text-white flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Privado</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Tus ingresos y gastos personales. Separado de la contabilidad de la farmacia — solo tú lo ves.</p>

      {/* Rango de fechas */}
      <div className="flex gap-2 mb-4">
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-9 px-2 rounded-xl border text-xs flex-1" />
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-9 px-2 rounded-xl border text-xs flex-1" />
      </div>

      {/* Resumen del periodo */}
      {data?.resumen && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100">
            <p className="text-[10px] text-emerald-700 font-bold">Ingresos</p>
            <p className="text-base font-black text-emerald-700">{bs(data.resumen.ingresos)}</p>
          </div>
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-100">
            <p className="text-[10px] text-red-700 font-bold">Gastos</p>
            <p className="text-base font-black text-red-700">{bs(data.resumen.gastos)}</p>
          </div>
          <div className={`p-3 rounded-2xl border ${data.resumen.balance >= 0 ? "bg-sky-50 dark:bg-sky-950/20 border-sky-100" : "bg-amber-50 dark:bg-amber-950/20 border-amber-100"}`}>
            <p className={`text-[10px] font-bold ${data.resumen.balance >= 0 ? "text-sky-700" : "text-amber-700"}`}>Balance</p>
            <p className={`text-base font-black ${data.resumen.balance >= 0 ? "text-sky-700" : "text-amber-700"}`}>{bs(data.resumen.balance)}</p>
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => abrirNuevo("ingreso")} className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-1.5">
          <ArrowUpCircle className="w-4 h-4" /> Ingreso
        </button>
        <button onClick={() => abrirNuevo("gasto")} className="flex-1 h-11 rounded-xl bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-1.5">
          <ArrowDownCircle className="w-4 h-4" /> Gasto
        </button>
      </div>

      {/* Gastos por categoría */}
      {(data?.porCategoria?.length || 0) > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-muted-foreground mb-2">Gastos por categoría</p>
          <div className="space-y-1.5">
            {data!.porCategoria.map((c: any) => {
              const pct = data!.resumen.gastos > 0 ? Math.round((c.monto / data!.resumen.gastos) * 100) : 0;
              return (
                <div key={c.categoria}>
                  <div className="flex justify-between text-xs mb-0.5"><span>{c.categoria}</span><span className="font-bold">{bs(c.monto)} ({pct}%)</span></div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Movimientos */}
      <p className="text-xs font-bold text-muted-foreground mb-2">Movimientos</p>
      {isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>}
      {(data?.movimientos?.length || 0) === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground py-10 text-center">Sin movimientos en este periodo.</p>
      )}
      <div className="space-y-1.5">
        {(data?.movimientos || []).map((m: any) => (
          <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-card border">
            <div className="flex items-center gap-2 min-w-0">
              {m.tipo === "ingreso" ? <ArrowUpCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <ArrowDownCircle className="w-4 h-4 text-red-600 shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{m.categoria || "Sin categoría"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{m.detalle || ""} · {String(m.fecha).slice(0, 10)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-sm font-black ${m.tipo === "ingreso" ? "text-emerald-700" : "text-red-700"}`}>{m.tipo === "ingreso" ? "+" : "-"}{bs(m.monto)}</span>
              <button onClick={() => eliminar.mutate({ id: m.id })} className="text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal nuevo movimiento */}
      {nuevo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setNuevo(null)}>
          <div className="bg-white dark:bg-card rounded-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-black">{nuevo === "ingreso" ? "Nuevo ingreso" : "Nuevo gasto"}</h3>
              <button onClick={() => setNuevo(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className="w-full h-10 px-3 rounded-xl border text-sm bg-white dark:bg-background">
                {opcionesCategoria.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input placeholder="Detalle (opcional)" value={form.detalle} onChange={e => setForm(f => ({ ...f, detalle: e.target.value }))} className="w-full h-10 px-3 rounded-xl border text-sm" />
              <input type="number" placeholder="Monto (Bs)" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} className="w-full h-10 px-3 rounded-xl border text-sm" />
              <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className="w-full h-10 px-3 rounded-xl border text-sm" />
            </div>
            <button onClick={enviar} disabled={registrar.isPending}
              className={`w-full h-11 mt-3 rounded-xl text-white font-bold disabled:opacity-50 ${nuevo === "ingreso" ? "bg-emerald-600" : "bg-red-600"}`}>
              Guardar {nuevo}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
