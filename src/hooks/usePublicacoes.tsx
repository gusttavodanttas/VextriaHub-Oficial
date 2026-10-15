// Mutations e sincronização de publicações. A leitura (lista paginada, stats,
// exportação) está em usePublicacoesLista.ts; os tipos em types/publicacao.ts;
// o mapeamento item-da-edge-function → registro em lib/publicacoesSync.ts.
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage, assertRowsAffected } from "@/lib/errors";
import { captureError } from "@/lib/monitoring";
import type { TablesUpdate } from "@/integrations/supabase/rows";
import type { NovaPublicacao } from "@/types/publicacao";
import { montarRegistroOab, montarRegistroCnj, soDigitos, type ItemOab } from "@/lib/publicacoesSync";

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

      const items = (results?.items || results) as ItemOab[] | null;
      if (!items || !Array.isArray(items)) return [];

      // Mapa de processos já cadastrados (numero_processo -> id) para vínculo automático
      const numerosBusca = items
        .map((it) => soDigitos(it.numeroProcesso))
        .filter(Boolean);
      const processoMap = new Map<string, string>();
      if (numerosBusca.length > 0) {
        const { data: procs, error: procsError } = await supabase
          .from('processos')
          .select('id, numero_processo')
          .eq('office_id', user.office_id)
          .in('numero_processo', numerosBusca);
        if (procsError) throw procsError;
        (procs || []).forEach((p) => { if (p.numero_processo) processoMap.set(p.numero_processo, p.id); });
      }

      const savedResults = [];
      for (const item of items) {
        // null = andamento do DataJud ou conteúdo curto demais — o sync ignora.
        const newRecord = montarRegistroOab(item, processoMap);
        if (!newRecord) continue;
        const { conteudo, processo_id: processoIdVinculado } = newRecord;

        // Dedup: mesmo processo + mesma data de publicação
        const { data: existing, error: dedupError } = await supabase
          .from('publicacoes')
          .select('id, conteudo, processo_id')
          .eq('office_id', user.office_id)
          .eq('numero_processo', newRecord.numero_processo ?? '')
          .eq('data_publicacao', newRecord.data_publicacao)
          .maybeSingle();
        // Falha no dedup virava "não existe" → publicação duplicada. Pula o item (a
        // próxima sincronização tenta de novo) e reporta.
        if (dedupError) { captureError(dedupError, { context: 'usePublicacoes.syncByOab: dedup', numero: newRecord.numero_processo }); continue; }

        if (existing) {
          // Atualiza se o novo conteúdo for mais completo e/ou vincula se ainda não vinculado
          const patch: TablesUpdate<'publicacoes'> = {};
          if (conteudo.length > (existing.conteudo?.length || 0)) {
            patch.conteudo = conteudo;
            patch.tipo_documento = newRecord.tipo_documento;
            patch.nome_orgao = newRecord.nome_orgao;
          }
          if (!existing.processo_id && processoIdVinculado) {
            patch.processo_id = processoIdVinculado;
          }
          if (Object.keys(patch).length > 0) {
            const { data: patched, error: patchError } = await supabase.from('publicacoes').update(patch).eq('id', existing.id).select('id');
            try {
              assertRowsAffected(patched, patchError, 1);
            } catch (e) {
              // Sync em lote: reporta e segue para o próximo item.
              captureError(e, { context: 'usePublicacoes.syncByOab: atualizar existente', id: existing.id });
            }
          }
        } else {
          const saved = await createPublication(newRecord);
          if (saved) {
            savedResults.push(saved);
            await calcularEPersistirPrazo(saved.id, newRecord);
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

  // Aceita tanto o registro montado (NovaPublicacao) quanto o item cru da edge
  // function — só lê os campos que a calculate-prazo usa.
  type DadosPrazo = Pick<ItemOab, 'conteudo' | 'tipo_documento' | 'nome_orgao'> & { data_publicacao?: string | null };
  const calcularEPersistirPrazo = async (publicacaoId: string, pub: DadosPrazo) => {
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
    } catch (e) {
      // Silencioso pro usuário — prazo será recalculado na próxima sincronização —
      // mas reportado pro Sentry (cálculo de prazo processual é sensível o bastante
      // pra valer rastrear falhas recorrentes).
      captureError(e, { context: 'usePublicacoes.calcularEPersistirPrazo', publicacaoId });
    }
  };

  useEffect(() => {
    // Auto-sync ao abrir: usa a OAB do USUÁRIO LOGADO (o robô server-side cobre o resto).
    // Evita ler o perfil do dono (que dava 406 por RLS) e funciona para cada advogado.
    const oab = profile?.oab;
    const uf = profile?.oab_uf;
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
  }, [user?.office_id, profile?.oab, profile?.oab_uf]);

  // Vincula uma publicação a um processo já existente (e marca como tratada)
  const linkPublicacaoToProcesso = async (publicacaoId: string, processoId: string) => {
    try {
      const { data, error } = await supabase
        .from('publicacoes')
        .update({ processo_id: processoId, status: 'processada' })
        .eq('id', publicacaoId)
        .select('id');
      assertRowsAffected(data, error, 1);
      invalidate();
      return true;
    } catch (e) {
      captureError(e, { context: 'usePublicacoes.linkPublicacaoToProcesso', publicacaoId, processoId });
      return false;
    }
  };

  // Procura um processo já cadastrado pelo número (CNJ). Retorna o id ou null.
  // LANÇA em erro: devolver null fazia o chamador cadastrar o processo de novo.
  const findProcessoIdByCnj = async (numeroProcesso: string): Promise<string | null> => {
    if (!user?.office_id || !numeroProcesso) return null;
    const cnj = soDigitos(numeroProcesso);
    const { data, error } = await supabase
      .from('processos')
      .select('id')
      .eq('office_id', user.office_id)
      .eq('numero_processo', cnj)
      .eq('deletado', false)
      .maybeSingle();
    if (error) throw error;
    return data?.id || null;
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { data, error } = await supabase
        .from('publicacoes')
        .update({ status })
        .eq('id', id)
        .select('id');

      assertRowsAffected(data, error, 1);
      invalidate();
      return true;
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
        description: getErrorMessage(error, "Não foi possível atualizar a publicação."),
        variant: "destructive",
      });
      return false;
    }
  };

  const bulkUpdateStatus = async (ids: string[], status: string) => {
    if (ids.length === 0) return true;
    try {
      // Uma única query com .in() no lugar de um loop de updates individuais:
      // atômico do ponto de vista de rede (uma falha não deixa parte já aplicada
      // e o resto não) e assertRowsAffected detecta RLS bloqueando parte das
      // linhas silenciosamente (Postgres não lança erro nesse caso).
      const { data, error } = await supabase
        .from('publicacoes')
        .update({ status })
        .in('id', ids)
        .select('id');

      assertRowsAffected(data, error, ids.length);
      invalidate();
      return true;
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: getErrorMessage(error, "Não foi possível atualizar as publicações selecionadas."),
        variant: "destructive",
      });
      return false;
    }
  };

  const deletePublication = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('publicacoes')
        .update({ status: 'arquivada' })
        .eq('id', id)
        .select('id');

      assertRowsAffected(data, error, 1);

      invalidate();

      toast({
        title: "Publicação arquivada",
        description: "A publicação foi arquivada. O suporte pode restaurá-la se necessário.",
      });

      return true;
    } catch (error) {
      toast({
        title: "Erro ao arquivar",
        description: getErrorMessage(error, "Não foi possível arquivar a publicação."),
        variant: "destructive",
      });
      return false;
    }
  };

  const createPublication = async (data: NovaPublicacao) => {
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
    } catch (e) {
      captureError(e, { context: 'usePublicacoes.createPublication' });
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
    } catch (e) {
      captureError(e, { context: 'usePublicacoes.getOfficeOwnerProfile' });
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

      const items = (results?.items || (results ? [results] : [])) as ItemOab[];
      if (!Array.isArray(items) || items.length === 0) return [];

      const savedResults = [];
      for (const item of items) {
        const registro = montarRegistroCnj(item, cnj);

        const { data: existing } = await supabase
          .from('publicacoes')
          .select('id')
          .eq('office_id', user.office_id)
          .eq('numero_processo', cnj)
          .eq('data_publicacao', registro.data_publicacao)
          .maybeSingle();

        if (!existing) {
          const saved = await createPublication(registro);
          if (saved) {
            savedResults.push(saved);
            await calcularEPersistirPrazo(saved.id, { ...item, data_publicacao: registro.data_publicacao });
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
    bulkUpdateStatus,
    deletePublication,
    createPublication,
    getOfficeOwnerProfile,
    fetchByCnj,
    syncByOab,
    linkPublicacaoToProcesso,
    findProcessoIdByCnj,
  };
};
