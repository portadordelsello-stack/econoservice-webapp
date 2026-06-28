import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests for this endpoint
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { orders, apiKey } = req.body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: "Debe proveer una lista de órdenes con direcciones válidas." });
    }

    const resolvedApiKey = apiKey && apiKey.trim() ? apiKey.trim() : process.env.GEMINI_API_KEY;
    if (!resolvedApiKey) {
      return res.status(400).json({ error: "No Gemini API key is configured. Please configure it in Vercel environment variables or Settings." });
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
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    const result = JSON.parse(text);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error optimizing delivery route on Vercel:", error);
    return res.status(500).json({ error: error.message || "Error al optimizar la ruta" });
  }
}
