import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  User, 
  Bot, 
  MessageSquare,
  Volume2 as SpeakerIcon,
  HelpCircle,
  Clock,
  ArrowRight,
  Loader2
} from "lucide-react";
import { 
  ClientesService, 
  ServiciosService, 
  EquiposService, 
  TecnicosService 
} from "../services/db";
import { GeminiConfigService } from "../services/geminiConfig";
import { useAuth } from "../providers/AuthProvider";
import { useNavigation } from "../providers/NavigationProvider";
import { Cliente, Servicio } from "../types";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Browser Web Speech API setup
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function Agente() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "¡Hola! Soy tu Agente virtual de Econoservice. Estoy conectado a la base de datos del taller. Puedes preguntarme sobre las entregas de hoy, los retiros agendados, buscar detalles de un lavarropas o consultar el estado de cualquier orden. ¿En qué te ayudo hoy?",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [activeServices, setActiveServices] = useState<any[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load context data on mount
  useEffect(() => {
    const loadSystemContext = async () => {
      try {
        // 1. Fetch active work orders (non-delivered)
        const services = await ServiciosService.getActive();
        
        // 2. Load clients & technicians in parallel to map names and addresses
        const [allClients, allTecnicos] = await Promise.all([
          ClientesService.getAll(),
          TecnicosService.getAll()
        ]);

        const clientMap = new Map(allClients.map(c => [c.id, c]));
        const tecMap = new Map(allTecnicos.map(t => [t.id, t.nombre]));

        const formattedContext = services.map(s => {
          const client = clientMap.get(s.clienteId);
          const tecName = s.tecnicoId ? tecMap.get(s.tecnicoId) || "No encontrado" : "Sin asignar";
          
          let address = "Sin dirección";
          if (client) {
            address = [
              client.calle ? `${client.calle} ${client.numero || ""}`.trim() : "",
              client.barrio ? `Barrio ${client.barrio}` : "",
              client.localidad ? client.localidad : ""
            ].filter(Boolean).join(", ");
          }

          return {
            numeroServicio: s.numeroServicio,
            aparato: s.aparato,
            marcaModelo: s.marcaModelo,
            clienteNombre: client?.nombreApellido || "S/D",
            clienteTelefono: [client?.telCel, client?.telFijo].filter(Boolean).join(" / "),
            clienteDireccion: address,
            desperfectoUsuario: s.desperfectoUsuario,
            estado: s.estado,
            fechaIngreso: s.fechaIngreso ? s.fechaIngreso.substring(0, 10) : "",
            citaDia: s.citaDia ? s.citaDia.substring(0, 10) : "",
            citaEntrega: s.citaEntrega ? s.citaEntrega.substring(0, 10) : "",
            horaEntregaDesde: s.horaEntregaDesde || "",
            horaEntregaHasta: s.horaEntregaHasta || "",
            infoLogistica: s.infoLogistica || "",
            notasInternas: s.notasInternas || "",
            tecnicoNombre: tecName
          };
        });

        setActiveServices(formattedContext);
        setContextLoaded(true);
      } catch (err) {
        console.error("Error loading system context for Agent:", err);
      }
    };

    loadSystemContext();
  }, []);

  // Handle Voice Synthesis (Speaking)
  const speakText = (text: string) => {
    if (!window.speechSynthesis || !speechEnabled) return;
    window.speechSynthesis.cancel(); // cancel any active speech

    // Clean text from emoji symbols to prevent spelling issues
    const cleanText = text.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "es-AR";

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Stop current speaking
  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // Start Speech Recognition (Listening)
  const startListening = () => {
    if (!SpeechRecognition) {
      alert("El reconocimiento de voz no está soportado en este navegador. Recomendamos Google Chrome o Safari.");
      return;
    }
    
    stopSpeaking();

    const recognition = new SpeechRecognition();
    recognition.lang = "es-AR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      if (text && text.trim()) {
        handleSendMessage(text);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Stop Speech Recognition
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  // Send message to assistant
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setLoading(true);

    try {
      const config = await GeminiConfigService.getConfig();
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const res = await fetch("/api/agente/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          contextServices: activeServices,
          todayStr,
          apiKey: config.apiKey,
          model: config.model
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al conectar con la IA.");
      }

      const data = await res.json();
      const reply = data.response || "No recibí respuesta.";

      setMessages(prev => [...prev, {
        role: "assistant",
        content: reply,
        timestamp: new Date()
      }]);

      // Speak response if user enabled voice
      if (speechEnabled) {
        speakText(reply);
      }
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Error: ${err.message || "No se pudo conectar con el servidor."}`,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestClick = (prompt: string) => {
    handleSendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] max-w-6xl mx-auto px-4 py-4 md:py-6 gap-6">
      
      {/* Wave Keyframes Style Injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes wave-bounce {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
        .animate-wave-1 { animation: wave-bounce 0.8s ease-in-out infinite 0.1s; }
        .animate-wave-2 { animation: wave-bounce 0.8s ease-in-out infinite 0.25s; }
        .animate-wave-3 { animation: wave-bounce 0.8s ease-in-out infinite 0.4s; }
        .animate-wave-4 { animation: wave-bounce 0.8s ease-in-out infinite 0.2s; }
        .animate-wave-5 { animation: wave-bounce 0.8s ease-in-out infinite 0.35s; }
      `}} />

      {/* Title section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-150 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-500 animate-pulse" />
            Asistente Agente Inteligente
          </h1>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            Tu copiloto conversacional para consultar el estado de servicios, taller y logística en tiempo real.
          </p>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold ${
            contextLoaded 
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30" 
              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30"
          }`}>
            <Clock className="w-3.5 h-3.5" />
            {contextLoaded ? `Datos Sincronizados (${activeServices.length} Activos)` : "Cargando taller..."}
          </span>
          
          <button
            onClick={() => setSpeechEnabled(!speechEnabled)}
            className={`p-2 rounded-xl border transition-all ${
              speechEnabled
                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/35 hover:bg-indigo-100/50"
                : "bg-slate-100 dark:bg-gray-800 text-slate-400 border-slate-200 dark:border-gray-700 hover:bg-slate-200/55"
            }`}
            title={speechEnabled ? "Desactivar salida de voz" : "Activar salida de voz"}
          >
            {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Chat Area */}
        <div className="lg:col-span-8 flex flex-col bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800 rounded-2xl shadow-xs overflow-hidden h-full min-h-[300px]">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50/50 dark:bg-gray-855/20 border-b border-slate-150 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              Chat de Consulta
            </span>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, idx) => (
              <div 
                key={idx} 
                className={`flex gap-3 max-w-[85%] ${m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border ${
                  m.role === "user" 
                    ? "bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 border-slate-200/80 dark:border-gray-700" 
                    : "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/35"
                }`}>
                  {m.role === "user" ? <User className="w-4.5 h-4.5" /> : <Bot className="w-4.5 h-4.5" />}
                </div>

                {/* Bubble */}
                <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-none"
                    : "bg-slate-50 dark:bg-gray-855 text-slate-800 dark:text-gray-250 border border-slate-100 dark:border-gray-800 rounded-tl-none"
                }`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <span className={`block text-[9px] mt-1.5 font-semibold text-right ${
                    m.role === "user" ? "text-indigo-200" : "text-slate-400"
                  }`}>
                    {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 max-w-[85%] mr-auto">
                <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/35">
                  <Bot className="w-4.5 h-4.5" />
                </div>
                <div className="bg-slate-50 dark:bg-gray-855 text-slate-800 dark:text-gray-250 border border-slate-100 dark:border-gray-800 p-3.5 rounded-2xl rounded-tl-none">
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Suggestion Chips */}
          <div className="p-3 bg-slate-50/50 dark:bg-gray-850/10 border-t border-slate-100 dark:border-gray-800/80 flex flex-wrap gap-2">
            <button
              onClick={() => handleSuggestClick("¿Qué entregas hay agendadas para hoy?")}
              className="text-xs px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-xl transition-all font-semibold flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
              ¿Entregas para hoy?
            </button>
            <button
              onClick={() => handleSuggestClick("¿Hay algún retiro programado para hoy?")}
              className="text-xs px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-xl transition-all font-semibold flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
              ¿Retiros de hoy?
            </button>
            <button
              onClick={() => handleSuggestClick("Mostrame las órdenes de trabajo terminadas.")}
              className="text-xs px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 rounded-xl transition-all font-semibold flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
              ¿Qué hay terminado?
            </button>
          </div>

          {/* Form Input */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }} 
            className="p-3 bg-white dark:bg-gray-900 border-t border-slate-150 dark:border-gray-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Pregúntale al agente sobre equipos, direcciones o agenda..."
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-gray-855 text-slate-900 dark:text-white border border-slate-150 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              className="h-10 w-10 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:scale-100 hover:scale-105 active:scale-95 shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Right Column: Voice Area */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Voice Interface Card */}
          <div className="bg-white dark:bg-gray-900 border border-slate-150 dark:border-gray-800 rounded-2xl p-6 shadow-xs flex flex-col items-center justify-center text-center space-y-6 flex-1 min-h-[300px]">
            
            <div className="space-y-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-gray-500 flex items-center justify-center gap-1.5">
                <SpeakerIcon className="w-4 h-4 text-indigo-500" />
                Asistente de Voz
              </span>
              <p className="text-xs text-slate-500 dark:text-gray-400 max-w-[240px]">
                Habla de forma natural con el agente. El sistema escuchará y te responderá hablando en español.
              </p>
            </div>

            {/* Visual waveform */}
            <div className="h-16 flex items-center justify-center gap-1.5 w-full max-w-[200px]">
              {isListening || isSpeaking ? (
                <div className="flex items-end justify-center gap-1.5 h-12 w-full">
                  <div className={`w-1.5 bg-indigo-500 rounded-full origin-bottom animate-wave-1 ${isListening ? "bg-red-500" : "bg-indigo-500"}`} style={{ height: "30%" }}></div>
                  <div className={`w-1.5 bg-indigo-500 rounded-full origin-bottom animate-wave-2 ${isListening ? "bg-red-500" : "bg-indigo-500"}`} style={{ height: "60%" }}></div>
                  <div className={`w-1.5 bg-indigo-500 rounded-full origin-bottom animate-wave-3 ${isListening ? "bg-red-500" : "bg-indigo-500"}`} style={{ height: "100%" }}></div>
                  <div className={`w-1.5 bg-indigo-500 rounded-full origin-bottom animate-wave-4 ${isListening ? "bg-red-500" : "bg-indigo-500"}`} style={{ height: "50%" }}></div>
                  <div className={`w-1.5 bg-indigo-500 rounded-full origin-bottom animate-wave-5 ${isListening ? "bg-red-500" : "bg-indigo-500"}`} style={{ height: "80%" }}></div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5 h-1.5 w-32 bg-slate-100 dark:bg-gray-800 rounded-full">
                  <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-gray-600 rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-gray-600 rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-gray-600 rounded-full"></div>
                </div>
              )}
            </div>

            {/* Status messages */}
            <div className="space-y-1">
              <span className={`text-sm font-extrabold uppercase tracking-wide block ${
                isListening ? "text-red-500" : isSpeaking ? "text-indigo-500 animate-pulse" : "text-slate-400"
              }`}>
                {isListening ? "Escuchando..." : isSpeaking ? "Agente Hablando..." : "Micrófono Apagado"}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-gray-500 block">
                {isListening 
                  ? "Di tu pregunta ahora..." 
                  : isSpeaking 
                    ? "Escuchando respuesta..." 
                    : "Presiona el botón para hablar"}
              </span>
            </div>

            {/* Large Microphone button */}
            <button
              onClick={isListening ? stopListening : startListening}
              className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${
                isListening
                  ? "bg-red-500 hover:bg-red-600 border-red-200 text-white shadow-lg animate-pulse"
                  : isSpeaking
                    ? "bg-indigo-500 hover:bg-indigo-600 border-indigo-200 text-white shadow-lg"
                    : "bg-slate-50 dark:bg-gray-855 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 border-slate-200 dark:border-gray-800 text-slate-500 dark:text-gray-300 hover:text-indigo-500 shadow-sm"
              }`}
              title={isListening ? "Detener micrófono" : "Iniciar conversación de voz"}
            >
              {isListening ? (
                <MicOff className="w-8 h-8" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>

            {/* Mute speaker button */}
            {isSpeaking && (
              <button
                onClick={stopSpeaking}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-all cursor-pointer"
              >
                Silenciar Agente
              </button>
            )}
          </div>
          
          {/* Quick Help Guide */}
          <div className="bg-slate-50 dark:bg-gray-850/30 border border-slate-150 dark:border-gray-800/80 rounded-2xl p-5 space-y-3.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
              <HelpCircle className="w-4.5 h-4.5 text-indigo-500" />
              Guía de Preguntas Rápidas
            </h3>
            
            <ul className="space-y-2.5 text-xs text-slate-500 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>"¿Qué entregas hay para hoy y en qué direcciones?"</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>"¿Quién tiene asignado el lavarropas marca Drean?"</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>"Decime si hay algún retiro agendado para hoy."</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>"¿Hay alguna orden que esté en estado Aceptado?"</span>
              </li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
}
