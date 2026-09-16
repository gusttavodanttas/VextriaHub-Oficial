import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';
import { mapDatabaseToProcesso } from '@/hooks/useProcessosV2';
import { Processo } from '@/types/processo';

// Valor bruto de `processos.status` por aba (a UI mapeia 'ativo' <-> 'Em andamento';
// os outros dois são gravados como o próprio rótulo, ver ProcessoDetailsDrawer).
export const STATUS_TAB_TO_DB: Record<string, string | null> = {
  ativos: 'ativo',
  concluidos: 'Concluído',
  suspensos: 'Suspenso',
  todos: null,
};

// PostgREST usa vírgula/parênteses como separadores em `.or()` — escapa o valor
// dinâmico entre aspas pra um termo de busca com esses caracteres não quebrar o filtro.
const escapeOrValue = (v: string) => `"${v.replace(/"/g, '\\"')}"`;

export interface ProcessosListaParams {
  page: number;
  pageSize: number;
  statusTab: string;
  search?: string;
  clienteNome?: string | null;
  responsavelIds?: string[] | null;
}

export interface ProcessosListaResult {
  data: Processo[];
  total: number;
  loading: boolean;
  error: string | null;
}

/**
 * Lista PAGINADA de processos (usada só pela tela /processos). Filtros e busca
 * rodam no servidor — diferente de useProcessosV2().data, que traz tudo (usado
 * por seletores/diálogos que precisam da lista inteira, ex.: NovoProcessoDialog).
 */
export function useProcessosLista(params: ProcessosListaParams): ProcessosListaResult {
  const { user } = useAuth();
  const { page, pageSize, statusTab, search, clienteNome, responsavelIds } = params;
  const dbStatus = STATUS_TAB_TO_DB[statusTab] ?? null;
  const q = (search || '').trim();
  const teamKey = (responsavelIds || []).join(',');

  const { data, isLoading, error } = useQuery({
    queryKey: ['processos', 'lista', user?.id, user?.office_id, page, pageSize, dbStatus, q, clienteNome || 'all', teamKey],
    queryFn: async () => {
      if (!user?.id) return { rows: [] as Processo[], total: 0 };

      let query = supabase
        .from('processos')
        .select('*, cliente:clientes!cliente_id(nome)', { count: 'exact' })
        .eq('deletado', false);

      if (dbStatus) query = query.eq('status', dbStatus);
      if (responsavelIds && responsavelIds.length) query = query.in('responsavel_id', responsavelIds);

      if (clienteNome && clienteNome !== 'all') {
        const { data: clientesMatch } = await supabase
          .from('clientes')
          .select('id')
          .eq('nome', clienteNome);
        const ids = (clientesMatch || []).map((c) => c.id);
        // Nome não encontrado (ex.: cliente removido entre carregar o filtro e
        // aplicar) → força resultado vazio em vez de ignorar o filtro.
        query = query.in('cliente_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      }

      if (q) {
        const numeroLimpo = q.replace(/\D/g, '');
        const { data: clientesBusca } = await supabase
          .from('clientes')
          .select('id')
          .ilike('nome', `%${q}%`);
        const orParts = [`titulo.ilike.${escapeOrValue(`%${q}%`)}`];
        if (numeroLimpo) orParts.push(`numero_processo.ilike.${escapeOrValue(`%${numeroLimpo}%`)}`);
        const clienteIds = (clientesBusca || []).map((c) => c.id);
        if (clienteIds.length) orParts.push(`cliente_id.in.(${clienteIds.join(',')})`);
        query = query.or(orParts.join(','));
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data: result, error: fetchError, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;
      return { rows: (result || []).map(mapDatabaseToProcesso), total: count ?? 0 };
    },
    enabled: !!user?.id,
    staleTime: 0,
    gcTime: 60000,
    placeholderData: (prev) => prev,
  });

  return {
    data: data?.rows ?? [],
    total: data?.total ?? 0,
    loading: isLoading,
    error: error ? getErrorMessage(error) : null,
  };
}

/**
 * Contagens por status para os cards de KPI — independentes de busca/filtro
 * ativo (mesmo comportamento de antes da paginação: sempre o total real).
 */
export function useProcessosStatusCounts(): Record<string, number> {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['processos', 'contagens', user?.id, user?.office_id],
    queryFn: async () => {
      const entries = await Promise.all(
        Object.entries(STATUS_TAB_TO_DB).map(async ([key, dbStatus]) => {
          let query = supabase.from('processos').select('id', { count: 'exact', head: true }).eq('deletado', false);
          if (dbStatus) query = query.eq('status', dbStatus);
          const { count } = await query;
          return [key, count ?? 0] as const;
        })
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
    enabled: !!user?.id,
    staleTime: 0,
    gcTime: 60000,
  });

  return data ?? { ativos: 0, concluidos: 0, suspensos: 0, todos: 0 };
}
