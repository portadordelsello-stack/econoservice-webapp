import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// In-memory token cache
let cachedAccessToken: string | null = null;

export const DriveService = {
  // Get/Set Folder ID from Firestore config
  async getFolderId(): Promise<string> {
    try {
      const docRef = doc(db, "config", "drive");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data().folderId || "";
      }
    } catch (err) {
      console.error("Error getting Drive folder ID from Firestore:", err);
    }
    return "";
  },

  async setFolderId(folderId: string): Promise<void> {
    const docRef = doc(db, "config", "drive");
    await setDoc(docRef, { folderId }, { merge: true });
  },

  // In-memory token management
  setAccessToken(token: string) {
    cachedAccessToken = token;
  },

  getAccessToken(): string | null {
    return cachedAccessToken;
  },

  clearAccessToken() {
    cachedAccessToken = null;
  },

  // Authorize specifically with Google Drive scope
  async connect(): Promise<string> {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/drive.file");
    // Ensure we ask for authorization permissions
    provider.setCustomParameters({ prompt: "consent" });
    
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error("No se pudo obtener el token de acceso de Google OAuth.");
      }
      cachedAccessToken = credential.accessToken;
      return cachedAccessToken;
    } catch (err) {
      console.error("Error connecting to Google Drive:", err);
      throw err;
    }
  },

  // Upload binary image Blob to Google Drive using multipart upload
  async uploadPhoto(fileBlob: Blob, filename: string): Promise<{ id: string; name: string; url: string }> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error("No estás autenticado con Google Drive. Por favor, conéctate primero.");
    }

    const folderId = await this.getFolderId();
    if (!folderId) {
      throw new Error("No se ha configurado la carpeta de destino de Google Drive en el panel del administrador.");
    }

    const metadata: { name: string; mimeType: string; parents?: string[] } = {
      name: filename,
      mimeType: fileBlob.type || "image/jpeg",
    };
    if (folderId) {
      metadata.parents = [folderId];
    }

    const boundary = "drive_upload_boundary_abc123";
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const arrayBuffer = await fileBlob.arrayBuffer();
    const metadataPart = JSON.stringify(metadata);
    const metadataHeader = `Content-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n`;
    const mediaHeader = `Content-Type: ${fileBlob.type || "image/jpeg"}\r\n\r\n`;

    const multipartBlob = new Blob([
      delimiter,
      metadataHeader,
      delimiter,
      mediaHeader,
      new Uint8Array(arrayBuffer),
      close_delim
    ], { type: `multipart/related; boundary=${boundary}` });

    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: multipartBlob,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google Drive API Error Response:", errText);
      throw new Error(`Error en API de Google Drive: ${response.statusText} (${response.status})`);
    }

    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      url: data.webViewLink,
    };
  }
};
