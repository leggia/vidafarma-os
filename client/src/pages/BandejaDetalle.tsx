/**
 * DETALLE de una factura de la bandeja: cabecera + productos con su estado de
 * emparejamiento y vencimiento. Permite editar vencimientos (texto libre) y ver
 * el progreso. El emparejamiento profundo con 365 se integrará en el Paso B.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { useEffect, useState } from "react";

// Formato del vencimiento mientras se escribe (igual que en NuevaCompra).
function formatearVenc(valor: string): string {
  const d = valor.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4, 8)}`;
}
function mostrarVenc(v: string | null | undefined): string {
  if (!v) return "";
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return v;
}

export default function BandejaDetalle() {
  const [, params] = useRoute("/bandeja/:id");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const id = params?.id ? parseInt(params.id) : 0;

  const { data: factura, isLoading } = trpc.bandeja.detalle.useQuery({ id }, { enabled: id > 0 });
  const [items, setItems] = useState<any[]>([]);
  const guardar = trpc.bandeja.actualizarItems.useMutation();

  useEffect(() => {
    if (factura?.items) setItems(factura.items as any[]);
  }, [factura]);

  const setVenc = (idx: number, valor: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, expiryDate: valor } : it)));
  };

  const onGuardar = async () => {
    // Normalizar vencimientos tecleados a YYYY-MM-DD antes de guardar.
    const norm = items.map((it) => {
      let ed = it.expiryDate;
      if (ed && !/^\d{4}-\d{2}-\d{2}$/.test(ed)) {
        const mmYY = ed.match(/^(\d{1,2})\/(\d{2})$/);
        const dmY = ed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (mmYY) {
          const mes = mmYY[1].padStart(2, "0"); const anio = `20${mmYY[2]}`;
          const ud = new Date(+anio, +mes, 0).getDate();
          ed = `${anio}-${mes}-${ud}`;
        } else if (dmY) {
          ed = `${dmY[3]}-${dmY[2].padStart(2, "0")}-${dmY[1].padStart(2, "0")}`;
        }
      }
      return { ...it, expiryDate: ed || null };
    });
    try {
      await guardar.mutateAsync({ id, items: norm });
      await utils.bandeja.detalle.invalidate({ id });
      await utils.bandeja.listar.invalidate();
      toast.success("Vencimientos guardados");
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    }
  };

  if (isLoading) return <div className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!factura) return <div className="p-8 text-sm text-muted-foreground">Factura no encontrada.</div>;

  const faltanVenc = items.filter((it) => !it.expiryDate).length;

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-8">
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => setLocation("/bandeja")}>
        <ArrowLeft className="h-4 w-4" /> Volver a la bandeja
      </Button>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold">{factura.proveedor || "Proveedor desconocido"}</h1>
              <p className="text-sm text-muted-foreground">
                Factura {factura.numeroFactura || "?"} · Bs {Number(factura.montoTotal).toFixed(2)} · {factura.totalItems} productos
              </p>
            </div>
            <Badge variant="outline">{factura.estado}</Badge>
          </div>
          {faltanVenc > 0 && (
            <p className="text-xs text-amber-700 mt-2">Faltan {faltanVenc} vencimiento(s). Complétalos abajo (ej: 11/27 o 31/12/2027).</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {items.map((it, idx) => (
          <Card key={idx}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{it.productName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    x{it.quantity} · Bs {Number(it.unitCost).toFixed(2)} c/u
                    {it.articuloId ? " · ✓ emparejado" : " · sin emparejar"}
                  </p>
                </div>
                <div className="w-32 shrink-0">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/AA"
                    value={mostrarVenc(it.expiryDate)}
                    onChange={(e) => setVenc(idx, formatearVenc(e.target.value))}
                    className={`h-8 text-sm text-center ${!it.expiryDate ? "border-amber-400 bg-amber-50/50" : ""}`}
                    maxLength={10}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={onGuardar} disabled={guardar.isPending} className="gap-2">
          {guardar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar vencimientos
        </Button>
      </div>
    </div>
  );
}
