import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { localYmd } from "@/lib/dates";
import type { TablesUpdate } from "@/integrations/supabase/rows";

export interface Publication {
  id: string;
  created_at: string;
  office_id: string;
  numero_processo: string;
  titulo: string;
  conteudo: string;
  data_publicacao: string;
  status: 'nova' | 'lida' | 'arquivada' | 'processada';
  urgencia: 'baixa' | 'media' | 'alta';
  tags: string[];
  cliente_id?: string;
  processo_id?: string;
  tribunal?: string;
  comarca?: string;
  vara?: string;
  tipo_documento?: string;
  nome_orgao?: string;
}

// Urgência automática: publicação que dispara prazo/ato = alta
export function deriveUrgencia(conteudo?: string | null, tipo?: string | null): 'alta' | 'media' {
  const t = `${conteudo || ''} ${tipo || ''}`.toLowerCase();
  return /(prazo|intim|manifest|contest|impugna|recurso|apelaç|agravo|embargos|contrarraz|cite-se|cita[çc]|r[ée]plica|cumprimento de senten|penhora|leil[aã]o|audi[êe]ncia)/.test(t)
    ? 'alta' : 'media';
}

export interface PrazoInfo {
  data_intimacao: string;
  data_fim_prazo: string | null;
  dias_uteis: number | null;
  base_legal: string;
  eh_juizado: boolean;
  dias_corridos: boolean;
}

// PostgREST usa vírgula/parênteses como separadores em `.or()` — escapa o valor
// dinâmico entre aspas pra um termo de busca com esses caracteres não quebrar o filtro.
const escapeOrValue = (v: string) => `"${v.replace(/"/g, '\\"')}"`;

export interface PublicacoesListaParams {
  page: number;
  pageSize: number;
  status: string; // 'all' | 'nova' | 'lida' | 'arquivada' | 'processada'
  urgencia: string; // 'all' | 'alta' | 'media' | 'baixa'
  vinculo: 'all' | 'sem' | 'com';
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PublicacoesListaResult {
  data: Publication[];
  total: number;
  loading: boolean;
  error: string | null;
}

type PublicacoesFilters = Omit<PublicacoesListaParams, 'page' | 'pageSize'>;

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

  const { data, isLoading, error } = useQuery({
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

export interface PublicacoesStats {
  total: number;
  prazosSemana: number;
  naoTratadas: number;
  semVinculo: number;
  comVinculo: number;
  novosAndamentos: number;
  tratadas: number;
}

const EMPTY_STATS: PublicacoesStats = {
  total: 0, prazosSemana: 0, naoTratadas: 0, semVinculo: 0, comVinculo: 0, novosAndamentos: 0, tratadas: 0,
};

/**
 * Contadores para os cards de resumo — independentes de página/filtro ativo
 * (sempre o total real do escritório), mesmo padrão de useProcessosStatusCounts.
 */
export function usePublicacoesStats(): { stats: PublicacoesStats; loading: boolean } {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['publicacoes', 'stats', user?.id, user?.office_id],
    queryFn: async (): Promise<PublicacoesStats> => {
      const officeId = user!.office_id;
      const userId = user!.id;
      const base = () => {
        const q = supabase.from('publicacoes').select('id', { count: 'exact', head: true });
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

  return { stats: data ?? EMPTY_STATS, loading: isLoading };
}

export const usePublicacoes = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['publicacoes'] });

  const syncByOab = async (oab: string, uf: string, days: number = 7) => {
    if (!user?.office_id) return [];

    try {
      const { data: results, error: invokeError } = await supabase.functions.invoke('fetch-by-oab', {
        body: { oab, uf, days }
      });

      if (invokeError) {
        throw new Error(`Erro na API de busca: ${invokeError.message}`);
      }

      const items = results?.items || results;
      if (!items || !Array.isArray(items)) return [];

      // Mapa de processos já cadastrados (numero_processo -> id) para vínculo automático
      const numerosBusca = items
        .map((it: any) => (it.numeroProcesso || '').replace(/\D/g, ''))
        .filter(Boolean);
      const processoMap = new Map<string, string>();
      if (numerosBusca.length > 0) {
        const { data: procs } = await supabase
          .from('processos')
          .select('id, numero_processo')
          .eq('office_id', user.office_id)
          .in('numero_processo', numerosBusca);
        (procs || []).forEach((p: any) => processoMap.set(p.numero_processo, p.id));
      }

      const savedResults = [];
      for (const item of items) {
        // DataJud retorna andamentos processuais — ignorar, não são publicações oficiais
        if (item.fonte === 'datajud') continue;

        // A partir daqui: somente itens do PJE Comunica (publicações oficiais)
        const conteudo = item.conteudo || item.ultimoAndamento?.descricao || 'Expediente processual identificado via sincronização automática.';

        if (!conteudo || conteudo.length < 10) continue;

        const dataPublicacao = item.data_disponibilizacao
          ? new Date(item.data_disponibilizacao).toISOString().split('T')[0]
          : item.ultimoAndamento?.data
          ? new Date(item.ultimoAndamento.data).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        // Título vem pronto do mapPjeItem: "Autor x Réu" ou "Intimação" etc.
        const titulo = item.titulo && !item.titulo.startsWith('Publicação')
          ? item.titulo
          : item.tipo_documento || item.tipo_comunicacao || `Publicação ${item.numeroProcesso}`;

        // Vincula automaticamente se já houver processo cadastrado com esse número
        const processoIdVinculado = processoMap.get((item.numeroProcesso || '').replace(/\D/g, '')) || null;

        const newRecord = {
          titulo,
          conteudo,
          data_publicacao: dataPublicacao,
          numero_processo: item.numeroProcesso,
          status: 'nova' as const,
          urgencia: deriveUrgencia(conteudo, item.tipo_documento || item.tipo_comunicacao),
          tags: [item.tribunal?.toUpperCase() || 'TRIBUNAL', 'pje_comunica'].filter(Boolean),
          tribunal: item.tribunal || null,
          comarca: item.comarca || null,
          vara: item.vara || null,
          tipo_documento: item.tipo_documento || null,
          nome_orgao: item.nome_orgao || item.vara || null,
          processo_id: processoIdVinculado,
        };

        // Dedup: mesmo processo + mesma data de publicação
        const { data: existing } = await supabase
          .from('publicacoes')
          .select('id, conteudo, processo_id')
          .eq('office_id', user.office_id)
          .eq('numero_processo', newRecord.numero_processo)
          .eq('data_publicacao', newRecord.data_publicacao)
          .maybeSingle();

        if (existing) {
          // Atualiza se o novo conteúdo for mais completo e/ou vincula se ainda não vinculado
          const patch: Record<string, any> = {};
          if (conteudo.length > (existing.conteudo?.length || 0)) {
            patch.conteudo = conteudo;
            patch.tipo_documento = newRecord.tipo_documento;
            patch.nome_orgao = newRecord.nome_orgao;
          }
          if (!existing.processo_id && processoIdVinculado) {
            patch.processo_id = processoIdVinculado;
          }
          if (Object.keys(patch).length > 0) {
            await supabase.from('publicacoes').update(patch as TablesUpdate<'publicacoes'>).eq('id', existing.id);
          }
        } else {
          const saved = await createPublication(newRecord as any);
          if (saved) {
            savedResults.push(saved);
            await calcularEPersistirPrazo(saved.id, newRecord as Partial<Publication>);
          }
        }
      }

      if (savedResults.length > 0) invalidate();
      return savedResults;
    } catch (error: unknown) {
      toast({
        title: "Erro na sincronização",
        description: getErrorMessage(error, "Não foi possível conectar aos tribunais no momento."),
        variant: "destructive"
      });
      return [];
    }
  };

  const calcularEPersistirPrazo = async (publicacaoId: string, pub: Partial<Publication>) => {
    if (!pub.data_publicacao) return;
    try {
      await supabase.functions.invoke('calculate-prazo', {
        body: {
          publicacao_id: publicacaoId,
          data_disponibilizacao: pub.data_publicacao,
          tipo_documento: pub.tipo_documento ?? null,
          nome_orgao: pub.nome_orgao ?? null,
          conteudo: pub.conteudo ?? null,
        },
      });
    } catch {
      // Falha silenciosa — prazo será recalculado na próxima sincronização
    }
  };

  useEffect(() => {
    // Auto-sync ao abrir: usa a OAB do USUÁRIO LOGADO (o robô server-side cobre o resto).
    // Evita ler o perfil do dono (que dava 406 por RLS) e funciona para cada advogado.
    const oab = (profile as any)?.oab;
    const uf = (profile as any)?.oab_uf;
    if (!user?.office_id || !oab || !uf) return;

    const runAutoSync = async () => {
      const sessionKey = `last_oab_sync_${user.office_id}_${oab}`;
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, new Date().toISOString());

      const news = await syncByOab(oab, uf);
      if (news.length > 0) {
        toast({ title: "Sincronização concluída", description: `${news.length} novas publicações encontradas.` });
      }
    };

    runAutoSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.office_id, (profile as any)?.oab, (profile as any)?.oab_uf]);

  // Vincula uma publicação a um processo já existente (e marca como tratada)
  const linkPublicacaoToProcesso = async (publicacaoId: string, processoId: string) => {
    try {
      const { error } = await supabase
        .from('publicacoes')
        .update({ processo_id: processoId, status: 'processada' })
        .eq('id', publicacaoId);
      if (error) throw error;
      invalidate();
      return true;
    } catch {
      return false;
    }
  };

  // Procura um processo já cadastrado pelo número (CNJ). Retorna o id ou null.
  const findProcessoIdByCnj = async (numeroProcesso: string): Promise<string | null> => {
    if (!user?.office_id || !numeroProcesso) return null;
    const cnj = numeroProcesso.replace(/\D/g, '');
    const { data } = await supabase
      .from('processos')
      .select('id')
      .eq('office_id', user.office_id)
      .eq('numero_processo', cnj)
      .eq('deletado', false)
      .maybeSingle();
    return data?.id || null;
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('publicacoes')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      invalidate();
      return true;
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
        description: "Não foi possível atualizar a publicação.",
        variant: "destructive",
      });
      return false;
    }
  };

  const deletePublication = async (id: string) => {
    try {
      const { error } = await supabase
        .from('publicacoes')
        .update({ status: 'arquivada' })
        .eq('id', id);

      if (error) throw error;

      invalidate();

      toast({
        title: "Publicação arquivada",
        description: "A publicação foi arquivada. O suporte pode restaurá-la se necessário.",
      });

      return true;
    } catch (error) {
      toast({
        title: "Erro ao arquivar",
        description: "Não foi possível arquivar a publicação.",
        variant: "destructive",
      });
      return false;
    }
  };

  const createPublication = async (data: Omit<Publication, 'id' | 'created_at' | 'office_id'>) => {
    if (!user?.office_id) return null;

    try {
      const { data: newPub, error } = await supabase
        .from('publicacoes')
        .insert([{ ...data, office_id: user.office_id, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      invalidate();
      return newPub;
    } catch {
      return null;
    }
  };

  const getOfficeOwnerProfile = async () => {
    if (!user?.office_id) return null;

    try {
      // 1. Pegar o escritório para descobrir quem é o dono (created_by)
      const { data: office, error: officeError } = await supabase
        .from('offices')
        .select('created_by')
        .eq('id', user.office_id)
        .maybeSingle();

      if (officeError || !office?.created_by) return null;

      // 2. Pegar o perfil do dono (maybeSingle evita 406 quando o RLS bloqueia a leitura)
      const { data: ownerProfile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, oab, oab_uf')
        .eq('user_id', office.created_by)
        .maybeSingle();

      if (profileError) return null;

      return ownerProfile;
    } catch {
      return null;
    }
  };

  const fetchByCnj = async (cnj: string) => {
    if (!user?.office_id) return [];

    try {
      const { data: results, error: invokeError } = await supabase.functions.invoke('fetch-processo', {
        body: { numeroProcesso: cnj }
      });

      if (invokeError) throw new Error(invokeError.message);

      const items = results?.items || (results ? [results] : []);
      if (!Array.isArray(items) || items.length === 0) return [];

      const savedResults = [];
      for (const item of items) {
        const conteudo = item.fonte === 'datajud'
          ? (item.ultimoAndamento?.descricao || item.conteudo?.split('\n\n')[0] || `Andamento processual — ${cnj}`)
          : (item.conteudo || item.ultimoAndamento?.descricao || `Andamento processual — ${cnj}`);
        const dataPublicacao = item.data_disponibilizacao
          ? new Date(item.data_disponibilizacao).toISOString().split('T')[0]
          : item.ultimoAndamento?.data
          ? new Date(item.ultimoAndamento.data).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        const { data: existing } = await supabase
          .from('publicacoes')
          .select('id')
          .eq('office_id', user.office_id)
          .eq('numero_processo', cnj)
          .eq('data_publicacao', dataPublicacao)
          .maybeSingle();

        if (!existing) {
          const saved = await createPublication({
            titulo: item.titulo || `Processo ${cnj}`,
            conteudo,
            data_publicacao: dataPublicacao,
            numero_processo: cnj,
            status: 'nova',
            urgencia: deriveUrgencia(conteudo, item.tipo_documento || item.tipo_comunicacao),
            tags: [item.tribunal?.toUpperCase() || 'CNJ'],
            tribunal: item.tribunal || null,
            comarca: item.comarca || null,
            vara: item.vara || null,
            tipo_documento: item.tipo_documento || null,
            nome_orgao: item.nome_orgao || null,
          });
          if (saved) {
            savedResults.push(saved);
            await calcularEPersistirPrazo(saved.id, { ...item, data_publicacao: dataPublicacao });
          }
        }
      }

      return savedResults;
    } catch (error: unknown) {
      toast({
        title: "Erro ao buscar processo",
        description: getErrorMessage(error, "Não foi possível consultar o CNJ."),
        variant: "destructive"
      });
      return [];
    }
  };

  return {
    refresh: invalidate,
    updateStatus,
    deletePublication,
    createPublication,
    getOfficeOwnerProfile,
    fetchByCnj,
    syncByOab,
    linkPublicacaoToProcesso,
    findProcessoIdByCnj,
  };
};
