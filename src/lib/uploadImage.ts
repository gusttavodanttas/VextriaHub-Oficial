import { supabase } from "@/integrations/supabase/client";

export const UPLOADS_BUCKET = "uploads";

/**
 * Faz upload de uma imagem para o bucket público "uploads" e retorna a URL pública.
 * Requer que o bucket "uploads" exista (ver migração de storage).
 */
export async function uploadPublicImage(folder: string, file: File, keyBase: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${folder}/${keyBase}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(UPLOADS_BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type || undefined,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(UPLOADS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Valida que é imagem e dentro do limite de tamanho (MB). */
export function validateImage(file: File, maxMB = 3): string | null {
  if (!file.type.startsWith("image/")) return "Selecione um arquivo de imagem.";
  if (file.size > maxMB * 1024 * 1024) return `Imagem muito grande (máx ${maxMB}MB).`;
  return null;
}
