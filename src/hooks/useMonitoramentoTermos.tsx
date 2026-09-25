import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getErrorMessage } from '@/lib/errors';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  const [termos, setTermos] = useState<MonitoramentoTermo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.office_id) { setTermos([]); setLoading(false); return; }
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('monitoramento_termos')
      .select('id, termo, tipo, seccional, ativo, ultima_busca')
      // office_id explícito: a RLS libera todo escritório do qual o usuário é membro.
      .eq('office_id', user.office_id)
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
  }, [user?.office_id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { termos, loading, error, refresh };
}
