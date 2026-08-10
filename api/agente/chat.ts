import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages, contextServices, todayStr, apiKey, model } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const resolvedApiKey = apiKey && apiKey.trim() ? apiKey.trim() : process.env.GEMINI_API_KEY;
    if (!resolvedApiKey) {
      return res.status(400).json({ error: "No Gemini API key is configured. Please configure it in Vercel environment variables or Settings." });
    }

    const resolvedModel = model && model.trim() ? model.trim() : "gemini-2.5-flash";

    const activeAi = new GoogleGenAI({
      apiKey: resolvedApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const formattedServices = contextServices && Array.isArray(contextServices)
      ? contextServices.map((s: any) => {
          return `- Orden N° #${s.numeroServicio}:
  Aparato: ${s.aparato} (${s.marcaModelo || "Modelo genérico"})
  Cliente: ${s.clienteNombre || "S/D"}
  Teléfonos: ${s.clienteTelefono || "No cargado"}
  Dirección: ${s.clienteDireccion || "No cargada"}
  Desperfecto: ${s.desperfectoUsuario || "No especificado"}
  Estado: ${s.estado || "RECIBIDO"}
  Ingreso: ${s.fechaIngreso || "Sin fecha"}
  Cita de Retiro: ${s.citaDia || "No coordinado"}
  Cita de Entrega: ${s.citaEntrega || "No coordinada"} (${s.horaEntregaDesde || ""} - ${s.horaEntregaHasta || ""})
  Info Logística: ${s.infoLogistica || "Ninguna"}
  Notas Internas: ${s.notesInternas || s.notasInternas || "Ninguna"}
  Técnico asignado: ${s.tecnicoNombre || "Sin asignar"}`;
        }).join("\n\n")
      : "No hay información de órdenes de trabajo activas disponible.";

    const systemInstruction = `Eres "Agente Econoservice", un asistente virtual inteligente, atento y servicial integrado en el sistema de gestión del Taller de Reparación de Lavarropas y Electrodomésticos Econoservice.
Tu misión es ayudar a cualquier miembro del equipo (técnicos, personal de logística, administración o recepción) a consultar el estado del taller, los servicios activos, los repartos/entregas del día, los retiros coordinados y los detalles de los clientes.

FECHA Y HORA ACTUAL DEL SISTEMA (Local del usuario): ${todayStr || new Date().toLocaleDateString("es-AR")}

INFORMACIÓN COMPLETA DE ÓRDENES DE TRABAJO ACTIVAS (TALLER Y LOGÍSTICA):
${formattedServices}

INSTRUCCIONES DE COMPORTAMIENTO:
1. Responde de forma clara, directa, concisa y muy amigable en español.
2. Utiliza emojis de forma profesional (ej. 🧼, 🚚, 🛠️, 📞) para hacer las respuestas legibles de un solo vistazo.
3. Para consultas sobre "entregas para hoy", busca órdenes cuyo estado sea "TERMINADO" (Listo para entregar) o "ENTREGA_EN_PROGRESO" (Despachado) y cuya "Cita de Entrega" coincida con la fecha actual del sistema.
4. Para consultas sobre "retiros programados", revisa las órdenes con "Cita de Retiro" que coincidan con la fecha actual.
5. Si te preguntan por un cliente o equipo en particular, busca en los campos de la dirección, nombre, marca o modelo de la lista proveída.
6. Si la pregunta del usuario es de voz o de audio (notarás que es muy directa y hablada, por ejemplo "hola que tenemos para hoy?"), responde de forma muy corta, natural y clara, idealmente en 2 o 3 oraciones sencillas, para que la síntesis de voz del navegador no resulte molesta o abrumadora.`;

    let chatHistory = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : m.role,
      parts: [{ text: m.content }]
    }));

    // Ensure first message in history is from user
    const firstUserIdx = chatHistory.findIndex(m => m.role === "user");
    if (firstUserIdx !== -1) {
      chatHistory = chatHistory.slice(firstUserIdx);
    }

    const lastUserMessage = chatHistory[chatHistory.length - 1];
    const previousHistory = chatHistory.slice(0, -1);

    const chat = activeAi.chats.create({
      model: resolvedModel,
      config: {
        systemInstruction,
      },
      history: previousHistory,
    });

    const response = await chat.sendMessage({
      message: lastUserMessage.parts[0].text,
    });

    return res.status(200).json({ response: response.text });
  } catch (error: any) {
    console.error("Error in Agent chat serverless function:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
