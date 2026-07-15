import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Contact, Search, Plus, Phone, MessageCircle, Trash2, X, Building2, User } from "lucide-react";

/**
 * DIRECTORIO DE CONTACTOS — clientes y proveedores con su celular, a la mano.
 * El teléfono es la llave anti-duplicados (normalizado a formato Bolivia).
 */
export default function Contactos() {
  const utils = trpc.useUtils();
  const [q, setQ] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "cliente" | "proveedor">("todos");
  const [form, setForm] = useState<any>(null);

  const { data: lista, isLoading } = trpc.contactos.buscar.useQuery({
    q, tipo: filtroTipo === "todos" ? undefined : filtroTipo,
  });

  const guardar = trpc.contactos.guardar.useMutation({
    onSuccess: (r: any) => {
      toast.success(r.yaExistia ? "Contacto actualizado (ya existía ese número)" : r.creado ? "Contacto guardado" : "Contacto actualizado");
      utils.contactos.buscar.invalidate();
      setForm(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const eliminar = trpc.contactos.eliminar.useMutation({
    onSuccess: () => { toast.success("Contacto eliminado"); utils.contactos.buscar.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const soloDigitos = (t: string) => String(t || "").replace(/\D/g, "");

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="border-b pb-4 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Contact className="w-6 h-6 text-sky-600" />
            <h1 className="text-2xl font-black tracking-tight">Contactos</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Clientes y proveedores con su celular, siempre a la mano.</p>
        </div>
        <button onClick={() => setForm({ tipo: "cliente" })} className="shrink-0 h-10 px-3 rounded-xl bg-sky-600 text-white text-xs font-black flex items-center gap-1">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {/* Buscador + filtro */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, empresa o número…"
            className="w-full h-10 pl-9 pr-3 rounded-xl border text-sm bg-background" />
        </div>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as any)} className="h-10 px-2 rounded-xl border text-xs bg-background">
          <option value="todos">Todos</option>
          <option value="cliente">Clientes</option>
          <option value="proveedor">Proveedores</option>
        </select>
      </div>

      {/* Lista */}
      {isLoading ? <p className="text-xs text-muted-foreground py-8 text-center">Cargando…</p> :
        (lista?.length || 0) === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-2xl">
            <Contact className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">{q ? "Sin resultados" : "Aún no hay contactos"}</p>
            <p className="text-xs text-muted-foreground">{q ? "Prueba con otro nombre o número." : "Agrega tu primer cliente o proveedor."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lista!.map((c: any) => (
              <div key={c.id} className="rounded-xl border p-3 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${c.tipo === "proveedor" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>
                  {c.empresa ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black truncate">{c.nombre}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {c.telefono}{c.empresa ? ` · ${c.empresa}` : ""} · <span className={c.tipo === "proveedor" ? "text-amber-700 font-bold" : "text-sky-700 font-bold"}>{c.tipo}</span>
                  </p>
                  {c.nota && <p className="text-[10px] text-muted-foreground truncate">{c.nota}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <a href={`tel:${soloDigitos(c.telefono)}`} className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center" title="Llamar">
                    <Phone className="w-4 h-4" />
                  </a>
                  <a href={`https://wa.me/591${soloDigitos(c.telefono).slice(-8)}`} target="_blank" rel="noopener noreferrer"
                    className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center" title="WhatsApp">
                    <MessageCircle className="w-4 h-4" />
                  </a>
                  <button onClick={() => setForm(c)} className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-xs" title="Editar">✏️</button>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Modal alta/edición */}
      {form && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setForm(null)}>
          <div className="bg-white dark:bg-card rounded-2xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-black">{form.id ? "Editar contacto" : "Nuevo contacto"}</h3>
              <button onClick={() => setForm(null)}><X className="w-5 h-5" /></button>
            </div>

            <div className="flex gap-2">
              {(["cliente", "proveedor"] as const).map((t) => (
                <button key={t} onClick={() => setForm((f: any) => ({ ...f, tipo: t }))}
                  className={`flex-1 h-9 rounded-xl text-xs font-black capitalize ${form.tipo === t ? (t === "proveedor" ? "bg-amber-600 text-white" : "bg-sky-600 text-white") : "bg-muted"}`}>
                  {t}
                </button>
              ))}
            </div>

            <input value={form.nombre || ""} onChange={(e) => setForm((f: any) => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre de la persona *" className="w-full h-10 px-3 rounded-xl border text-sm bg-background" />
            <input value={form.telefono || ""} onChange={(e) => setForm((f: any) => ({ ...f, telefono: e.target.value }))}
              placeholder="Celular *" inputMode="tel" className="w-full h-10 px-3 rounded-xl border text-sm bg-background" />
            <input value={form.empresa || ""} onChange={(e) => setForm((f: any) => ({ ...f, empresa: e.target.value }))}
              placeholder="Empresa (opcional)" className="w-full h-10 px-3 rounded-xl border text-sm bg-background" />
            <input value={form.email || ""} onChange={(e) => setForm((f: any) => ({ ...f, email: e.target.value }))}
              placeholder="Email (opcional)" inputMode="email" className="w-full h-10 px-3 rounded-xl border text-sm bg-background" />
            <input value={form.nota || ""} onChange={(e) => setForm((f: any) => ({ ...f, nota: e.target.value }))}
              placeholder="Nota (ej: visitador de Bagó, martes)" className="w-full h-10 px-3 rounded-xl border text-sm bg-background" />

            <div className="flex gap-2 pt-1">
              {form.id && (
                <button onClick={() => { if (window.confirm("¿Eliminar este contacto?")) { eliminar.mutate({ id: form.id }); setForm(null); } }}
                  className="h-11 px-3 rounded-xl bg-red-50 text-red-600 border border-red-200 font-bold">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => {
                  if (!form.nombre?.trim()) { toast.error("Falta el nombre"); return; }
                  if (!form.telefono?.trim()) { toast.error("Falta el celular"); return; }
                  guardar.mutate({
                    id: form.id, nombre: form.nombre.trim(), telefono: form.telefono.trim(), tipo: form.tipo || "cliente",
                    empresa: form.empresa || undefined, email: form.email || undefined, nota: form.nota || undefined,
                  });
                }}
                disabled={guardar.isPending}
                className="flex-1 h-11 rounded-xl bg-sky-600 text-white font-black disabled:opacity-50">
                {guardar.isPending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
