/**
 * PEDIDOS — pedido sugerido por proveedor, por sucursal o consolidado de todas.
 * Rotación real (3 meses de ventas por sucursal) vs stock actual del almacén.
 * Las cantidades son editables y el pedido final se copia listo para enviar.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Copy, Loader2, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

const SUCURSALES = [
  { id: null as number | null, nombre: "Todas (consolidado)" },
  { id: 1, nombre: "Casa Matriz" },
  { id: 2, nombre: "Petrolera" },
  { id: 3, nombre: "Lanza" },
  { id: 4, nombre: "Cobol" },
];

export default function Pedidos() {
  const [almacenId, setAlmacenId] = useState<number | null>(2);
  const [proveedor, setProveedor] = useState("");
  const [dias, setDias] = useState(10);
  // Parámetros "congelados" al presionar Generar (evita re-consultas por cada tecla)
  const [consulta, setConsulta] = useState<{ almacenId: number | null; proveedor: string; dias: number } | null>(null);
  // Ajustes del usuario: cantidad final y exclusiones, por producto
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [excluidos, setExcluidos] = useState<Record<string, boolean>>({});

  const { data, isFetching } = trpc.pedidos.sugerido.useQuery(
    consulta ?? { almacenId: 2, proveedor: "", dias: 10 },
    { enabled: consulta !== null, refetchOnWindowFocus: false },
  );

  const generar = () => {
    setCantidades({});
    setExcluidos({});
    setConsulta({ almacenId, proveedor: proveedor.trim(), dias });
  };

  const items: any[] = data && data.modo !== "error" ? (data as any).items : [];
  const esConsolidado = data?.modo === "consolidado";

  const cantidadDe = (it: any) =>
    cantidades[it.producto] ?? (esConsolidado ? it.totalSugerido : it.cantidadSugerida);

  const seleccionados = useMemo(
    () => items.filter((it) => !excluidos[it.producto] && cantidadDe(it) > 0),
    [items, excluidos, cantidades],
  );

  const copiarPedido = async () => {
    const titulo = esConsolidado
      ? `PEDIDO CONSOLIDADO (todas las sucursales)`
      : `PEDIDO — ${(data as any)?.sucursal ?? ""}`;
    const prov = consulta?.proveedor ? ` · Proveedor: ${consulta.proveedor.toUpperCase()}` : "";
    const lineas = seleccionados.map((it) => `• ${it.producto} — ${cantidadDe(it)} und`);
    const texto = `${titulo}${prov} · Cobertura ${consulta?.dias} días\n${lineas.join("\n")}\nTotal: ${seleccionados.length} productos`;
    await navigator.clipboard.writeText(texto);
    toast.success(`Pedido copiado (${seleccionados.length} productos). Pégalo en WhatsApp o correo.`);
  };

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5" />
        <h1 className="text-lg font-bold">Pedidos sugeridos</h1>
      </div>

      {/* Controles */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {SUCURSALES.map((s) => (
              <Button
                key={String(s.id)}
                size="sm"
                variant={almacenId === s.id ? "default" : "outline"}
                onClick={() => setAlmacenId(s.id)}
              >
                {s.nombre}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-muted-foreground">Proveedor (opcional)</label>
              <Input
                placeholder="Ej: cofar, inti, bagó…"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generar()}
              />
            </div>
            <div className="w-28">
              <label className="text-xs text-muted-foreground">Días a cubrir</label>
              <Input
                type="number" min={1} max={90} value={dias}
                onChange={(e) => setDias(Math.min(90, Math.max(1, parseInt(e.target.value) || 10)))}
              />
            </div>
            <Button onClick={generar} disabled={isFetching}>
              {isFetching ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
              Generar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estados */}
      {consulta === null && (
        <p className="text-sm text-muted-foreground">
          Elige la sucursal (o el consolidado de todas), filtra por proveedor si quieres, y presiona Generar.
          El cálculo usa la rotación real de ventas de cada sucursal contra su stock actual.
        </p>
      )}
      {data?.modo === "error" && (
        <Card><CardContent className="p-4 text-sm text-red-600">{(data as any).error}</CardContent></Card>
      )}
      {data && data.modo !== "error" && items.length === 0 && !isFetching && (
        <Card><CardContent className="p-4 text-sm">
          Sin productos por pedir: el stock cubre {consulta?.dias} días de venta
          {consulta?.proveedor ? ` para "${consulta.proveedor}"` : ""}.
        </CardContent></Card>
      )}

      {/* Resultado */}
      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm text-muted-foreground">
              {items.length} productos · cobertura {consulta?.dias} días
              {esConsolidado && " · consolidado de las 4 sucursales"}
            </div>
            <Button size="sm" onClick={copiarPedido} disabled={seleccionados.length === 0}>
              <Copy className="w-4 h-4 mr-1" /> Copiar pedido ({seleccionados.length})
            </Button>
          </div>

          <div className="space-y-2">
            {items.map((it) => {
              const excluido = !!excluidos[it.producto];
              return (
                <Card key={it.producto} className={excluido ? "opacity-45" : ""}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm leading-tight">{it.producto}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {esConsolidado ? (
                            <>total sugerido {it.totalSugerido} und{it.proveedor ? ` · ${it.proveedor}` : ""}</>
                          ) : (
                            <>
                              vende {it.ventaDiaria}/día · stock {it.stockActual} · le quedan{" "}
                              <span className={it.coberturaDias < 3 ? "text-red-600 font-semibold" : ""}>
                                {it.coberturaDias} días
                              </span>
                            </>
                          )}
                        </div>
                        {it.descuadre && (
                          <Badge variant="outline" className="mt-1 text-amber-600 border-amber-600 text-[10px]">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Stock negativo en 365: revisar inventario
                          </Badge>
                        )}
                        {esConsolidado && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                            {Object.entries(it.porSucursal as Record<string, any>).map(([suc, d]) => (
                              <span key={suc}>
                                {suc}: <b>{d.sugerido}</b> (stock {d.stock}, {d.ventaDiaria}/día)
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          type="number" min={0}
                          className="w-20 h-8 text-right"
                          value={cantidadDe(it)}
                          disabled={excluido}
                          onChange={(e) =>
                            setCantidades((p) => ({ ...p, [it.producto]: Math.max(0, parseInt(e.target.value) || 0) }))
                          }
                        />
                        <Button
                          size="sm" variant="ghost" className="h-8 px-2 text-xs"
                          onClick={() => setExcluidos((p) => ({ ...p, [it.producto]: !excluido }))}
                        >
                          {excluido ? "Incluir" : "Quitar"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-end pb-6">
            <Button onClick={copiarPedido} disabled={seleccionados.length === 0}>
              <Copy className="w-4 h-4 mr-1" /> Copiar pedido ({seleccionados.length} productos)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
