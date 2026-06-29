import { supabase } from "@/integrations/supabase/client";

/**
 * Roda a busca por OAB (nacional) e salva os processos NOVOS na caixa
 * "Processos Encontrados" (staging), ignorando os já cadastrados/descartados.
 * Retorna quantos novos foram adicionados à caixa.
 */
export async function runOabDiscovery(opts: {
  oab: string; uf: string; officeId: string; userId: string; nacional?: boolean;
}): Promise<number> {
  const { oab, uf, officeId, userId, nacional = true } = opts;
  const cleanOab = (oab || "").replace(/\D/g, "");
  if (!cleanOab || !uf || !officeId) return 0;

  const { data, error } = await supabase.functions.invoke("fetch-by-oab", {
    body: { oab: cleanOab, uf, nacional },
  });
  if (error) throw error;

  const rawItems = Array.isArray(data) ? data : (data?.items ?? []);
  if (!rawItems.length) return 0;

  const mapped = rawItems.map((item: any) => ({
    ...item,
    numeroProcesso: item.numeroProcesso || "",
    autor: item.autor === "Não identificado" ? "" : (item.autor || ""),
    reu: item.reu === "Não identificado" ? "" : (item.reu || ""),
  }));
  const numeros = mapped.map((r: any) => (r.numeroProcesso || "").replace(/\D/g, "")).filter(Boolean);
  if (!numeros.length) return 0;

  const [{ data: existentes }, { data: descartados }] = await Promise.all([
    supabase.from("processos").select("numero_processo").eq("office_id", officeId).in("numero_processo", numeros),
    supabase.from("processos_descartados").select("numero_processo").eq("office_id", officeId).in("numero_processo", numeros),
  ]);
  const ocultos = new Set([
    ...(existentes || []).map((e: any) => e.numero_processo),
    ...(descartados || []).map((d: any) => d.numero_processo),
  ]);
  const novos = mapped.filter((r: any) => !ocultos.has((r.numeroProcesso || "").replace(/\D/g, "")));
  if (!novos.length) return 0;

  const rows = novos.map((r: any) => ({
    office_id: officeId,
    numero_processo: (r.numeroProcesso || "").replace(/\D/g, ""),
    titulo: r.titulo || null,
    tribunal: r.tribunal || null,
    autor: r.autor || null,
    reu: r.reu || null,
    fonte: r.fonte || "oab",
    payload: r,
    encontrado_por: userId,
  }));
  await supabase.from("processos_encontrados").upsert(rows, { onConflict: "office_id,numero_processo", ignoreDuplicates: true });
  return novos.length;
}
