import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// correspondentes/diligencias ainda não estão no types.ts gerado (regen depende da
// conta contato@ — memória prospect-wizard-types-regen). Mesmo padrão do useProcessShares.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type DiligenciaStatus = 'solicitada' | 'aceita' | 'em_andamento' | 'realizada' | 'cancelada';
export type DiligenciaTipo = 'audiencia' | 'protocolo' | 'copia' | 'carga' | 'despacho' | 'sustentacao' | 'outro';

export interface Correspondente {
  id: string;
  office_id: string;
  user_id: string | null;
  nome: string;
  oab: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
  cidades: string[];
  valor_padrao: number | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Diligencia {
  id: string;
  office_id: string;
  user_id: string | null;
  correspondente_id: string | null;
  processo_id: string | null;
  audiencia_id: string | null;
  tipo: DiligenciaTipo;
  descricao: string | null;
  comarca: string | null;
  uf: string | null;
  data_diligencia: string | null;
  status: DiligenciaStatus;
  valor: number | null;
  pago: boolean;
  data_pagamento: string | null;
  comprovante_url: string | null;
  avaliacao: number | null;
  avaliacao_comentario: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorrespondenteStats {
  total: number;
  realizadas: number;
  canceladas: number;
  abertas: number;
  avgRating: number | null;
  aPagarCount: number;
  aPagarValor: number;
}

export function useCorrespondentes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const officeId = user?.office_id;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['correspondentes'] });
    queryClient.invalidateQueries({ queryKey: ['diligencias'] });
  };

  const { data: correspondentes = [], isLoading: loadingCorr } = useQuery({
    queryKey: ['correspondentes', officeId],
    queryFn: async (): Promise<Correspondente[]> => {
      const { data, error } = await sb.from('correspondentes').select('*').order('nome', { ascending: true });
      if (error) throw error;
      return (data || []) as Correspondente[];
    },
    enabled: !!user?.id,
    staleTime: 20_000,
  });

  const { data: diligencias = [], isLoading: loadingDil } = useQuery({
    queryKey: ['diligencias', officeId],
    queryFn: async (): Promise<Diligencia[]> => {
      const { data, error } = await sb.from('diligencias').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Diligencia[];
    },
    enabled: !!user?.id,
    staleTime: 20_000,
  });

  // Desempenho por correspondente, derivado das diligências.
  const statsByCorrespondente = useMemo(() => {
    const m = new Map<string, CorrespondenteStats>();
    for (const c of correspondentes) {
      m.set(c.id, { total: 0, realizadas: 0, canceladas: 0, abertas: 0, avgRating: null, aPagarCount: 0, aPagarValor: 0 });
    }
    const ratingAcc = new Map<string, { sum: number; n: number }>();
    for (const d of diligencias) {
      if (!d.correspondente_id) continue;
      const s = m.get(d.correspondente_id);
      if (!s) continue;
      s.total += 1;
      if (d.status === 'realizada') s.realizadas += 1;
      else if (d.status === 'cancelada') s.canceladas += 1;
      else s.abertas += 1;
      if (d.status === 'realizada' && !d.pago) {
        s.aPagarCount += 1;
        s.aPagarValor += Number(d.valor || 0);
      }
      if (typeof d.avaliacao === 'number') {
        const acc = ratingAcc.get(d.correspondente_id) || { sum: 0, n: 0 };
        acc.sum += d.avaliacao; acc.n += 1;
        ratingAcc.set(d.correspondente_id, acc);
      }
    }
    for (const [id, acc] of ratingAcc) {
      const s = m.get(id);
      if (s && acc.n > 0) s.avgRating = acc.sum / acc.n;
    }
    return m;
  }, [correspondentes, diligencias]);

  // ── Correspondentes CRUD ──
  const saveCorrespondente = useMutation({
    mutationFn: async ({ id, patch }: { id?: string; patch: Partial<Correspondente> }) => {
      if (id) {
        const { error } = await sb.from('correspondentes').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await sb.from('correspondentes').insert({ ...patch, office_id: officeId, user_id: user?.id }).select('id').single();
      if (error) throw error;
      return data?.id as string;
    },
    onSuccess: (_r, vars) => { invalidate(); toast({ title: vars.id ? 'Correspondente atualizado' : 'Correspondente cadastrado' }); },
    onError: (e) => toast({ title: 'Erro ao salvar correspondente', description: getErrorMessage(e), variant: 'destructive' }),
  });

  const deleteCorrespondente = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('correspondentes').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Correspondente removido' }); },
    onError: (e) => toast({ title: 'Erro ao remover', description: getErrorMessage(e), variant: 'destructive' }),
  });

  // ── Diligências CRUD ──
  const saveDiligencia = useMutation({
    mutationFn: async ({ id, patch }: { id?: string; patch: Partial<Diligencia> }) => {
      if (id) {
        const { error } = await sb.from('diligencias').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await sb.from('diligencias').insert({ ...patch, office_id: officeId, user_id: user?.id }).select('id').single();
      if (error) throw error;
      return data?.id as string;
    },
    onSuccess: (_r, vars) => { invalidate(); toast({ title: vars.id ? 'Diligência atualizada' : 'Diligência criada' }); },
    onError: (e) => toast({ title: 'Erro ao salvar diligência', description: getErrorMessage(e), variant: 'destructive' }),
  });

  // Patch silencioso (status, pago, avaliação) — sem toast a cada clique.
  const patchDiligencia = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Diligencia> }) => {
      const { error } = await sb.from('diligencias').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => invalidate(),
    onError: (e) => toast({ title: 'Erro ao atualizar diligência', description: getErrorMessage(e), variant: 'destructive' }),
  });

  const deleteDiligencia = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('diligencias').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Diligência removida' }); },
    onError: (e) => toast({ title: 'Erro ao remover', description: getErrorMessage(e), variant: 'destructive' }),
  });

  return {
    correspondentes,
    diligencias,
    statsByCorrespondente,
    loading: loadingCorr || loadingDil,
    saveCorrespondente: (id: string | undefined, patch: Partial<Correspondente>) => saveCorrespondente.mutateAsync({ id, patch }),
    deleteCorrespondente: deleteCorrespondente.mutateAsync,
    savingCorrespondente: saveCorrespondente.isPending,
    saveDiligencia: (id: string | undefined, patch: Partial<Diligencia>) => saveDiligencia.mutateAsync({ id, patch }),
    patchDiligencia: (id: string, patch: Partial<Diligencia>) => patchDiligencia.mutateAsync({ id, patch }),
    deleteDiligencia: deleteDiligencia.mutateAsync,
    savingDiligencia: saveDiligencia.isPending,
  };
}
