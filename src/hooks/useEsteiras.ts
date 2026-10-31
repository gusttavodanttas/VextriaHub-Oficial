import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { assertRowsAffected, getErrorMessage } from '@/lib/errors';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Esteiras ainda não estão no types.ts gerado (regen depende de outra conta) —
// mesmo padrão de useCorrespondentes/useProcessShares.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type CampoTipo = 'texto' | 'texto_longo' | 'numero' | 'moeda' | 'data' | 'lista' | 'sim_nao' | 'url';
export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente';
export type Gatilho = 'card_criado' | 'entrou_fase';
export type Acao = 'criar_tarefa' | 'mover_card' | 'criar_card' | 'definir_responsavel' | 'definir_prazo';

export interface CampoFase {
  id: string;
  label: string;
  tipo: CampoTipo;
  obrigatorio?: boolean;
  opcoes?: string[];
}

export interface Esteira {
  id: string;
  office_id: string;
  nome: string;
  descricao: string | null;
  cor: string;
  ordem: number;
}

export interface Fase {
  id: string;
  office_id: string;
  esteira_id: string;
  nome: string;
  descricao: string | null;
  cor: string;
  ordem: number;
  finalizacao: boolean;
  sla_dias: number | null;
  campos: CampoFase[];
  checklist: string[];
  /** Ao entrar nesta fase, dá baixa no prazo vinculado ao card (Controladoria + VextriaHub). */
  baixa_prazo: boolean;
}

export interface Card {
  id: string;
  office_id: string;
  esteira_id: string;
  fase_id: string;
  titulo: string;
  descricao: string | null;
  cliente_id: string | null;
  processo_id: string | null;
  responsavel_id: string | null;
  prioridade: Prioridade;
  prazo: string | null;
  origem: string | null;
  valor: number | null;
  dados: Record<string, unknown>;
  checklist_feito: Record<string, number[]>;
  etiquetas: string[];
  /** Prazo da triagem (Controladoria) que originou o card. */
  controladoria_prazo_id: string | null;
  /** Prazo do VextriaHub que originou o card. */
  prazo_id: string | null;
  entrou_fase_em: string;
  arquivado: boolean;
  created_at: string;
  updated_at: string;
  clientes?: { id: string; nome: string; telefone: string | null; email: string | null; cpf_cnpj: string | null } | null;
  processos?: { id: string; titulo: string; numero_processo: string | null } | null;
}

export interface Evento {
  id: string;
  card_id: string;
  tipo: string;
  descricao: string | null;
  user_id: string | null;
  created_at: string;
}

export interface Automacao {
  id: string;
  office_id: string;
  esteira_id: string;
  nome: string;
  ativo: boolean;
  gatilho: Gatilho;
  fase_id: string | null;
  acao: Acao;
  config: Record<string, unknown>;
  created_at: string;
}

export const PRIORIDADE_LABEL: Record<Prioridade, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };
export const GATILHO_LABEL: Record<Gatilho, string> = { card_criado: 'Card for criado', entrou_fase: 'Card entrar na fase' };
export const ACAO_LABEL: Record<Acao, string> = {
  criar_tarefa: 'Criar tarefa',
  mover_card: 'Mover o card',
  criar_card: 'Criar card em outra esteira',
  definir_responsavel: 'Definir responsável',
  definir_prazo: 'Definir prazo do card',
};
export const CAMPO_TIPO_LABEL: Record<CampoTipo, string> = {
  texto: 'Texto curto', texto_longo: 'Texto longo', numero: 'Número', moeda: 'Moeda',
  data: 'Data', lista: 'Lista de opções', sim_nao: 'Sim/Não', url: 'Link',
};

/** Dias corridos desde que o card entrou na fase atual. */
export function diasNaFase(card: Pick<Card, 'entrou_fase_em'>, agora = new Date()): number {
  const ms = agora.getTime() - new Date(card.entrou_fase_em).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// Feriados vêm da tabela `feriados` (fonte única com o banco e o painel da
// Controladoria). useFeriados() carrega e preenche este conjunto; até carregar,
// conta só seg–sex — o banco (alertas e automações) já pula os feriados.
let FERIADOS = new Set<string>();
export function definirFeriados(datas: string[]) { FERIADOS = new Set(datas); }

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Dias úteis (seg–sex, sem feriados) entre duas datas, sem contar a inicial. */
export function diasUteisEntre(inicio: Date, fim: Date, feriados: Set<string> = FERIADOS): number {
  const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const f = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  let n = 0;
  while (d < f) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !feriados.has(isoLocal(d))) n++;
  }
  return n;
}

/** Carrega os feriados uma vez por sessão (staleTime longo) e alimenta o cálculo. */
export function useFeriados() {
  return useQuery({
    queryKey: ['feriados'],
    staleTime: 12 * 60 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await sb.from('feriados').select('data').neq('abrangencia', 'recesso');
      if (error) throw error;
      const datas = ((data || []) as { data: string }[]).map(f => f.data);
      definirFeriados(datas);
      return datas;
    },
  });
}

/** Card parado além do SLA (em dias úteis) da fase. Fase de finalização nunca atrasa. */
export function cardAtrasadoNaFase(card: Pick<Card, 'entrou_fase_em'>, fase: Pick<Fase, 'sla_dias' | 'finalizacao'> | undefined, agora = new Date()): boolean {
  if (!fase || fase.finalizacao || !fase.sla_dias) return false;
  return diasUteisEntre(new Date(card.entrou_fase_em), agora) > fase.sla_dias;
}

/** Campos obrigatórios da fase que ainda estão vazios no card. */
export function camposPendentes(card: Pick<Card, 'dados'>, fase: Pick<Fase, 'campos'> | undefined): CampoFase[] {
  if (!fase) return [];
  return fase.campos.filter(c => {
    if (!c.obrigatorio) return false;
    const v = card.dados?.[c.id];
    return v === undefined || v === null || v === '';
  });
}

export function useEsteiras() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const officeId = user?.office_id;

  const query = useQuery({
    queryKey: ['esteiras', officeId],
    enabled: !!officeId,
    queryFn: async (): Promise<Esteira[]> => {
      const { data, error } = await sb.from('esteiras').select('*')
        .eq('office_id', officeId).eq('deletado', false).order('ordem').order('created_at');
      if (error) throw error;
      return (data || []) as Esteira[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['esteiras', officeId] });
  const fail = (e: unknown, msg: string) => toast({ title: msg, description: getErrorMessage(e, msg), variant: 'destructive' });

  const instalarModelos = useMutation({
    mutationFn: async () => {
      const { error } = await sb.rpc('esteira_instalar_modelos', { p_office: officeId });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Esteiras-modelo criadas', description: 'Comercial, Ativação, Produção inicial, Peticionamento e Protocolo.' }); },
    onError: e => fail(e, 'Não foi possível criar os modelos'),
  });

  const criar = useMutation({
    mutationFn: async (input: { nome: string; descricao?: string; cor?: string }) => {
      const ordem = (query.data?.length ?? 0);
      const { data, error } = await sb.from('esteiras')
        .insert({ office_id: officeId, nome: input.nome, descricao: input.descricao || null, cor: input.cor || '#c2410c', ordem })
        .select('id').single();
      if (error) throw error;
      // fases iniciais para a esteira não nascer vazia
      const { error: fe } = await sb.from('esteira_fases').insert([
        { office_id: officeId, esteira_id: data.id, nome: 'Entrada', cor: '#3b82f6', ordem: 0 },
        { office_id: officeId, esteira_id: data.id, nome: 'Em andamento', cor: '#8b5cf6', ordem: 1 },
        { office_id: officeId, esteira_id: data.id, nome: 'Concluído', cor: '#10b981', ordem: 2, finalizacao: true },
      ]);
      if (fe) throw fe;
      return data.id as string;
    },
    onSuccess: () => invalidate(),
    onError: e => fail(e, 'Não foi possível criar a esteira'),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Esteira> & { id: string }) => {
      const { data, error } = await sb.from('esteiras').update(patch).eq('id', id).select('id');
      assertRowsAffected(data, error, 1);
    },
    onSuccess: () => invalidate(),
    onError: e => fail(e, 'Não foi possível salvar a esteira'),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await sb.from('esteiras').update({ deletado: true }).eq('id', id).select('id');
      assertRowsAffected(data, error, 1);
    },
    onSuccess: () => invalidate(),
    onError: e => fail(e, 'Não foi possível excluir a esteira'),
  });

  return {
    esteiras: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    instalarModelos,
    criar,
    atualizar,
    excluir,
  };
}

export function useEsteiraDetalhe(esteiraId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const officeId = user?.office_id;
  const enabled = !!officeId && !!esteiraId;

  const fases = useQuery({
    queryKey: ['esteira_fases', esteiraId],
    enabled,
    queryFn: async (): Promise<Fase[]> => {
      const { data, error } = await sb.from('esteira_fases').select('*').eq('esteira_id', esteiraId).order('ordem');
      if (error) throw error;
      return (data || []) as Fase[];
    },
  });

  const cards = useQuery({
    queryKey: ['esteira_cards', esteiraId],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<Card[]> => {
      const { data, error } = await sb.from('esteira_cards')
        .select('*, clientes(id, nome, telefone, email, cpf_cnpj), processos(id, titulo, numero_processo)')
        .eq('esteira_id', esteiraId).eq('deletado', false).eq('arquivado', false)
        .order('created_at', { ascending: false }).limit(2000);
      if (error) throw error;
      return (data || []) as Card[];
    },
  });

  const automacoes = useQuery({
    queryKey: ['esteira_automacoes', esteiraId],
    enabled,
    queryFn: async (): Promise<Automacao[]> => {
      const { data, error } = await sb.from('esteira_automacoes').select('*').eq('esteira_id', esteiraId).order('created_at');
      if (error) throw error;
      return (data || []) as Automacao[];
    },
  });

  const invalidateCards = () => {
    qc.invalidateQueries({ queryKey: ['esteira_cards'] });
    qc.invalidateQueries({ queryKey: ['esteira_eventos'] });
    qc.invalidateQueries({ queryKey: ['tarefas'] });
  };
  const invalidateFases = () => qc.invalidateQueries({ queryKey: ['esteira_fases', esteiraId] });
  const invalidateAut = () => qc.invalidateQueries({ queryKey: ['esteira_automacoes', esteiraId] });
  const fail = (e: unknown, msg: string) => toast({ title: msg, description: getErrorMessage(e, msg), variant: 'destructive' });

  const criarCard = useMutation({
    mutationFn: async (input: Partial<Card> & { titulo: string; fase_id: string }) => {
      const { data, error } = await sb.from('esteira_cards')
        .insert({ ...input, office_id: officeId, esteira_id: esteiraId, responsavel_id: input.responsavel_id ?? user?.id ?? null })
        .select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => invalidateCards(),
    onError: e => fail(e, 'Não foi possível criar o card'),
  });

  const atualizarCard = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Card> & { id: string }) => {
      const { clientes: _c, processos: _p, ...limpo } = patch as Card;
      void _c; void _p;
      const { data, error } = await sb.from('esteira_cards').update(limpo).eq('id', id).select('id');
      assertRowsAffected(data, error, 1);
    },
    // otimista no kanban: mover entre colunas não pode esperar a rede
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ['esteira_cards', esteiraId] });
      const prev = qc.getQueryData<Card[]>(['esteira_cards', esteiraId]);
      if (prev) {
        qc.setQueryData<Card[]>(['esteira_cards', esteiraId], prev.map(c => c.id === id
          ? { ...c, ...patch, entrou_fase_em: patch.fase_id && patch.fase_id !== c.fase_id ? new Date().toISOString() : c.entrou_fase_em }
          : c));
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['esteira_cards', esteiraId], ctx.prev);
      fail(e, 'Não foi possível salvar o card');
    },
    onSettled: () => invalidateCards(),
  });

  const excluirCard = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await sb.from('esteira_cards').update({ deletado: true }).eq('id', id).select('id');
      assertRowsAffected(data, error, 1);
    },
    onSuccess: () => { invalidateCards(); toast({ title: 'Card enviado para a Lixeira' }); },
    onError: e => fail(e, 'Não foi possível excluir o card'),
  });

  const salvarFase = useMutation({
    mutationFn: async (fase: Partial<Fase> & { id?: string }) => {
      if (fase.id) {
        const { id, ...patch } = fase;
        const { data, error } = await sb.from('esteira_fases').update(patch).eq('id', id).select('id');
        assertRowsAffected(data, error, 1);
      } else {
        const ordem = (fases.data?.length ?? 0);
        const { error } = await sb.from('esteira_fases').insert({ ordem, cor: '#64748b', ...fase, office_id: officeId, esteira_id: esteiraId });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateFases(),
    onError: e => fail(e, 'Não foi possível salvar a fase'),
  });

  const reordenarFases = useMutation({
    mutationFn: async (ids: string[]) => {
      for (let i = 0; i < ids.length; i++) {
        const { data, error } = await sb.from('esteira_fases').update({ ordem: i }).eq('id', ids[i]).select('id');
        assertRowsAffected(data, error, 1);
      }
    },
    onSuccess: () => invalidateFases(),
    onError: e => fail(e, 'Não foi possível reordenar as fases'),
  });

  const excluirFase = useMutation({
    mutationFn: async (id: string) => {
      const temCards = (cards.data || []).some(c => c.fase_id === id);
      if (temCards) throw new Error('Mova os cards desta fase antes de excluí-la.');
      const { data, error } = await sb.from('esteira_fases').delete().eq('id', id).select('id');
      assertRowsAffected(data, error, 1);
    },
    onSuccess: () => invalidateFases(),
    onError: e => fail(e, 'Não foi possível excluir a fase'),
  });

  const salvarAutomacao = useMutation({
    mutationFn: async (a: Partial<Automacao> & { id?: string }) => {
      if (a.id) {
        const { id, ...patch } = a;
        const { data, error } = await sb.from('esteira_automacoes').update(patch).eq('id', id).select('id');
        assertRowsAffected(data, error, 1);
      } else {
        const { error } = await sb.from('esteira_automacoes').insert({ ...a, office_id: officeId, esteira_id: esteiraId });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateAut(),
    onError: e => fail(e, 'Não foi possível salvar a automação'),
  });

  const excluirAutomacao = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await sb.from('esteira_automacoes').delete().eq('id', id).select('id');
      assertRowsAffected(data, error, 1);
    },
    onSuccess: () => invalidateAut(),
    onError: e => fail(e, 'Não foi possível excluir a automação'),
  });

  return {
    fases: fases.data ?? [],
    cards: cards.data ?? [],
    automacoes: automacoes.data ?? [],
    isLoading: fases.isLoading || cards.isLoading,
    error: fases.error || cards.error || automacoes.error,
    refetch: () => { fases.refetch(); cards.refetch(); automacoes.refetch(); },
    criarCard, atualizarCard, excluirCard,
    salvarFase, reordenarFases, excluirFase,
    salvarAutomacao, excluirAutomacao,
  };
}

/** Histórico do card (criado, movido, automações...). */
export function useEsteiraEventos(cardId: string | null) {
  return useQuery({
    queryKey: ['esteira_eventos', cardId],
    enabled: !!cardId,
    queryFn: async (): Promise<Evento[]> => {
      const { data, error } = await sb.from('esteira_eventos').select('*').eq('card_id', cardId)
        .order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return (data || []) as Evento[];
    },
  });
}

/** Cria (ou devolve, se já existir) o card de Peticionamento a partir de um prazo. */
export async function cardDePrazo(args: { controladoriaPrazoId?: string; prazoId?: string }): Promise<{ cardId: string; esteiraId: string }> {
  const { data, error } = await sb.rpc('esteira_card_de_prazo', {
    p_controladoria_prazo_id: args.controladoriaPrazoId ?? null,
    p_prazo_id: args.prazoId ?? null,
  });
  if (error) throw error;
  const cardId = data as string;
  const { data: row, error: e2 } = await sb.from('esteira_cards').select('esteira_id').eq('id', cardId).single();
  if (e2) throw e2;
  return { cardId, esteiraId: (row as { esteira_id: string }).esteira_id };
}

/** Registra um comentário no histórico do card. */
export async function comentarCard(officeId: string, cardId: string, texto: string): Promise<void> {
  const { error } = await sb.from('esteira_eventos').insert({ office_id: officeId, card_id: cardId, tipo: 'comentario', descricao: texto });
  if (error) throw error;
}

/** Fases de todas as esteiras do escritório (destino de "criar card em outra esteira"). */
export function useTodasFases() {
  const { user } = useAuth();
  const officeId = user?.office_id;
  return useQuery({
    queryKey: ['esteira_fases_todas', officeId],
    enabled: !!officeId,
    queryFn: async (): Promise<(Fase & { esteiras: { nome: string; deletado: boolean } | null })[]> => {
      const { data, error } = await sb.from('esteira_fases').select('*, esteiras(nome, deletado)')
        .eq('office_id', officeId).order('ordem');
      if (error) throw error;
      return ((data || []) as (Fase & { esteiras: { nome: string; deletado: boolean } | null })[])
        .filter(f => f.esteiras && !f.esteiras.deletado);
    },
  });
}
