import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Landmark, Plus, X, CreditCard, Trash2, Check } from "lucide-react";

const bs = (n: number) => `Bs ${n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * CRÉDITOS DE LA FARMACIA (admin/regente): control de deudas bancarias adquiridas
 * para el negocio (ej. compra de inventario). NO acelera pagos por sí solo — solo
 * da visibilidad de cuánto se debe, cuánto se pagó y cuántas cuotas quedan.
 */
export default function Creditos() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.creditos.listar.useQuery();
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState({ banco: "", descripcion: "", montoTotal: "", cuotaMensual: "", plazoMeses: "", tasaAnual: "", fechaInicio: "", diaPago: "" });
  const [pagoDe, setPagoDe] = useState<number | null>(null);
  const [pagoForm, setPagoForm] = useState({ monto: "", fecha: new Date().toISOString().slice(0, 10), nota: "" });
  const [verPagos, setVerPagos] = useState<number | null>(null);
  const pagosDe = trpc.creditos.pagosDe.useQuery({ creditoId: verPagos ?? 0 }, { enabled: verPagos != null });

  const crear = trpc.creditos.crear.useMutation({
    onSuccess: () => { toast.success("Crédito registrado"); utils.creditos.listar.invalidate(); setNuevo(false); setForm({ banco: "", descripcion: "", montoTotal: "", cuotaMensual: "", plazoMeses: "", tasaAnual: "", fechaInicio: "", diaPago: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const registrarPago = trpc.creditos.registrarPago.useMutation({
    onSuccess: () => { toast.success("Pago registrado"); utils.creditos.listar.invalidate(); setPagoDe(null); setPagoForm({ monto: "", fecha: new Date().toISOString().slice(0, 10), nota: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const eliminar = trpc.creditos.eliminar.useMutation({
    onSuccess: () => { toast.success("Eliminado"); utils.creditos.listar.invalidate(); },
  });
  const marcarEstado = trpc.creditos.marcarEstado.useMutation({
    onSuccess: () => { utils.creditos.listar.invalidate(); },
  });

  const enviarNuevo = () => {
    if (!form.banco.trim() || !form.montoTotal || !form.cuotaMensual || !form.plazoMeses) {
      toast.error("Completa banco, monto, cuota y plazo"); return;
    }
    crear.mutate({
      banco: form.banco.trim(), descripcion: form.descripcion.trim() || undefined,
      montoTotal: parseFloat(form.montoTotal), cuotaMensual: parseFloat(form.cuotaMensual),
      plazoMeses: parseInt(form.plazoMeses), tasaAnual: form.tasaAnual ? parseFloat(form.tasaAnual) : undefined,
      fechaInicio: form.fechaInicio || undefined, diaPago: form.diaPago ? parseInt(form.diaPago) : undefined,
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-emerald-600" />
          <h1 className="text-xl font-black">Créditos de la farmacia</h1>
        </div>
        <button onClick={() => setNuevo(true)} className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nuevo crédito
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Deudas bancarias del negocio (ej. créditos para inventario). Solo registro y control — no acelera pagos automáticamente.</p>

      {/* Resumen */}
      {data?.resumen && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-100">
            <p className="text-[10px] text-red-700 font-bold">Deuda total</p>
            <p className="text-lg font-black text-red-700">{bs(data.resumen.deudaTotal)}</p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100">
            <p className="text-[10px] text-amber-700 font-bold">Cuota mensual total</p>
            <p className="text-lg font-black text-amber-700">{bs(data.resumen.cuotaMensualTotal)}</p>
          </div>
          <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/20 border border-sky-100">
            <p className="text-[10px] text-sky-700 font-bold">Créditos activos</p>
            <p className="text-lg font-black text-sky-700">{data.resumen.activos}</p>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>}
      {(data?.creditos?.length || 0) === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground py-10 text-center">Sin créditos registrados. Toca "Nuevo crédito" para empezar.</p>
      )}

      <div className="space-y-3">
        {(data?.creditos || []).map((c: any) => (
          <div key={c.id} className="p-4 rounded-2xl bg-white dark:bg-card border shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-black text-sm">{c.banco}</p>
                {c.descripcion && <p className="text-xs text-muted-foreground">{c.descripcion}</p>}
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.estado === "pagado" ? "bg-emerald-100 text-emerald-800" : c.estado === "pausado" ? "bg-gray-200 text-gray-700" : "bg-amber-100 text-amber-800"}`}>
                {c.estado === "pagado" ? "✓ Pagado" : c.estado === "pausado" ? "Pausado" : "Activo"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <p>Monto: <b>{bs(c.montoTotal)}</b></p>
              <p>Cuota: <b>{bs(c.cuotaMensual)}</b>/mes</p>
              <p>Pagado: <b className="text-emerald-700">{bs(c.pagado)}</b></p>
              <p>Saldo: <b className="text-red-700">{bs(c.saldo)}</b></p>
              <p>Cuotas: <b>{c.cuotasPagadas}/{c.plazoMeses}</b></p>
              {c.tasaAnual > 0 && <p>Tasa: <b>{c.tasaAnual}% anual</b></p>}
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
              <div className="h-full bg-emerald-600" style={{ width: `${c.pctPagado}%` }} />
            </div>
            <div className="flex flex-wrap gap-2">
              {c.estado !== "pagado" && (
                <button onClick={() => setPagoDe(c.id)} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold">Registrar pago</button>
              )}
              <button onClick={() => setVerPagos(verPagos === c.id ? null : c.id)} className="h-8 px-3 rounded-lg bg-muted text-xs font-bold">Ver pagos</button>
              {c.estado === "activo" && <button onClick={() => marcarEstado.mutate({ id: c.id, estado: "pausado" })} className="h-8 px-3 rounded-lg bg-muted text-xs font-bold">Pausar</button>}
              {c.estado === "pausado" && <button onClick={() => marcarEstado.mutate({ id: c.id, estado: "activo" })} className="h-8 px-3 rounded-lg bg-muted text-xs font-bold">Reactivar</button>}
              <button onClick={() => { if (confirm("¿Eliminar este crédito y su historial de pagos?")) eliminar.mutate({ id: c.id }); }} className="h-8 px-2 rounded-lg bg-red-50 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            {verPagos === c.id && (
              <div className="mt-3 pt-3 border-t space-y-1">
                {(pagosDe.data?.pagos?.length || 0) === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin pagos registrados aún.</p>
                ) : pagosDe.data!.pagos.map((p: any) => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span>{String(p.fecha).slice(0, 10)} {p.nota ? `· ${p.nota}` : ""}</span>
                    <span className="font-bold">{bs(Number(p.monto))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal nuevo crédito */}
      {nuevo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setNuevo(false)}>
          <div className="bg-white dark:bg-card rounded-2xl w-full max-w-md p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-black">Nuevo crédito</h3>
              <button onClick={() => setNuevo(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              <input placeholder="Banco (ej. BNB, Banco Unión)" value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} className="w-full h-10 px-3 rounded-xl border text-sm" />
              <input placeholder="Descripción (ej. Crédito para inventario)" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className="w-full h-10 px-3 rounded-xl border text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Monto total (Bs)" value={form.montoTotal} onChange={e => setForm(f => ({ ...f, montoTotal: e.target.value }))} className="h-10 px-3 rounded-xl border text-sm" />
                <input type="number" placeholder="Cuota mensual (Bs)" value={form.cuotaMensual} onChange={e => setForm(f => ({ ...f, cuotaMensual: e.target.value }))} className="h-10 px-3 rounded-xl border text-sm" />
                <input type="number" placeholder="Plazo (meses)" value={form.plazoMeses} onChange={e => setForm(f => ({ ...f, plazoMeses: e.target.value }))} className="h-10 px-3 rounded-xl border text-sm" />
                <input type="number" placeholder="Tasa anual % (opcional)" value={form.tasaAnual} onChange={e => setForm(f => ({ ...f, tasaAnual: e.target.value }))} className="h-10 px-3 rounded-xl border text-sm" />
                <input type="date" placeholder="Fecha inicio" value={form.fechaInicio} onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))} className="h-10 px-3 rounded-xl border text-sm" />
                <input type="number" placeholder="Día de pago (1-31)" value={form.diaPago} onChange={e => setForm(f => ({ ...f, diaPago: e.target.value }))} className="h-10 px-3 rounded-xl border text-sm" />
              </div>
            </div>
            <button onClick={enviarNuevo} disabled={crear.isPending} className="w-full h-11 mt-3 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50">Guardar crédito</button>
          </div>
        </div>
      )}

      {/* Modal registrar pago */}
      {pagoDe != null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPagoDe(null)}>
          <div className="bg-white dark:bg-card rounded-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-black flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> Registrar pago</h3>
              <button onClick={() => setPagoDe(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              <input type="number" placeholder="Monto pagado (Bs)" value={pagoForm.monto} onChange={e => setPagoForm(f => ({ ...f, monto: e.target.value }))} className="w-full h-10 px-3 rounded-xl border text-sm" />
              <input type="date" value={pagoForm.fecha} onChange={e => setPagoForm(f => ({ ...f, fecha: e.target.value }))} className="w-full h-10 px-3 rounded-xl border text-sm" />
              <input placeholder="Nota (opcional)" value={pagoForm.nota} onChange={e => setPagoForm(f => ({ ...f, nota: e.target.value }))} className="w-full h-10 px-3 rounded-xl border text-sm" />
            </div>
            <button
              onClick={() => { if (!pagoForm.monto) { toast.error("Ingresa el monto"); return; } registrarPago.mutate({ creditoId: pagoDe, monto: parseFloat(pagoForm.monto), fecha: pagoForm.fecha, nota: pagoForm.nota || undefined }); }}
              disabled={registrarPago.isPending}
              className="w-full h-11 mt-3 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
              <Check className="w-4 h-4" /> Confirmar pago
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
