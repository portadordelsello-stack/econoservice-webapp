import makeWASocket, { 
  DisconnectReason, 
  BufferJSON, 
  initAuthCreds
} from '@whiskeysockets/baileys';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { GoogleGenAI } from '@google/genai';
import pino from 'pino';

const logger = pino({ level: 'silent' });

async function getFirestoreAuth() {
  const docRef = doc(db, "config", "whatsapp_auth");
  let creds: any = null;
  let keys: any = {};

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.creds) {
        creds = JSON.parse(data.creds, BufferJSON.reviver);
      }
      if (data.keys) {
        keys = JSON.parse(data.keys, BufferJSON.reviver);
      }
    }
  } catch (err) {
    console.error("Error reading WhatsApp auth from Firestore:", err);
  }

  if (!creds) {
    creds = initAuthCreds();
  }

  const saveState = async () => {
    try {
      await setDoc(docRef, {
        creds: JSON.stringify(creds, BufferJSON.replacer),
        keys: JSON.stringify(keys, BufferJSON.replacer)
      }, { merge: true });
    } catch (err) {
      console.error("Error saving WhatsApp auth to Firestore:", err);
    }
  };

  return {
    state: {
      creds,
      keys: {
        get: (type: string, ids: string[]) => {
          const results: any = {};
          for (const id of ids) {
            const val = keys[`${type}-${id}`];
            if (val) {
              results[id] = val;
            }
          }
          return results;
        },
        set: async (data: any) => {
          let updated = false;
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, value] of Object.entries(entries as any)) {
              const key = `${type}-${id}`;
              if (value === null) {
                if (keys[key]) {
                  delete keys[key];
                  updated = true;
                }
              } else {
                keys[key] = value;
                updated = true;
              }
            }
          }
          if (updated) {
            await saveState();
          }
        }
      }
    },
    saveCreds: saveState
  };
}

function formatArgentinianPhone(phone: string): string {
  let clean = phone.replace(/\D/g, ""); // only digits
  if (!clean) return "";
  
  if (clean.startsWith("0")) {
    clean = clean.substring(1);
  }
  if (clean.length === 12 && clean.substring(3, 5) === "15") {
    clean = clean.substring(0, 3) + clean.substring(5);
  } else if (clean.length === 11 && clean.substring(2, 4) === "15") {
    clean = clean.substring(0, 2) + clean.substring(4);
  }
  
  if (!clean.startsWith("54")) {
    clean = "54" + clean;
  }
  
  if (clean.startsWith("54") && !clean.startsWith("549")) {
    clean = "549" + clean.substring(2);
  }
  
  return clean;
}

let globalSock: any = null;
let currentQr: string | null = null;
let connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";

export const WhatsAppService = {
  async getStatus() {
    if (globalSock && connectionStatus === "connected") {
      return { status: "connected", qr: null };
    }
    
    const docRef = doc(db, "config", "whatsapp_auth");
    const snap = await getDoc(docRef);
    if (!snap.exists() || !snap.data().creds) {
      return { status: "disconnected", qr: currentQr };
    }
    
    return { status: connectionStatus, qr: currentQr };
  },

  async disconnect() {
    connectionStatus = "disconnected";
    currentQr = null;
    if (globalSock) {
      try {
        globalSock.end(undefined);
      } catch {}
      globalSock = null;
    }
    const docRef = doc(db, "config", "whatsapp_auth");
    await deleteDoc(docRef);
  },

  async initConnection(timeoutMs: number = 8000): Promise<string | null> {
    if (globalSock && connectionStatus === "connected") {
      return null;
    }

    connectionStatus = "connecting";
    const { state, saveCreds } = await getFirestoreAuth();

    return new Promise(async (resolve) => {
      let resolved = false;
      
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(currentQr);
        }
      }, timeoutMs);

      try {
        const sock = makeWASocket({
          auth: state,
          logger,
          printQRInTerminal: false
        });

        globalSock = sock;

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            currentQr = qr;
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              resolve(qr);
            }
          }

          if (connection === 'close') {
            connectionStatus = "disconnected";
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
              this.initConnection();
            } else {
              globalSock = null;
              currentQr = null;
            }
          } else if (connection === 'open') {
            connectionStatus = "connected";
            currentQr = null;
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              resolve(null);
            }
          }
        });
      } catch (err) {
        console.error("Error creating WASocket:", err);
        connectionStatus = "disconnected";
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(null);
        }
      }
    });
  },

  async sendMessage(to: string, text: string) {
    if (!globalSock || connectionStatus !== "connected") {
      await this.initConnection(12000);
      if (!globalSock || connectionStatus !== "connected") {
        throw new Error("WhatsApp no está conectado. Por favor escanee el código QR en Configuración.");
      }
    }

    let cleanPhone = formatArgentinianPhone(to);
    if (!cleanPhone) {
      throw new Error("El número de teléfono no es válido.");
    }
    const jid = `${cleanPhone}@s.whatsapp.net`;

    await globalSock.sendMessage(jid, { text });
  },

  async getConnectedUserPhone(): Promise<string | null> {
    if (globalSock && globalSock.user && globalSock.user.id) {
      return globalSock.user.id.split(":")[0] || null;
    }
    return null;
  }
};
