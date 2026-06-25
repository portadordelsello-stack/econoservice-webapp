import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export const GeminiConfigService = {
  async getConfig(): Promise<GeminiConfig> {
    try {
      const docRef = doc(db, "config", "gemini");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          apiKey: data.apiKey || "",
          model: data.model || "gemini-2.5-flash",
        };
      }
    } catch (err) {
      console.error("Error getting Gemini config from Firestore:", err);
    }
    return {
      apiKey: "",
      model: "gemini-2.5-flash",
    };
  },

  async setConfig(config: GeminiConfig): Promise<void> {
    const docRef = doc(db, "config", "gemini");
    await setDoc(docRef, {
      apiKey: config.apiKey.trim(),
      model: config.model.trim(),
    }, { merge: true });
  }
};
