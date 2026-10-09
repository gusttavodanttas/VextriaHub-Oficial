import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors';
import type { JurisDoc } from '@/lib/juris';
import { urlIgual } from '@/lib/juris';

// Tabelas juris_* ainda não estão no types.ts gerado (regen depende da conta contato@ —
// memória prospect-wizard-types-regen). Mesmo padrão de useCorrespondentes/useProcessShares.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface JurisFilters {
  source?: string;
  tipo?: 'precedente' | 'norma' | string;
  organ?: string;
  from?: string;
  to?: string;
  onlyVerified?: boolean;
  limit?: number;
  offset?: number;
}

export type AlvoTipo = 'processo' | 'publicacao' | 'consultivo';

export interface JurisPin {
  id: string;
  user_id: string;
  office_id: string;
  doc_id: string;
  alvo_tipo: AlvoTipo;
  alvo_id: string;
  nota: string | null;
  created_at: string;
  juris_documents: JurisDoc | null;
}

export interface JurisSearchItem {
  id: string;
  nome: string | null;
  query: string;
  filtros: JurisFilters;
  salva: boolean;
  created_at: string;
}

export interface NormaAlertas {
  ativo: boolean;
  orgaos: string[];
  termos: string[];
}

/** Busca no acervo global; o status "meu" vem junto (só o do próprio usuário, por RLS). */
export function useJurisSearch(q: string, f: JurisFilters, enabled = true) {
  return useQuery<JurisDoc[]>({
    queryKey: ['juris', 'search', q, f],
    enabled: enabled && (q.trim().length > 0 || !!f.source || !!f.tipo || !!f.onlyVerified),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sb.rpc('juris_search', {
        p_q: q || '', p_source: f.source || null, p_tipo: f.tipo || null, p_organ: f.organ || null,
        p_from: f.from || null, p_to: f.to || null, p_only_verified: !!f.onlyVerified,
        p_limit: f.limit ?? 20, p_offset: f.offset ?? 0,
      });
      if (error) throw error;
      return (data || []) as JurisDoc[];
    },
  });
}

/** Registro completo (com inteiro teor) + outros registros do mesmo processo. */
export function useJurisDoc(docId: string | null) {
  return useQuery<{ doc: JurisDoc | null; mesmoProcesso: JurisDoc[]; myStatus: 'VERIFIED' | 'BLOCKED' | null }>({
    queryKey: ['juris', 'doc', docId],
    enabled: !!docId,
    queryFn: async () => {
      const [{ data: doc, error }, { data: same }, { data: rev }] = await Promise.all([
        sb.from('juris_documents').select('*').eq('doc_id', docId).maybeSingle(),
        sb.rpc('juris_same_process', { p_doc_id: docId }),
        sb.from('juris_user_reviews').select('status').eq('doc_id', docId).maybeSingle(),
      ]);
      if (error) throw error;
      return { doc: (doc as JurisDoc) || null, mesmoProcesso: (same || []) as JurisDoc[], myStatus: rev?.status ?? null };
    },
  });
}

/** Conferência INDIVIDUAL (só o próprio advogado vê e altera). */
export function useJurisReviews() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['juris'] });

  const conferir = useMutation({
    mutationFn: async (p: { doc: JurisDoc; urlInformada: string; nota?: string }) => {
      if (!user?.id) throw new Error('Sessão expirada.');
      if (!urlIgual(p.urlInformada, p.doc.official_url)) {
        throw new Error('A URL informada não é a URL oficial registrada. Abra a fonte oficial, confira e cole exatamente a mesma URL.');
      }
      const { error } = await sb.from('juris_user_reviews').upsert(
        { user_id: user.id, doc_id: p.doc.doc_id, status: 'VERIFIED', official_url_informada: p.urlInformada.trim(), nota: p.nota || null },
        { onConflict: 'user_id,doc_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Conferido', description: 'Agora este registro pode ser citado por você.' }); },
    onError: (e) => toast({ title: 'Não foi possível conferir', description: getErrorMessage(e), variant: 'destructive' }),
  });

  const bloquear = useMutation({
    mutationFn: async (p: { doc: JurisDoc; motivo: string }) => {
      if (!user?.id) throw new Error('Sessão expirada.');
      const { error } = await sb.from('juris_user_reviews').upsert(
        { user_id: user.id, doc_id: p.doc.doc_id, status: 'BLOCKED', official_url_informada: p.doc.official_url, nota: p.motivo },
        { onConflict: 'user_id,doc_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Bloqueado para uso jurídico' }); },
    onError: (e) => toast({ title: 'Erro', description: getErrorMessage(e), variant: 'destructive' }),
  });

  const desfazer = useMutation({
    mutationFn: async (docId: string) => {
      if (!user?.id) throw new Error('Sessão expirada.');
      const { error } = await sb.from('juris_user_reviews').delete().eq('doc_id', docId).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Conferência desfeita', description: 'O registro voltou a NÃO CONFERIDO para você.' }); },
    onError: (e) => toast({ title: 'Erro', description: getErrorMessage(e), variant: 'destructive' }),
  });

  return { conferir, bloquear, desfazer };
}

/** Precedentes/normas fixados pelo usuário em um alvo (processo, publicação ou consultivo). Privados. */
export function useJurisPins(alvoTipo: AlvoTipo, alvoId: string | null | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const key = ['juris', 'pins', alvoTipo, alvoId];

  const query = useQuery<JurisPin[]>({
    queryKey: key,
    enabled: !!alvoId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await sb.from('juris_user_pins')
        .select('*, juris_documents(*)')
        .eq('alvo_tipo', alvoTipo).eq('alvo_id', alvoId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as JurisPin[];
    },
  });

  const fixar = useMutation({
    mutationFn: async (p: { docId: string; nota?: string }) => {
      if (!user?.id || !alvoId) throw new Error('Alvo inválido.');
      const { error } = await sb.from('juris_user_pins').upsert(
        { user_id: user.id, doc_id: p.docId, alvo_tipo: alvoTipo, alvo_id: alvoId, nota: p.nota || null },
        { onConflict: 'user_id,doc_id,alvo_tipo,alvo_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast({ title: 'Fixado' }); },
    onError: (e) => toast({ title: 'Não foi possível fixar', description: getErrorMessage(e), variant: 'destructive' }),
  });

  const remover = useMutation({
    mutationFn: async (pinId: string) => {
      const { error } = await sb.from('juris_user_pins').delete().eq('id', pinId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast({ title: 'Erro', description: getErrorMessage(e), variant: 'destructive' }),
  });

  return { ...query, pins: query.data || [], fixar, remover };
}

/** Histórico e pesquisas salvas do próprio usuário. */
export function useJurisSearches() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ['juris', 'searches'];

  const query = useQuery<JurisSearchItem[]>({
    queryKey: key,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sb.from('juris_user_searches').select('*').order('created_at', { ascending: false }).limit(40);
      if (error) throw error;
      return (data || []) as JurisSearchItem[];
    },
  });

  const registrar = useMutation({
    mutationFn: async (p: { query: string; filtros: JurisFilters }) => {
      if (!user?.id || !p.query.trim()) return;
      // evita repetir a última pesquisa idêntica
      const ultima = (query.data || [])[0];
      if (ultima && ultima.query === p.query.trim() && JSON.stringify(ultima.filtros) === JSON.stringify(p.filtros)) return;
      const { error } = await sb.from('juris_user_searches').insert({ user_id: user.id, query: p.query.trim(), filtros: p.filtros, salva: false });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const salvar = useMutation({
    mutationFn: async (p: { id: string; nome: string; salva: boolean }) => {
      const { error } = await sb.from('juris_user_searches').update({ nome: p.nome || null, salva: p.salva }).eq('id', p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('juris_user_searches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { ...query, itens: query.data || [], registrar, salvar, remover };
}

/** Preferências de alerta de normas novas (ANS, CFO, CRO, termos livres), por usuário. */
export function useNormaAlertas() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const key = ['juris', 'norma-alertas'];

  const query = useQuery<NormaAlertas>({
    queryKey: key,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sb.from('juris_user_norma_alertas').select('ativo, orgaos, termos').maybeSingle();
      if (error) throw error;
      return (data as NormaAlertas) || { ativo: false, orgaos: ['ANS', 'CFO', 'CRO'], termos: [] };
    },
  });

  const salvar = useMutation({
    mutationFn: async (p: NormaAlertas) => {
      if (!user?.id) throw new Error('Sessão expirada.');
      const { error } = await sb.from('juris_user_norma_alertas').upsert(
        { user_id: user.id, ativo: p.ativo, orgaos: p.orgaos, termos: p.termos, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast({ title: 'Alertas de normas salvos' }); },
    onError: (e) => toast({ title: 'Não foi possível salvar', description: getErrorMessage(e), variant: 'destructive' }),
  });

  return { ...query, prefs: query.data, salvar };
}
