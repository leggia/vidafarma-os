import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, Loader2, Sparkles, Mic, MicOff, Volume2, VolumeX } from "lucide-react";

type Mensaje = { rol: "user" | "assistant"; texto: string; herramienta?: string };

// Quita marcado y símbolos que la voz no debe leer literalmente.
function limpiarParaVoz(texto: string): string {
  return texto.replace(/\*\*/g, "").replace(/[_#`]/g, "").replace(/\n+/g, ". ").trim();
}

const SUGERENCIAS = [
  "¿Cuánto vendí hoy?",
  "¿Cuál es mi producto más vendido este mes?",
  "¿Cuánto gané este mes?",
  "¿Cuánto le compré a Bago este mes?",
  "¿Cuánto cuesta el paracetamol?",
];

export default function Asistente() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pregunta, setPregunta] = useState("");
  const preguntar = trpc.asistente.preguntar.useMutation();
  const finRef = useRef<HTMLDivElement>(null);

  // ─── Voz: escuchar (Speech-to-Text) y hablar (Text-to-Speech), nativas del navegador ───
  const soportaVoz = typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const [escuchando, setEscuchando] = useState(false);
  const [vozActiva, setVozActiva] = useState(() => typeof window !== "undefined" && localStorage.getItem("asistente_voz") !== "0");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem("asistente_voz", vozActiva ? "1" : "0");
    if (!vozActiva) window.speechSynthesis?.cancel();
  }, [vozActiva]);

  const hablar = (texto: string) => {
    if (!vozActiva || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(limpiarParaVoz(texto));
    utter.lang = "es-ES";
    window.speechSynthesis.speak(utter);
  };

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, preguntar.isPending]);

  const enviar = async (texto?: string) => {
    const q = (texto ?? pregunta).trim();
    if (!q || preguntar.isPending) return;
    setPregunta("");
    const nuevoHistorial = [...mensajes, { rol: "user" as const, texto: q }];
    setMensajes(nuevoHistorial);
    try {
      const res = await preguntar.mutateAsync({
        pregunta: q,
        historial: mensajes.slice(-8).map(m => ({ rol: m.rol, texto: m.texto })),
      });
      setMensajes(prev => [...prev, { rol: "assistant", texto: res.respuesta, herramienta: res.usoHerramienta || undefined }]);
      hablar(res.respuesta);
    } catch (e: any) {
      setMensajes(prev => [...prev, { rol: "assistant", texto: "Hubo un problema al procesar tu pregunta. Intenta de nuevo." }]);
    }
  };

  const iniciarEscucha = () => {
    if (!soportaVoz || escuchando || preguntar.isPending) return;
    window.speechSynthesis?.cancel();
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new Ctor();
    recognition.lang = "es-BO";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e: any) => {
      const texto = e.results?.[0]?.[0]?.transcript;
      if (texto) enviar(texto);
    };
    recognition.onerror = () => setEscuchando(false);
    recognition.onend = () => setEscuchando(false);
    recognitionRef.current = recognition;
    recognition.start();
    setEscuchando(true);
  };

  const detenerEscucha = () => {
    recognitionRef.current?.stop();
    setEscuchando(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">Asistente VidaFarma</h1>
          <p className="text-[11px] text-muted-foreground">Pregúntame sobre ventas, compras, productos y más</p>
        </div>
      </div>

      {/* Conversación */}
      <div className="flex-1 overflow-auto rounded-xl border bg-card p-4 space-y-4">
        {mensajes.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Bot className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="font-semibold">¿En qué te ayudo hoy?</p>
              <p className="text-xs text-muted-foreground mt-1">Escribe una pregunta o prueba una de estas:</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {SUGERENCIAS.map((s, i) => (
                <button key={i} onClick={() => enviar(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensajes.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.rol === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center ${m.rol === "user" ? "bg-blue-600" : "bg-gradient-to-br from-emerald-500 to-teal-600"}`}>
              {m.rol === "user" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
            </div>
            <div className={`max-w-[80%] ${m.rol === "user" ? "items-end" : "items-start"} flex flex-col`}>
              <div className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${m.rol === "user" ? "bg-blue-600 text-white rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>
                {m.texto}
              </div>
              {m.herramienta && (
                <span className="text-[9px] text-muted-foreground mt-1 px-1">consultó: {m.herramienta}</span>
              )}
            </div>
          </div>
        ))}

        {preguntar.isPending && (
          <div className="flex gap-2.5">
            <div className="h-8 w-8 rounded-lg shrink-0 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Consultando...</span>
            </div>
          </div>
        )}
        <div ref={finRef} />
      </div>

      {/* Indicador de escucha */}
      {escuchando && (
        <div className="flex items-center justify-center gap-2 text-xs text-red-600 mt-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" /> Escuchando... habla ahora
        </div>
      )}

      {/* Caja de texto */}
      <div className="flex gap-2 mt-3">
        <Input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
          placeholder={escuchando ? "Escuchando..." : "Escribe tu pregunta..."}
          className="flex-1"
          disabled={preguntar.isPending || escuchando}
        />
        {soportaVoz && (
          <Button
            type="button"
            onClick={escuchando ? detenerEscucha : iniciarEscucha}
            disabled={preguntar.isPending}
            size="icon"
            variant={escuchando ? "destructive" : "outline"}
            className="shrink-0"
            title={escuchando ? "Detener grabación" : "Hablar"}
          >
            {escuchando ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
        <Button
          type="button"
          onClick={() => setVozActiva(v => !v)}
          size="icon"
          variant="outline"
          className="shrink-0"
          title={vozActiva ? "Silenciar respuestas" : "Activar voz en respuestas"}
        >
          {vozActiva ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
        <Button onClick={() => enviar()} disabled={preguntar.isPending || !pregunta.trim()} size="icon" className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-2">
        {soportaVoz ? "Toca el micrófono para hablar. " : ""}Las acciones (precios, gastos) siempre piden tu confirmación y quedan auditadas. Verifica cifras importantes en sus reportes.
      </p>
    </div>
  );
}
