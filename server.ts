import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { WhatsAppService } from "./src/services/whatsappService";
import { GeminiConfigService } from "./src/services/geminiConfig";
import { supabase } from "./src/lib/supabase";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware for parsing JSON bodies
app.use(express.json({ limit: "10mb" }));

// API routes go here FIRST
app.post("/api/insumos/chat", async (req, res) => {
  try {
    const { messages, contextInsumos, apiKey, model } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const resolvedApiKey = apiKey && apiKey.trim() ? apiKey.trim() : process.env.GEMINI_API_KEY;
    if (!resolvedApiKey) {
      return res.status(400).json({ error: "No Gemini API key is configured. Please configure it in Settings or contact the administrator." });
    }

    const resolvedModel = model && model.trim() ? model.trim() : "gemini-2.5-flash";

    // Dynamic GoogleGenAI instance using the chosen API key
    const activeAi = new GoogleGenAI({
      apiKey: resolvedApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    // Format context for the assistant
    const formattedInsumos = contextInsumos && Array.isArray(contextInsumos) 
      ? contextInsumos.map((s: any) => {
          return `- Orden N° #${s.numeroServicio}:
  Aparato: ${s.aparato} (${s.marcaModelo})
  Cliente: ${s.clienteNombre || "S/D"}
  Técnico: ${s.tecnicoNombre || "S/D"}
  Estado Servicio: ${s.estado}
  Repuestos Necesarios (A Comprar): ${s.repuestosComprar || "Ninguno"}
  Repuestos Disponibles (Comprados): ${s.repuestosComprados || "Ninguno"}`;
        }).join("\n\n")
      : "No hay información de insumos disponible.";

    // System instruction for Gemini
    const systemInstruction = `Eres un asistente de compras y almacén experto para un Taller de Lavarropas y Electrodomésticos.
Tu tarea es ayudar al personal del taller con la gestión de insumos y repuestos basándote ÚNICAMENTE en la lista de órdenes de trabajo con repuestos requeridos que se te proporciona a continuación.

INFORMACIÓN DEL TALLER (Órdenes de Trabajo con Repuestos Requeridos):
${formattedInsumos}

INSTRUCCIONES:
1. Responde de forma clara, directa, amigable y estructurada en español.
2. Si el usuario te pregunta qué comprar para hoy o en general, analiza minuciosamente la lista: identifica las órdenes de trabajo que tienen "Repuestos Necesarios (A Comprar)" pero que NO tienen esos repuestos cargados en "Repuestos Disponibles (Comprados)" o donde falte stock.
3. Presenta una respuesta detallada e idealmente agrupa los repuestos necesarios (por ejemplo: "2 bombas para el modelo Drean Excellent, 3 rulemanes para el modelo Philco PHLF6510B2").
4. Si te preguntan cosas específicas sobre un aparato, un número de orden, o el stock, responde con precisión usando la información proveída.
5. Mantén tus respuestas concisas, profesionales y enfocadas en la acción de compra o stock del taller.`;

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

    return res.json({ response: response.text });
  } catch (error: any) {
    console.error("Error in Gemini chat:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Assistant Agent Chat Route
app.post("/api/agente/chat", async (req, res) => {
  try {
    const { messages, contextServices, todayStr, apiKey, model } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const resolvedApiKey = apiKey && apiKey.trim() ? apiKey.trim() : process.env.GEMINI_API_KEY;
    if (!resolvedApiKey) {
      return res.status(400).json({ error: "No Gemini API key is configured. Please configure it in Settings or contact the administrator." });
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

    // Format services context for the agent
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
  Notas Internas: ${s.notasInternas || "Ninguna"}
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

    return res.json({ response: response.text });
  } catch (error: any) {
    console.error("Error in Agent chat:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// WhatsApp status endpoint
app.get("/api/whatsapp/status", async (req, res) => {
  try {
    const status = await WhatsAppService.getStatus();
    if (status.status === "disconnected" && !status.qr) {
      WhatsAppService.initConnection(5000).catch(err => console.error("Error initConnection in bg:", err));
      return res.json({ status: "connecting", qr: null });
    }
    return res.json(status);
  } catch (error: any) {
    console.error("Error getting WhatsApp status:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// WhatsApp disconnect endpoint
app.post("/api/whatsapp/disconnect", async (req, res) => {
  try {
    await WhatsAppService.disconnect();
    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error disconnecting WhatsApp:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// WhatsApp notification trigger endpoint
app.post("/api/whatsapp/notify", async (req, res) => {
  try {
    const { type, serviceId } = req.body;
    if (!type || !serviceId) {
      return res.status(400).json({ error: "type and serviceId are required" });
    }

    const { data: service, error: srvError } = await supabase
      .from("servicios")
      .select("*")
      .eq("id", serviceId)
      .single();

    if (srvError || !service) {
      console.error("Error fetching service from Supabase:", srvError);
      return res.status(404).json({ error: "Service not found in database" });
    }

    const { data: client, error: cliError } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", service.cliente_id)
      .single();

    if (cliError || !client) {
      console.error("Error fetching client from Supabase:", cliError);
      return res.status(404).json({ error: "Client not found in database" });
    }

    const geminiConfig = await GeminiConfigService.getConfig();
    const resolvedApiKey = geminiConfig.apiKey || process.env.GEMINI_API_KEY;
    if (!resolvedApiKey) {
      return res.status(400).json({ error: "No Gemini API key is configured. Please configure it in Settings." });
    }

    const ai = new GoogleGenAI({
      apiKey: resolvedApiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const clientPhone = client.tel_cel || client.tel_fijo || "";
    const clientName = client.nombre_apellido || "Cliente S/D";
    const address = `${client.calle || ""} ${client.numero || ""}`.trim() || "Dirección no especificada";

    let prompt = "";
    if (type === "pickup") {
      prompt = `Genera un mensaje de WhatsApp amigable, sumamente atento y profesional para un cliente de Econoservice (taller de reparación de lavarropas y electrodomésticos). El chofer del taller acaba de confirmar el retiro del equipo y está ingresando al taller de servicio técnico para que el equipo de taller lo diagnostique.

Detalles del cliente: ${clientName}, Dirección: ${address}.
Detalles del equipo: ${service.aparato || ""} (${service.marca_modelo || ""}), Orden de trabajo #${service.numero_servicio}.

Escribe en español de Argentina (tuteo amigable, cercano, profesional. Ejemplo: "te avisamos", "ya retiramos tu equipo", "cualquier consulta estamos a disposición"). Incluye emojis de forma profesional (ej. 🚚, 🛠️, 🧼). El mensaje debe ser sumamente conciso y directo (máximo 3 oraciones sencillas) para leerse rápido. No agregues etiquetas markdown. Escribe directamente el texto final.`;
    } else if (type === "diagnosis") {
      const diagStr = service.diagnostico || service.servicios_requeridos || "Revisión general en taller.";
      prompt = `Genera un mensaje de WhatsApp amigable, atento y profesional para un cliente de Econoservice (taller de reparación de lavarropas). El diagnóstico de su equipo ya ha sido completado por el técnico de taller y está listo el presupuesto.

Detalles del cliente: ${clientName}.
Detalles del equipo: ${service.aparato || ""} (${service.marca_modelo || ""}), Orden de trabajo #${service.numero_servicio}.
Detalles del Diagnóstico/Presupuesto del técnico:
${diagStr}

Escribe en español de Argentina (tuteo amigable, cercano). Explica brevemente de forma simple el desperfecto del equipo y los pasos a seguir para la aprobación del presupuesto. Agrega emojis de forma profesional (ej. 🛠️, 🧼). El mensaje debe ser directo y conciso (máximo 4 oraciones sencillas). Escribe directamente el texto final sin etiquetas markdown.`;
    } else {
      return res.status(400).json({ error: "Invalid notification type" });
    }

    const response = await ai.models.generateContent({
      model: geminiConfig.model || "gemini-2.5-flash",
      contents: prompt
    });

    const notificationText = response.text || "Notificación de Econoservice.";

    let sentToClient = false;
    let sentToAdmin = false;
    let errorMsg = "";

    if (clientPhone) {
      try {
        await WhatsAppService.sendMessage(clientPhone, notificationText);
        sentToClient = true;
      } catch (err: any) {
        console.error("Error sending WhatsApp to client:", err);
        errorMsg += `Cliente: ${err.message || err}. `;
      }
    }

    try {
      const adminPhone = await WhatsAppService.getConnectedUserPhone();
      if (adminPhone) {
        const copyText = `*COPIA DE NOTIFICACIÓN ENVIADA A ${clientName.toUpperCase()} (${clientPhone || "Sin Celular"})*\n\n${notificationText}`;
        await WhatsAppService.sendMessage(adminPhone, copyText);
        sentToAdmin = true;
      }
    } catch (err: any) {
      console.error("Error sending copy to admin:", err);
      errorMsg += `Admin Copy: ${err.message || err}. `;
    }

    if (!sentToClient && !sentToAdmin) {
      return res.status(500).json({ error: `No se pudo enviar el mensaje: ${errorMsg}` });
    }

    return res.json({ 
      success: true, 
      notificationText, 
      sentToClient, 
      sentToAdmin, 
      warning: errorMsg || null 
    });

  } catch (error: any) {
    console.error("Error sending WhatsApp notification:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Route Optimization Endpoint using Gemini
app.post("/api/tracker/optimize-route", async (req, res) => {
  try {
    const { orders, apiKey } = req.body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: "Debe proveer una lista de órdenes con direcciones válidas." });
    }

    const resolvedApiKey = apiKey && apiKey.trim() ? apiKey.trim() : process.env.GEMINI_API_KEY;
    if (!resolvedApiKey) {
      return res.status(400).json({ error: "No Gemini API key is configured. Please configure it in Settings or contact the administrator." });
    }

    const activeAi = new GoogleGenAI({
      apiKey: resolvedApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const ordersInfo = orders.map((o: any) => {
      return `Orden #${o.numeroServicio}:
  Dirección: ${o.direccion}
  Cliente: ${o.clienteNombre || "S/D"}
  Aparato: ${o.aparato} ${o.marcaModelo || ""}`;
    }).join("\n\n");

    const prompt = `Analiza las siguientes direcciones de entrega para un taller de reparación ubicado en la zona de Santo Tomé / Santa Fe, Argentina.
Recomienda el orden de entrega más conveniente y eficiente para minimizar tiempos de viaje, consumo de combustible y distancias de reparto.

LISTA DE ÓRDENES CON DIRECCIÓN DE ENTREGA:
${ordersInfo}

INSTRUCCIONES DE RESPUESTA:
1. Analiza geográficamente las direcciones. Identifica cuáles están cerca entre sí, si corren en paralelo (por ejemplo, calles como "4 de enero" y "1 de mayo" corren paralelas en Santa Fe y están a la misma altura), o si se encuentran agrupadas en Santo Tomé o en Santa Fe.
2. Devuelve tu respuesta estrictamente en formato JSON utilizando el esquema detallado abajo. No agregues etiquetas de markdown de tipo \`\`\`json ni nada de texto adicional fuera del JSON. Debe ser directamente un objeto JSON parseable.
3. El JSON debe contener exactamente dos propiedades:
   - "explicacion": Una explicación amigable, profesional, directa y conversacional en español que resuma el criterio geográfico utilizado para la recomendación, explicando detalles geográficos de la zona (por ejemplo: "corren en paralelo", "están casi a la misma altura", "conviene agrupar primero Santo Tomé", etc.).
   - "recomendaciones": Un array de objetos que representen el orden óptimo de entrega de las órdenes recibidas, donde cada objeto tenga:
     - "numeroServicio": El número de servicio (ID/número identificador) como número o string.
     - "direccion": La dirección de entrega.
     - "cliente": El nombre del cliente.
     - "orden": El número de orden de entrega recomendado (1, 2, 3, etc.).
     - "comentario": Un mini comentario de por qué se ubica en esa posición o su relación con la siguiente entrega.

EJEMPLO DE ESQUEMA DE SALIDA ESPERADO:
{
  "explicacion": "te paso la lista con el orden recomendado según las direcciones. En este caso, decidí agrupar primero las entregas en la zona céntrica debido a que las calles corren paralelas y están a alturas similares...",
  "recomendaciones": [
    {
      "numeroServicio": 102,
      "direccion": "4 de enero 2567",
      "cliente": "Juan Perez",
      "orden": 1,
      "comentario": "Comenzamos por aquí porque está a pocas cuadras del taller."
    },
    {
      "numeroServicio": 105,
      "direccion": "1 de mayo 2320",
      "cliente": "Maria Gomez",
      "orden": 2,
      "comentario": "Esta calle corre paralela a la anterior y se encuentra casi a la misma altura, lo que minimiza el desvío."
    }
  ]
}`;

    const response = await activeAi.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    const result = JSON.parse(text);
    return res.json(result);
  } catch (error: any) {
    console.error("Error optimizing delivery route:", error);
    return res.status(500).json({ error: error.message || "Error al optimizar la ruta" });
  }
});

async function startServer() {
  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
