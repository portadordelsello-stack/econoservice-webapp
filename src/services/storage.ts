import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";

export const StorageService = {
  /**
   * Uploads a file (Blob or File) to Firebase Storage under the "equipos" folder.
   * Returns an object matching the legacy DriveService output structure.
   */
  async uploadPhoto(fileBlob: Blob | File, filename: string): Promise<{ id: string; name: string; url: string }> {
    const storageRef = ref(storage, `equipos/${filename}`);
    const uploadResult = await uploadBytes(storageRef, fileBlob);
    const url = await getDownloadURL(uploadResult.ref);
    return {
      id: uploadResult.metadata.fullPath,
      name: filename,
      url: url,
    };
  }
};
