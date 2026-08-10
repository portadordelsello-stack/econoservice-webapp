import type { VercelRequest, VercelResponse } from "@vercel/node";
import { WhatsAppService } from "../../src/services/whatsappService";
import { GeminiConfigService } from "../../src/services/geminiConfig";
import { supabase } from "../../src/lib/supabase";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action || req.body.action || (req.method === "GET" ? "status" : "");

  try {
    if (action === "status") {
      const status = await WhatsAppService.getStatus();
      if (status.status === "disconnected" && !status.qr) {
        WhatsAppService.initConnection(5000).catch(err => console.error("Error in serverless initConnection:", err));
        return res.status(200).json({ status: "connecting", qr: null });
      }
      return res.status(200).json(status);
    }

    if (action === "disconnect") {
      await WhatsAppService.disconnect();
      return res.status(200).json({ success: true });
    }

    if (action === "notify") {
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
        return res.status(404).json({ error: "Service not found in database" });
      }

      const { data: client, error: cliError } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", service.cliente_id)
        .single();

      if (cliError || !client) {
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
        errorMsg += `Admin Copy: ${err.message || err}. `;
      }

      if (!sentToClient && !sentToAdmin) {
        return res.status(500).json({ error: `No se pudo enviar el mensaje: ${errorMsg}` });
      }

      return res.status(200).json({ 
        success: true, 
        notificationText, 
        sentToClient, 
        sentToAdmin, 
        warning: errorMsg || null 
      });
    }

    return res.status(400).json({ error: "Invalid action or request" });

  } catch (error: any) {
    console.error("Error in serverless WhatsApp function:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
