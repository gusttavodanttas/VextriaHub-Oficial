import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { assertRowsAffected } from "@/lib/errors";

export type OfficeSettings = Record<string, unknown>;

/**
 * Lê `offices.settings`, aplica `patch` por cima e grava — tudo ou nada.
 *
 * Único caminho de escrita em `offices.settings`: o jsonb guarda configurações de
 * várias telas (tipos de processo, origens, feriados, fiscal, cor da marca,
 * pontuação, metas por demanda…) e cada tela só conhece as próprias chaves.
 * - Se a releitura falhar, aborta: mesclar em cima de `{}` apagaria todas as
 *   outras chaves do escritório.
 * - Se a RLS barrar o UPDATE (0 linhas, sem erro — só admin grava `offices`),
 *   lança `PERMISSAO_NEGADA` em vez de deixar a tela dizer "salvo".
 *
 * Devolve o settings completo que ficou gravado.
 */
export async function patchOfficeSettings(officeId: string, patch: OfficeSettings): Promise<OfficeSettings> {
  const { data: cur, error: readError } = await supabase
    .from("offices")
    .select("settings")
    .eq("id", officeId)
    .maybeSingle();
  if (readError) throw readError;
  const merged: OfficeSettings = { ...((cur?.settings as OfficeSettings | null) ?? {}), ...patch };
  const { data: updated, error } = await supabase
    .from("offices")
    .update({ settings: merged as Json })
    .eq("id", officeId)
    .select("id");
  assertRowsAffected(updated, error, 1);
  return merged;
}
