/**
 * CÁMARA INTELIGENTE.
 * Tomas una foto de la factura física; el sistema lee su número/proveedor y lo
 * cruza con la Bandeja de facturas XML. Según el resultado, dirige el flujo:
 *
 *  - Flujo 1: la reconoce en la bandeja (XML ya cargado) → ir a completar
 *    vencimientos de esa factura.
 *  - Flujo 3: no la reconoce (proveedor que no manda XML) → ir a NuevaCompra
 *    para la extracción por foto de siempre.
 *
 * (El Flujo 2 —XML existe pero la factura no trae vencimiento— es el mismo
 *  Flujo 1: se abre la factura y el vencimiento se deja vacío para cargar luego.)
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, CheckCircle2, FileQuestion, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useRef, useState } from "react";

export default function CamaraFactura() {
  const [, setLocation] = useLocation();
  const camInput = useRef<HTMLInputElement>(null);
  const [analizando, setAnalizando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const reconocerFoto = trpc.bandeja.reconocerFoto.useMutation();

  const onFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const foto = e.target.files?.[0];
    e.target.value = "";
    if (!foto) return;
    setResultado(null);
    setAnalizando(true);
    try {
      const base64: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(",")[1]);
        r.onerror = () => rej(new Error("lectura"));
        r.readAsDataURL(foto);
      });
      const r = await reconocerFoto.mutateAsync({ fileBase64: base64, mimeType: foto.type || "image/jpeg" });
      setResultado(r);
      if (r.reconocida) {
        toast.success(`Factura reconocida: ${r.reconocida.proveedor}`);
      } else {
        toast.info("No está en la bandeja. Puedes registrarla por foto.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al analizar la foto");
    }
    setAnalizando(false);
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <div className="border-b border-foreground pb-4">
        <h1 className="text-3xl font-black tracking-tight uppercase flex items-center gap-2">
          <Camera className="h-7 w-7" /> Escanear factura
        </h1>
        <p className="text-sm text-muted-foreground mt-1 tracking-wide">
          Enfoca la factura física; te digo si su XML ya está en la bandeja
        </p>
      </div>

      {/* Botón principal de cámara */}
      <button
        onClick={() => camInput.current?.click()}
        disabled={analizando}
        className="w-full border-2 border-dashed border-primary/40 bg-primary/5 rounded-lg p-8 text-center hover:border-primary hover:bg-primary/10 transition-colors active:scale-[0.99] disabled:opacity-60"
      >
        {analizando ? (
          <>
            <Loader2 className="h-12 w-12 mx-auto text-primary mb-2 animate-spin" />
            <p className="text-sm font-semibold text-primary">Leyendo número y proveedor…</p>
          </>
        ) : (
          <>
            <Camera className="h-12 w-12 mx-auto text-primary mb-2" />
            <p className="text-sm font-semibold text-primary">Tomar foto de la factura</p>
            <p className="text-xs text-muted-foreground mt-1">Apunta al número de factura y el nombre del proveedor</p>
          </>
        )}
      </button>
      <input ref={camInput} type="file" accept="image/*" capture="environment" onChange={onFoto} className="hidden" />

      {/* Resultado */}
      {resultado && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-xs text-muted-foreground">
              Leído: factura <b>{resultado.leido?.numeroFactura || "?"}</b> · {resultado.leido?.proveedor || "proveedor no leído"}
            </div>

            {resultado.reconocida ? (
              // FLUJO 1: reconocida en la bandeja → ir a completar vencimientos
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-emerald-900">Su XML ya está en la bandeja</p>
                    <p className="text-xs text-emerald-800">
                      {resultado.reconocida.proveedor} · Factura {resultado.reconocida.numeroFactura} ·{" "}
                      {resultado.reconocida.itemsConVencimiento}/{resultado.reconocida.totalItems} con vencimiento
                    </p>
                  </div>
                </div>
                <Button className="w-full mt-3 gap-2" onClick={() => setLocation(`/bandeja/${resultado.reconocida.id}`)}>
                  Completar vencimientos <ArrowRight className="h-4 w-4" />
                </Button>
                {resultado.coincidencias.length > 1 && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Hay {resultado.coincidencias.length} coincidencias posibles. Si esta no es, ábrela desde la bandeja.
                  </p>
                )}
              </div>
            ) : (
              // FLUJO 3: no está en la bandeja → registrar por foto (extracción normal)
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-300">
                <div className="flex items-start gap-2">
                  <FileQuestion className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-amber-900">No está en la bandeja</p>
                    <p className="text-xs text-amber-800">
                      Este proveedor no envió el XML. Regístrala por foto como siempre.
                    </p>
                  </div>
                </div>
                <Button className="w-full mt-3 gap-2" variant="outline" onClick={() => setLocation("/compras/nueva")}>
                  Registrar por foto <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        Las facturas con XML llegan a la <button className="underline" onClick={() => setLocation("/bandeja")}>bandeja</button> (por ahora subiéndolas; pronto por correo).
      </p>
    </div>
  );
}
