import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getErrorMessage } from '@/lib/errors';

export type TermoTipo = 'nome' | 'processo' | 'cpf_cnpj' | 'oab';

export interface MonitoramentoTermo {
  id: string;
  termo: string;
  tipo: TermoTipo;
  seccional: string | null;
  ativo: boolean;
  ultima_busca: string | null;
}

/**
 * Termos livres monitorados pelo robô diário de publicações (nome de parte,
 * número de processo, CPF/CNPJ ou OAB avulsa — ex.: a parte contrária, que não
 * pertence a um advogado do escritório e por isso não cabe nas OABs monitoradas).
 */
export function useMonitoramentoTermos() {
  const [termos, setTermos] = useState<MonitoramentoTermo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('monitoramento_termos')
      .select('id, termo, tipo, seccional, ativo, ultima_busca')
      .order('created_at');
    // Sem checar o erro, uma falha de busca caía como "nenhum termo monitorado" —
    // parecendo que o robô não tem nada pra acompanhar quando só o fetch falhou.
    if (fetchError) {
      setError(getErrorMessage(fetchError, "Não foi possível carregar os termos monitorados."));
      setLoading(false);
      return;
    }
    setError(null);
    setTermos((data as MonitoramentoTermo[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { termos, loading, error, refresh };
}
