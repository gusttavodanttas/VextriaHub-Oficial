// Leitura de publicações (extraído de hooks/usePublicacoes.tsx): lista paginada
// no servidor, exportação completa e contadores dos cards. As mutations e o
// sync ficam em usePublicacoes.tsx.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/errors";
import { localYmd } from "@/lib/dates";
import type { Publication, PublicacoesFilters, PublicacoesListaParams, PublicacoesListaResult, PublicacoesStats } from "@/types/publicacao";

// PostgREST usa vírgula/parênteses como separadores em `.or()` — escapa o valor
// dinâmico entre aspas pra um termo de busca com esses caracteres não quebrar o filtro.
const escapeOrValue = (v: string) => `"${v.replace(/"/g, '\\"')}"`;

/** Query base compartilhada entre a lista paginada e a exportação CSV — quem
 *  chama ainda encadeia `.order()`/`.range()`/`.limit()` conforme o uso. */
function buildPublicacoesQuery(
  officeId: string | null | undefined,
  userId: string,
  { status, urgencia, vinculo, search, dateFrom, dateTo }: PublicacoesFilters,
) {
  const q = (search || '').trim();
  let query = supabase.from('publicacoes').select('*', { count: 'exact' });
  query = officeId ? query.eq('office_id', officeId) : query.eq('user_id', userId);

  // 'all' exclui arquivadas — arquivadas só aparecem quando filtro = 'arquivada'.
  // "Tratadas" (status='lida') = lida OU processada (marcar-tratada grava 'lida',
  // vincular a um processo grava 'processada').
  if (status === 'all') query = query.neq('status', 'arquivada');
  else if (status === 'lida') query = query.in('status', ['lida', 'processada']);
  else query = query.eq('status', status);

  if (urgencia !== 'all') query = query.eq('urgencia', urgencia);
  if (vinculo === 'sem') query = query.is('processo_id', null);
  else if (vinculo === 'com') query = query.not('processo_id', 'is', null);

  if (dateFrom) query = query.gte('data_publicacao', localYmd(dateFrom));
  if (dateTo) query = query.lte('data_publicacao', localYmd(dateTo));

  if (q) {
    const orParts = [
      `titulo.ilike.${escapeOrValue(`%${q}%`)}`,
      `conteudo.ilike.${escapeOrValue(`%${q}%`)}`,
      `numero_processo.ilike.${escapeOrValue(`%${q}%`)}`,
    ];
    query = query.or(orParts.join(','));
  }

  return query;
}

/**
 * Lista PAGINADA de publicações (usada só pela tela /publicacoes). Filtros e
 * busca rodam no servidor — publicações crescem sozinhas via robô diário, então
 * ao contrário da maioria das outras listas do app não dá pra simplesmente
 * carregar tudo de uma vez (ver achado da auditoria de performance).
 */
export function usePublicacoesLista(params: PublicacoesListaParams): PublicacoesListaResult {
  const { user } = useAuth();
  const { page, pageSize, status, urgencia, vinculo, search, dateFrom, dateTo } = params;
  const q = (search || '').trim();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      'publicacoes', 'lista', user?.id, user?.office_id,
      page, pageSize, status, urgencia, vinculo, q,
      dateFrom?.toISOString() ?? null, dateTo?.toISOString() ?? null,
    ],
    queryFn: async () => {
      if (!user?.id) return { rows: [] as Publication[], total: 0 };

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data: result, error: fetchError, count } = await buildPublicacoesQuery(user.office_id, user.id, params)
        .order('data_publicacao', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;

      // De-dup por CNJ+conteúdo+data, só dentro da página (a mesma checagem que
      // já existia antes da paginação) — duplicatas de verdade já são evitadas
      // na gravação (syncByOab/fetchByCnj fazem dedup contra o banco antes de inserir).
      const seen = new Set<string>();
      const rows: Publication[] = [];
      for (const pub of (result || []) as Publication[]) {
        const key = `${pub.numero_processo}-${pub.data_publicacao}-${(pub.conteudo || '').substring(0, 50)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(pub);
      }

      return { rows, total: count ?? 0 };
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
    refetch: () => { refetch(); },
  };
}

/**
 * Busca TODAS as publicações que casam com os filtros ativos (sem paginação),
 * usada só pela exportação CSV — que precisa do conjunto filtrado inteiro, não
 * só a página visível. Cap de segurança em 5000 linhas.
 */
export async function fetchAllPublicacoesForExport(
  user: { id: string; office_id?: string | null },
  filters: PublicacoesFilters,
): Promise<Publication[]> {
  const { data, error } = await buildPublicacoesQuery(user.office_id, user.id, filters)
    .order('data_publicacao', { ascending: false })
    .limit(5000);
  if (error) throw error;
  return (data || []) as Publication[];
}

const EMPTY_STATS: PublicacoesStats = {
  total: 0, prazosSemana: 0, naoTratadas: 0, semVinculo: 0, comVinculo: 0, novosAndamentos: 0, tratadas: 0,
};

/**
 * Contadores para os cards de resumo — independentes de página/filtro ativo
 * (sempre o total real do escritório), mesmo padrão de useProcessosStatusCounts.
 */
export function usePublicacoesStats(): { stats: PublicacoesStats; loading: boolean; isError: boolean; refetch: () => void } {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['publicacoes', 'stats', user?.id, user?.office_id],
    queryFn: async (): Promise<PublicacoesStats> => {
      const officeId = user!.office_id;
      const userId = user!.id;
      const base = () => {
        // Arquivadas fora, como na lista (filtro 'all') — antes o card contava as
        // arquivadas e o número não batia com a lista que ele abre.
        const q = supabase.from('publicacoes').select('id', { count: 'exact', head: true }).neq('status', 'arquivada');
        return officeId ? q.eq('office_id', officeId) : q.eq('user_id', userId);
      };
      const today = localYmd(new Date());

      const [total, prazosSemana, naoTratadas, semVinculo, comVinculo, novosAndamentos, tratadas] = await Promise.all([
        base(),
        base().eq('urgencia', 'alta'),
        base().eq('status', 'nova'),
        base().is('processo_id', null),
        base().not('processo_id', 'is', null),
        base().eq('data_publicacao', today),
        base().in('status', ['lida', 'processada']),
      ]);
      // Nenhuma das 7 contagens checava erro — falha virava 0 nos cards.
      const falha = [total, prazosSemana, naoTratadas, semVinculo, comVinculo, novosAndamentos, tratadas].find((r) => r.error)?.error;
      if (falha) throw falha;

      return {
        total: total.count ?? 0,
        prazosSemana: prazosSemana.count ?? 0,
        naoTratadas: naoTratadas.count ?? 0,
        semVinculo: semVinculo.count ?? 0,
        comVinculo: comVinculo.count ?? 0,
        novosAndamentos: novosAndamentos.count ?? 0,
        tratadas: tratadas.count ?? 0,
      };
    },
    enabled: !!user?.id,
    staleTime: 0,
    gcTime: 60000,
  });

  return { stats: data ?? EMPTY_STATS, loading: isLoading, isError: !!error, refetch: () => { refetch(); } };
}
