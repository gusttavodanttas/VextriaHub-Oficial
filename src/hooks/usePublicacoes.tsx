import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

export interface PrazoInfo {
  data_intimacao: string;
  data_fim_prazo: string | null;
  dias_uteis: number | null;
  base_legal: string;
  eh_juizado: boolean;
  dias_corridos: boolean;
}

export const usePublicacoes = () => {
  const { user } = useAuth();

  const { data: publications = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['publicacoes', user?.office_id],
    queryFn: async () => {
      if (!user?.office_id) return [];
      const { data, error } = await supabase
        .from('publicacoes')
        .select('*')
        .eq('office_id', user.office_id)
        .order('data_publicacao', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.office_id,
  });
        .select('*')
        .order('data_publicacao', { ascending: false });

      if (officeId) {
        query = query.eq('office_id', officeId);
      } else if (userId) {
        query = query.eq('user_id', userId);
      } else {
        return;
      }

      const { data, error } = await query;

      if (error) throw error;
      setPublications(data || []);
    } catch {
      // erro silencioso — lista fica vazia
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicacoes();
  }, [user?.office_id]);

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

        const newRecord = {
          titulo,
          conteudo,
          data_publicacao: dataPublicacao,
          numero_processo: item.numeroProcesso,
          status: 'nova' as const,
          urgencia: 'media' as const,
          tags: [item.tribunal?.toUpperCase() || 'TRIBUNAL', 'pje_comunica'].filter(Boolean),
          tribunal: item.tribunal || null,
          comarca: item.comarca || null,
          vara: item.vara || null,
          tipo_documento: item.tipo_documento || null,
          nome_orgao: item.nome_orgao || item.vara || null,
        };

        // Dedup: mesmo processo + mesma data de publicação
        const { data: existing } = await supabase
          .from('publicacoes')
          .select('id, conteudo')
          .eq('office_id', user.office_id)
          .eq('numero_processo', newRecord.numero_processo)
          .eq('data_publicacao', newRecord.data_publicacao)
          .maybeSingle();

        if (existing) {
          // Atualiza se o novo conteúdo for mais completo
          if (conteudo.length > (existing.conteudo?.length || 0)) {
            await supabase
              .from('publicacoes')
              .update({ conteudo, tipo_documento: newRecord.tipo_documento, nome_orgao: newRecord.nome_orgao })
              .eq('id', existing.id);
          }
        } else {
          const saved = await createPublication(newRecord as any);
          if (saved) {
            savedResults.push(saved);
            await calcularEPersistirPrazo(saved.id, newRecord);
          }
        }
      }

      return savedResults;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Erro na sincronização",
        description: err.message || "Não foi possível conectar aos tribunais no momento.",
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
    if (!user?.office_id) return;

    const runAutoSync = async () => {
      // Buscar OAB do Proprietário do Escritório (Admin)
      const ownerProfile = await getOfficeOwnerProfile();
      
      if (!ownerProfile?.oab || !ownerProfile?.oab_uf) return;

      const sessionKey = `last_office_oab_sync_${user.office_id}_${ownerProfile.oab}`;
      const lastSync = sessionStorage.getItem(sessionKey);
      
      if (!lastSync) {
        const news = await syncByOab(ownerProfile.oab, ownerProfile.oab_uf);
        
        if (news.length > 0) {
          toast({
            title: "Sincronização concluída",
            description: `${news.length} novas publicações para Dr. ${ownerProfile.full_name} encontradas.`,
          });
          fetchPublicacoes();
        }
        sessionStorage.setItem(sessionKey, new Date().toISOString());
      }
    };

    runAutoSync();
  }, [user?.office_id]);

  const updateStatus = async (id: string, status: Publication['status']) => {
    try {
      const { error } = await supabase
        .from('publicacoes')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      
      setPublications(prev => 
        prev.map(p => p.id === id ? { ...p, status } : p)
      );
      
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

      setPublications(prev => prev.filter(p => p.id !== id));

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
      
      setPublications(prev => [newPub, ...prev]);
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
        .single();

      if (officeError || !office?.created_by) return null;

      // 2. Pegar o perfil do dono
      const { data: ownerProfile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, oab, oab_uf')
        .eq('user_id', office.created_by)
        .single();

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
            urgencia: 'media',
            tags: [item.tribunal?.toUpperCase() || 'CNJ'],
            tribunal: item.tribunal || null,
            comarca: item.comarca || null,
            vara: item.vara || null,
            tipo_documento: item.tipo_documento || null,
            nome_orgao: item.nome_orgao || null,
          } as any);
          if (saved) {
            savedResults.push(saved);
            await calcularEPersistirPrazo(saved.id, { ...item, data_publicacao: dataPublicacao });
          }
        }
      }

      return savedResults;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Erro ao buscar processo",
        description: err.message || "Não foi possível consultar o CNJ.",
        variant: "destructive"
      });
      return [];
    }
  };

  return {
    publications,
    loading,
    refresh: fetchPublicacoes,
    updateStatus,
    deletePublication,
    createPublication,
    getOfficeOwnerProfile,
    fetchByCnj,
    syncByOab
  };
};
