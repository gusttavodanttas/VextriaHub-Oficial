import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('monitoramento_termos')
      .select('id, termo, tipo, seccional, ativo, ultima_busca')
      .order('created_at');
    setTermos((data as MonitoramentoTermo[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { termos, loading, refresh };
}
