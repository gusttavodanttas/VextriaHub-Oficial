import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Prazo {
  id: string;
  office_id: string;
  publicacao_id: string | null;
  numero_processo: string | null;
  tipo_prazo: string;
  data_disponibilizacao: string;
  data_intimacao: string;
  data_fim_prazo: string | null;
  dias_uteis: number | null;
  base_legal: string | null;
  eh_juizado: boolean;
  dias_corridos: boolean;
  calculado_em: string;
  publicacao_titulo?: string;
  publicacao_status?: string;
  dias_restantes?: number;
}

export const usePrazos = () => {
  const { user } = useAuth();

  const { data: prazos = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['prazos', user?.office_id],
    queryFn: async () => {
      if (!user?.office_id) return [];
      const { data, error } = await supabase
        .from('prazos')
        .select(`
          *,
          publicacoes (
            titulo,
            status
          )
        `)
        .eq('office_id', user.office_id)
        .order('data_fim_prazo', { ascending: true, nullsFirst: false });
      if (error) throw error;

      const mapped = (data || []).map((p: any) => ({
        ...p,
        publicacao_titulo: p.publicacoes?.titulo,
        publicacao_status: p.publicacoes?.status,
        dias_restantes: p.data_fim_prazo
          ? Math.ceil((new Date(p.data_fim_prazo).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
          : null,
      }));

      setPrazos(mapped);
      setPrazosUrgentes(mapped.filter(p => p.dias_restantes !== null && p.dias_restantes <= 7 && p.dias_restantes >= 0));
    } catch {
      // erro silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrazos();
  }, [user?.office_id]);

  return { prazos, prazosUrgentes, loading, refresh: fetchPrazos };
};
