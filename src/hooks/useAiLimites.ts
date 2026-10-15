import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { assertRowsAffected, getErrorMessage } from '@/lib/errors';

// Consumo de IA do mês e teto por escritório (tabelas ai_usage e ai_limites).
// Membros do escritório leem; só o super admin grava o teto.

export interface AiUsoMes {
  chamadas: number;
  voz_caracteres: number;
  tokens_prompt: number;
  tokens_resposta: number;
}

export interface AiLimite {
  /** null = padrão global das edge functions; 0 = ilimitado */
  limite_chamadas: number | null;
  limite_voz_caracteres: number | null;
  observacao: string | null;
}

const USO_VAZIO: AiUsoMes = { chamadas: 0, voz_caracteres: 0, tokens_prompt: 0, tokens_resposta: 0 };

/** Primeiro dia do mês corrente em UTC, no formato que ai_consumir() grava. */
export function mesCorrenteUtc(agora = new Date()): string {
  return `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function useAiUsoEscritorio(officeId: string | null | undefined) {
  const [uso, setUso] = useState<AiUsoMes>(USO_VAZIO);
  const [limite, setLimite] = useState<AiLimite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!officeId) { setUso(USO_VAZIO); setLimite(null); return; }
    setLoading(true);
    setError(null);
    try {
      const [usoRes, limRes] = await Promise.all([
        supabase.from('ai_usage').select('chamadas, voz_caracteres, tokens_prompt, tokens_resposta')
          .eq('office_id', officeId).eq('mes', mesCorrenteUtc()).maybeSingle(),
        supabase.from('ai_limites').select('limite_chamadas, limite_voz_caracteres, observacao')
          .eq('office_id', officeId).maybeSingle(),
      ]);
      if (usoRes.error) throw usoRes.error;
      if (limRes.error) throw limRes.error;
      setUso((usoRes.data as AiUsoMes | null) ?? USO_VAZIO);
      setLimite((limRes.data as AiLimite | null) ?? null);
    } catch (e) {
      setError(getErrorMessage(e, 'Não foi possível carregar o consumo de IA.'));
    } finally {
      setLoading(false);
    }
  }, [officeId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { uso, limite, loading, error, refetch };
}

/**
 * Grava o teto do escritório (super admin). Upsert com `.select` + contagem:
 * a RLS barrando um não-super devolve 0 linhas sem erro, e sem a checagem o
 * painel diria "salvo" com o banco intocado.
 */
export async function salvarAiLimite(officeId: string, patch: AiLimite): Promise<void> {
  const { data, error } = await supabase
    .from('ai_limites')
    .upsert({ office_id: officeId, ...patch }, { onConflict: 'office_id' })
    .select('office_id');
  assertRowsAffected(data, error, 1);
}

/** Remove a linha: o escritório volta ao padrão global. */
export async function limparAiLimite(officeId: string): Promise<void> {
  const { data, error } = await supabase
    .from('ai_limites')
    .delete()
    .eq('office_id', officeId)
    .select('office_id');
  assertRowsAffected(data, error, 1);
}

/** Texto curto de "N usos" ou "N/M usos" para o cabeçalho do widget. */
export function resumoUsoIa(uso: AiUsoMes, limite: AiLimite | null): string {
  const n = uso.chamadas;
  const teto = limite?.limite_chamadas;
  if (teto == null) return `${n} uso${n === 1 ? '' : 's'} este mês`;
  if (teto === 0) return `${n} uso${n === 1 ? '' : 's'} este mês · sem teto`;
  return `${n}/${teto} usos este mês`;
}
