import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

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

    const chatHistory = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : m.role,
      parts: [{ text: m.content }]
    }));

    // Separate the last user message from the rest of the history
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
