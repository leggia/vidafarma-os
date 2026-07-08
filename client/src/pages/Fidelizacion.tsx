import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  HeartHandshake, Loader2, MessageCircle, Phone, Clock, AlertTriangle,
  CalendarClock, Package, Info, Star,
} from "lucide-react";

// Plantilla del mensaje de WhatsApp. Se personaliza por cliente y producto.
function armarMensaje(nombre: string, producto: string, atrasado: boolean): string {
  const primerNombre = (nombre || "").trim().split(/\s+/)[0] || "";
  const saludo = primerNombre ? `Hola ${primerNombre}` : "Hola";
  if (atrasado) {
    return `${saludo}, le saluda Farmacia VidaFarma 💊. Notamos que hace un tiempo no pasa por su ${producto}. ¿Desea que se lo tengamos listo para cuando pueda pasar? Con gusto le ayudamos a no quedarse sin su tratamiento. 🙌`;
  }
  return `${saludo}, le saluda Farmacia VidaFarma 💊. Su ${producto} está por terminarse según su última compra. ¿Desea que se lo reservemos para que no se quede sin tratamiento? Estamos para servirle. 🙌`;
}

export default function Fidelizacion() {
  const [sucursal, setSucursal] = useState<string>("");
  const [incluir, setIncluir] = useState<"ambos" | "por_acabar" | "atrasado">("ambos");
  const [anticipacionDias, setAnticipacionDias] = useState(5);

  const sucursales = trpc.ventas.sucursalesDisponibles.useQuery();
  const lista = trpc.fidelizacion.porRecordar.useQuery({
    sucursal: sucursal || undefined,
    incluir,
    anticipacionDias,
  });

  const data = lista.data;
  const recordatorios = data?.recordatorios ?? [];
  const marcarContactado = trpc.fidelizacion.marcarContactado.useMutation({
    onSuccess: () => lista.refetch(),
  });

  const abrirWhatsapp = (r: any) => {
    const msg = encodeURIComponent(armarMensaje(r.nombre, r.producto, r.estado === "atrasado"));
    if (r.telefonoWhatsapp) {
      window.open(`https://wa.me/${r.telefonoWhatsapp}?text=${msg}`, "_blank");
    } else {
      navigator.clipboard?.writeText(decodeURIComponent(msg));
      alert(`Este cliente no tiene un número de celular válido para WhatsApp (tel: ${r.telefono}). El mensaje se copió al portapapeles para que lo envíes manualmente.`);
    }
    // Registrar el contacto para no repetirlo (se marca aunque copie el mensaje)
    marcarContactado.mutate({ idCliente: r.idCliente, producto: r.producto, telefono: r.telefono, estado: r.estado });
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center">
          <HeartHandshake className="w-6 h-6 text-rose-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fidelización de clientes</h1>
          <p className="text-sm text-slate-500">Clientes de tratamiento crónico por recordar hoy</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center my-4">
        <select
          value={sucursal}
          onChange={(e) => setSucursal(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="">Todas las sucursales</option>
          {(sucursales.data ?? []).map((s: string) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
          {([
            { id: "ambos", label: "Todos" },
            { id: "por_acabar", label: "Por acabar" },
            { id: "atrasado", label: "Atrasados" },
          ] as const).map((op) => (
            <button
              key={op.id}
              onClick={() => setIncluir(op.id)}
              className={`px-3 py-2 text-sm ${incluir === op.id ? "bg-rose-600 text-white" : "bg-white text-slate-600"}`}
            >
              {op.label}
            </button>
          ))}
        </div>

        <label className="text-sm text-slate-500 flex items-center gap-1 ml-1">
          Avisar
          <select
            value={anticipacionDias}
            onChange={(e) => setAnticipacionDias(Number(e.target.value))}
            className="px-2 py-1 rounded-lg border border-slate-200 text-sm bg-white"
          >
            <option value={3}>3 días antes</option>
            <option value={5}>5 días antes</option>
            <option value={7}>7 días antes</option>
            <option value={10}>10 días antes</option>
          </select>
        </label>
      </div>

      {/* Resumen */}
      {data && !data.error && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Tarjeta color="rose" icono={<Clock className="w-4 h-4" />} valor={data.resumen.porAcabar} etiqueta="Por acabar" />
          <Tarjeta color="amber" icono={<AlertTriangle className="w-4 h-4" />} valor={data.resumen.atrasados} etiqueta="Atrasados" />
          <Tarjeta color="slate" icono={<Phone className="w-4 h-4" />} valor={data.resumen.clientesUnicos} etiqueta="Clientes" />
        </div>
      )}

      {/* Estados */}
      {lista.isLoading && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Analizando patrones de compra...
        </div>
      )}

      {data?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          Error: {data.error}
        </div>
      )}

      {data && !data.error && recordatorios.length === 0 && (
        <div className="text-center py-12">
          <CalendarClock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No hay clientes por recordar hoy</p>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">{data.cobertura.nota}</p>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {recordatorios.map((r: any, i: number) => (
          <div
            key={`${r.idCliente}-${r.producto}-${i}`}
            className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 hover:border-rose-200 transition-colors"
          >
            {/* Estado */}
            <div className={`shrink-0 w-1.5 self-stretch rounded-full ${r.estado === "atrasado" ? "bg-amber-400" : "bg-rose-400"}`} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800 truncate">{r.nombre}</span>
                {r.confianza === "alta" && (
                  <span title="Patrón de compra muy regular (3+ compras)" className="inline-flex items-center gap-0.5 text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    <Star className="w-3 h-3" /> fiel
                  </span>
                )}
                <span className={`text-[11px] px-1.5 py-0.5 rounded ${r.estado === "atrasado" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                  {r.estado === "atrasado"
                    ? `atrasado ${Math.abs(r.diasParaProxima)}d`
                    : `en ${r.diasParaProxima}d`}
                </span>
                {r.yaContactado && (
                  <span title="Ya le enviaste un recordatorio de este producto hace poco" className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                    ✓ contactado
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
                <Package className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{r.producto}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Compra cada ~{r.intervaloDias} días · {r.veces} veces · última {r.ultimaCompra}
                {r.sucursal ? ` · ${r.sucursal}` : ""}
              </div>
            </div>

            <button
              onClick={() => abrirWhatsapp(r)}
              className={`shrink-0 inline-flex items-center gap-1.5 text-white text-sm font-medium px-3 py-2 rounded-lg ${r.yaContactado ? "bg-slate-400 hover:bg-slate-500" : "bg-emerald-600 hover:bg-emerald-700"}`}
            >
              <MessageCircle className="w-4 h-4" />
              {r.yaContactado ? "Reenviar" : "WhatsApp"}
            </button>
          </div>
        ))}
      </div>

      {/* Nota de cobertura */}
      {data && !data.error && recordatorios.length > 0 && (
        <div className="flex items-start gap-2 mt-5 text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{data.cobertura.nota}</span>
        </div>
      )}
    </div>
  );
}

function Tarjeta({ color, icono, valor, etiqueta }: { color: string; icono: React.ReactNode; valor: number; etiqueta: string }) {
  const colores: Record<string, string> = {
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mb-1 ${colores[color]}`}>{icono}</div>
      <div className="text-2xl font-bold text-slate-800">{valor}</div>
      <div className="text-xs text-slate-500">{etiqueta}</div>
    </div>
  );
}
