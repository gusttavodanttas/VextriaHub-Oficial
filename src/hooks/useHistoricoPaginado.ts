// Paginação incremental do "histórico" de uma aba (atendimentos realizados,
// audiências passadas, prazos concluídos): o conjunto que só cresce e nunca sai.
//
// Antes cada hook buscava esse histórico com um `.limit(N)` de segurança e o
// resto simplesmente não existia para a tela — sem aviso, sem como chegar lá.
// Aqui a primeira página vem junto com a contagem exata (`count: 'exact'`) e as
// seguintes entram sob demanda ("Carregar mais antigos"); a UI mostra quantos
// ainda faltam. Os filtros/agrupamentos das páginas continuam em memória sobre o
// que já foi carregado, então nada muda para o conjunto "ativo", que continua
// vindo inteiro.
import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';

export const HISTORICO_PAGE_SIZE = 200;

export interface PaginaHistorico<T> { rows: T[]; total: number }

interface Opts<T> {
  queryKey: QueryKey;
  enabled: boolean;
  /** Busca o intervalo [from, to] (índices inclusivos, como `.range()`), com a contagem total. */
  fetchPage: (from: number, to: number) => Promise<PaginaHistorico<T>>;
  pageSize?: number;
}

export function useHistoricoPaginado<T>({ queryKey, enabled, fetchPage, pageSize = HISTORICO_PAGE_SIZE }: Opts<T>) {
  const q = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchPage(pageParam * pageSize, pageParam * pageSize + pageSize - 1),
    getNextPageParam: (ultima, todas) => {
      const carregados = todas.reduce((n, p) => n + p.rows.length, 0);
      // `rows.length === 0` cobre o caso de a contagem ter crescido entre páginas
      // (nova linha inserida): nunca pedir uma página a mais se a última veio vazia.
      return carregados < ultima.total && ultima.rows.length > 0 ? todas.length : undefined;
    },
  });

  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const total = q.data?.pages.at(-1)?.total ?? 0;

  return {
    rows,
    total,
    /** Quantas linhas do histórico ainda não foram carregadas. */
    restantes: Math.max(0, total - rows.length),
    temMais: q.hasNextPage,
    carregarMais: () => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); },
    carregandoMais: q.isFetchingNextPage,
    isLoading: q.isLoading,
    isError: q.isError,
    error: q.error,
    refetch: () => { q.refetch(); },
  };
}
