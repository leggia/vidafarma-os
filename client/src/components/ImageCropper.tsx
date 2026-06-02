import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, RotateCw } from "lucide-react";

interface ImageCropperProps {
  imageUrl: string;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
}

// Recortador de imagen simple con rectángulo ajustable por esquinas.
// Pensado para móvil: omitir dedos, bordes oscuros, etc.
export default function ImageCropper({ imageUrl, onConfirm, onCancel }: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [rotation, setRotation] = useState(0);
  // Rectángulo de recorte en porcentaje (0-1) relativo a la imagen mostrada
  const [crop, setCrop] = useState({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const [drag, setDrag] = useState<{ corner: string; startX: number; startY: number; startCrop: typeof crop } | null>(null);

  const getPoint = (e: React.TouchEvent | React.MouseEvent) => {
    if ("touches" in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    const me = e as React.MouseEvent;
    return { x: me.clientX, y: me.clientY };
  };

  const startDrag = (corner: string) => (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    const p = getPoint(e);
    setDrag({ corner, startX: p.x, startY: p.y, startCrop: { ...crop } });
  };

  const onMove = useCallback((clientX: number, clientY: number) => {
    if (!drag || !containerRef.current || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const dx = (clientX - drag.startX) / rect.width;
    const dy = (clientY - drag.startY) / rect.height;
    let { x, y, w, h } = drag.startCrop;
    const min = 0.1; // tamaño mínimo

    if (drag.corner === "move") {
      x = Math.max(0, Math.min(1 - w, drag.startCrop.x + dx));
      y = Math.max(0, Math.min(1 - h, drag.startCrop.y + dy));
    } else {
      if (drag.corner.includes("e")) w = Math.max(min, Math.min(1 - x, drag.startCrop.w + dx));
      if (drag.corner.includes("s")) h = Math.max(min, Math.min(1 - y, drag.startCrop.h + dy));
      if (drag.corner.includes("w")) {
        const nx = Math.max(0, Math.min(drag.startCrop.x + drag.startCrop.w - min, drag.startCrop.x + dx));
        w = drag.startCrop.w + (drag.startCrop.x - nx);
        x = nx;
      }
      if (drag.corner.includes("n")) {
        const ny = Math.max(0, Math.min(drag.startCrop.y + drag.startCrop.h - min, drag.startCrop.y + dy));
        h = drag.startCrop.h + (drag.startCrop.y - ny);
        y = ny;
      }
    }
    setCrop({ x, y, w, h });
  }, [drag]);

  useEffect(() => {
    const handleMove = (e: TouchEvent | MouseEvent) => {
      if (!drag) return;
      e.preventDefault();
      if ("touches" in e && e.touches.length > 0) onMove(e.touches[0].clientX, e.touches[0].clientY);
      else if ("clientX" in e) onMove((e as MouseEvent).clientX, (e as MouseEvent).clientY);
    };
    const handleUp = () => setDrag(null);
    if (drag) {
      window.addEventListener("touchmove", handleMove, { passive: false });
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("touchend", handleUp);
      window.addEventListener("mouseup", handleUp);
    }
    return () => {
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchend", handleUp);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [drag, onMove]);

  const aplicarRecorte = async () => {
    const img = new Image();
    img.onload = () => {
      // Crear canvas con rotación
      const rad = (rotation * Math.PI) / 180;
      const rotated = rotation % 180 !== 0;
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;

      // Canvas temporal para la imagen rotada
      const tmp = document.createElement("canvas");
      tmp.width = rotated ? natH : natW;
      tmp.height = rotated ? natW : natH;
      const tctx = tmp.getContext("2d")!;
      tctx.translate(tmp.width / 2, tmp.height / 2);
      tctx.rotate(rad);
      tctx.drawImage(img, -natW / 2, -natH / 2);

      // Recortar la región seleccionada
      const cropX = crop.x * tmp.width;
      const cropY = crop.y * tmp.height;
      const cropW = crop.w * tmp.width;
      const cropH = crop.h * tmp.height;

      const out = document.createElement("canvas");
      out.width = cropW;
      out.height = cropH;
      const octx = out.getContext("2d")!;
      octx.drawImage(tmp, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      out.toBlob((blob) => {
        if (blob) {
          onConfirm(new File([blob], "recorte.jpg", { type: "image/jpeg" }));
        }
      }, "image/jpeg", 0.9);
    };
    img.src = imageUrl;
  };

  const handles = [
    { id: "nw", style: { left: `${crop.x * 100}%`, top: `${crop.y * 100}%` } },
    { id: "ne", style: { left: `${(crop.x + crop.w) * 100}%`, top: `${crop.y * 100}%` } },
    { id: "sw", style: { left: `${crop.x * 100}%`, top: `${(crop.y + crop.h) * 100}%` } },
    { id: "se", style: { left: `${(crop.x + crop.w) * 100}%`, top: `${(crop.y + crop.h) * 100}%` } },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between p-3 text-white">
        <button onClick={onCancel} className="p-2"><X className="h-5 w-5" /></button>
        <span className="text-sm font-medium">Recorta la factura</span>
        <button onClick={() => setRotation((r) => (r + 90) % 360)} className="p-2"><RotateCw className="h-5 w-5" /></button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div ref={containerRef} className="relative inline-block max-w-full max-h-full">
          <img
            ref={imgRef}
            src={imageUrl}
            onLoad={() => setImgLoaded(true)}
            style={{ transform: `rotate(${rotation}deg)`, maxHeight: "65vh", maxWidth: "100%" }}
            className="block select-none"
            draggable={false}
            alt="Para recortar"
          />
          {imgLoaded && (
            <>
              {/* Overlay oscuro fuera del recorte */}
              <div
                className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                  cursor: "move",
                  touchAction: "none",
                }}
                onTouchStart={startDrag("move")}
                onMouseDown={startDrag("move")}
              />
              {/* Esquinas arrastrables */}
              {handles.map((h) => (
                <div
                  key={h.id}
                  className="absolute w-7 h-7 -ml-3.5 -mt-3.5 bg-white rounded-full border-2 border-green-600 shadow-lg"
                  style={{ ...h.style, touchAction: "none" }}
                  onTouchStart={startDrag(h.id)}
                  onMouseDown={startDrag(h.id)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <div className="p-4 flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1 bg-white/10 text-white border-white/30 hover:bg-white/20">
          Cancelar
        </Button>
        <Button onClick={aplicarRecorte} className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2">
          <Check className="h-4 w-4" /> Usar recorte
        </Button>
      </div>
    </div>
  );
}
