import { supabase } from "../lib/supabase";

export const StorageService = {
  /**
   * Uploads a file (Blob or File) to Supabase Storage under the "equipos" bucket.
   * Returns an object matching the legacy DriveService output structure.
   */
  async uploadPhoto(fileBlob: Blob | File, filename: string): Promise<{ id: string; name: string; url: string }> {
    // 1. Upload file to "equipos" bucket
    const { data, error } = await supabase.storage
      .from("equipos")
      .upload(filename, fileBlob, {
        cacheControl: "3600",
        upsert: true
      });

    if (error) {
      console.error("Supabase Storage Upload Error:", error);
      throw new Error(`Error al subir la foto a Supabase: ${error.message}`);
    }

    // 2. Get public URL of the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from("equipos")
      .getPublicUrl(filename);

    if (!publicUrlData || !publicUrlData.publicUrl) {
      throw new Error("No se pudo generar la URL pública de la foto en Supabase.");
    }

    return {
      id: data.path,
      name: filename,
      url: publicUrlData.publicUrl
    };
  }
};
