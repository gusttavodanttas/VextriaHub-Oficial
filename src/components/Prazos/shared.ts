// Tipos, configs e helpers puros do módulo de Prazos — extraídos de
// pages/Prazos.tsx (código idêntico; movido para reuso e teste).
import React from 'react';
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { AlertTriangle, Flame, Timer, CalendarClock, CheckCircle2 } from 'lucide-react';
import { deepCleanHTML } from '@/lib/cleanHtml';
import { parseLocalDate } from '@/lib/dates';

export interface Prazo {
  id: string;
  titulo: string;
  descricao?: string | null;
  data_vencimento?: string | null;
  data_publicacao?: string | null;
  data_prazo_interno?: string | null;
  data_fim_prazo?: string | null;
  prioridade: 'alta' | 'media' | 'baixa';
  status: string;
  processo_id?: string | null;
  user_id: string;
  office_id?: string | null;
  responsavel_id?: string | null;
  titular?: string | null;
  concluido_em?: string | null;
  concluido_por?: string | null;
  // Campos gravados pelo robô (OAB/DJEN)
  publicacao_id?: string | null;
  numero_processo?: string | null;
  data_disponibilizacao?: string | null;
  data_intimacao?: string | null;
  base_legal?: string | null;
  tipo_prazo?: string | null;
  eh_juizado?: boolean | null;
  dias_uteis?: number | null;      // quantidade de dias do prazo
  dias_corridos?: boolean | null;  // true = contagem em dias corridos (Juizado)
  confirmado_em?: string | null;   // aceite da sugestão do robô
  confirmado_por?: string | null;
  // Sugestão de audiência detectada na publicação (item 5) — o usuário confirma ao agendar
  possivel_audiencia?: boolean | null;
  audiencia_data_sugerida?: string | null;
  audiencia_hora_sugerida?: string | null;
  audiencia_tipo_sugerido?: string | null;
}

export const onlyDigits = (s?: string | null) => (s || '').replace(/\D/g, '');

export type ProcInfo = { id: string; clienteId: string | null; clienteNome: string | null; numero: string | null };

// Teor/título vindos da publicação vinculada (prazos do robô nascem sem eles)
export type PubInfo = { titulo: string | null; conteudo: string | null };

// Sugestão pendente: nasceu de uma publicação capturada e ainda não foi aceita.
// Ao aceitar (ou revisar e salvar), vira um prazo normal.
export const ehSugestaoRobo = (p: { publicacao_id?: string | null; confirmado_em?: string | null }) =>
  !!p.publicacao_id && !p.confirmado_em;

// O teor indica audiência? (para oferecer o agendamento em vez de um prazo)
export const pareceAudiencia = (teor: string) => /audi[êe]ncia/i.test(teor || '');

// Extrai data/hora/tipo sugeridos do teor (espelha o analisarAudiencia do calculate-prazo).
// Usado no front pra pré-preencher o agendamento mesmo em prazos ANTIGOS (que não têm a
// sugestão gravada no banco). O usuário sempre confirma — nunca agenda sozinho.
const _MESES_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
function _tipoAudiencia(t: string): string | null {
  if (/concilia/i.test(t)) return 'Audiência de Conciliação';
  if (/instru/i.test(t)) return 'Audiência de Instrução';
  if (/justifica/i.test(t)) return 'Audiência de Justificação';
  if (/\buna\b/i.test(t)) return 'Audiência UNA';
  if (/saneamento/i.test(t)) return 'Audiência de Saneamento';
  if (/debates/i.test(t)) return 'Audiência de Debates';
  if (/trabalhista/i.test(t)) return 'Audiência Trabalhista';
  if (/criminal|penal/i.test(t)) return 'Audiência Criminal';
  return null;
}
export function extrairAudienciaSugerida(teor: string | null | undefined): { data: string | null; hora: string | null; tipo: string | null } {
  const t = teor || '';
  if (!/audi[êe]ncia/i.test(t)) return { data: null, hora: null, tipo: null };
  const cand: { ms: number; end: number }[] = [];
  for (const m of t.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g)) {
    const d = +m[1], mo = +m[2]; let y = +m[3]; if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) cand.push({ ms: new Date(y, mo - 1, d, 12).getTime(), end: (m.index ?? 0) + m[0].length });
  }
  for (const m of t.matchAll(/\b(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)\s+de\s+(\d{4})\b/gi)) {
    const mo = _MESES_PT[m[2].toLowerCase()]; const d = +m[1], y = +m[3];
    if (mo && d >= 1 && d <= 31) cand.push({ ms: new Date(y, mo - 1, d, 12).getTime(), end: (m.index ?? 0) + m[0].length });
  }
  const tipo = _tipoAudiencia(t);
  if (!cand.length) return { data: null, hora: null, tipo };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const fut = cand.filter(c => c.ms >= hoje.getTime()).sort((a, b) => a.ms - b.ms);
  const chosen = fut[0] || cand.slice().sort((a, b) => a.ms - b.ms)[0];
  const dt = new Date(chosen.ms);
  const data = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const horaDe = (s: string): string | null => {
    const mh = /(\d{1,2})\s*[:h]\s*(\d{2})\b/.exec(s) || /\b(\d{1,2})\s*h(?:oras|s)?\b/i.exec(s);
    if (mh && +mh[1] <= 23) return `${String(+mh[1]).padStart(2, '0')}:${mh[2] || '00'}`;
    return null;
  };
  const hora = horaDe(t.slice(chosen.end, chosen.end + 12)) || horaDe(t);
  return { data, hora, tipo };
}

// Título de exibição (prazos do robô podem vir sem título)
export function tituloPrazo(p: Prazo, pubs?: Record<string, PubInfo>): string {
  const pub = p.publicacao_id ? pubs?.[p.publicacao_id] : undefined;
  return (p.titulo && p.titulo.trim()) || (pub?.titulo || '').trim() || p.tipo_prazo || 'Prazo processual';
}

// Teor do prazo: descrição própria ou o conteúdo da publicação que o originou
export function teorPrazo(p: Prazo, pubs?: Record<string, PubInfo>): string {
  if (p.descricao && p.descricao.trim()) return p.descricao.trim();
  const pub = p.publicacao_id ? pubs?.[p.publicacao_id] : undefined;
  return pub?.conteudo ? deepCleanHTML(pub.conteudo) : '';
}

// Prazo fatal: data_fim_prazo (novo padrão) ou data_vencimento (legado)
export function getDataPrazo(prazo: Prazo): string | null {
  return prazo.data_fim_prazo || prazo.data_vencimento || null;
}

// Datas só-data (YYYY-MM-DD) no fuso local — centralizado em @/lib/dates.
// Mantém o retorno Date (Invalid Date para entrada ruim) por compatibilidade
// com differenceInCalendarDays; a EXIBIÇÃO usa fmtDate, que nunca lança.
export function toLocalDate(s: string): Date {
  return parseLocalDate(s) ?? new Date(NaN);
}

export type Urgency = 'vencido' | 'hoje' | 'critico' | 'normal' | 'concluido';

export const PRIORIDADE_RANK: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

export function getUrgency(prazo: Prazo): Urgency {
  if (prazo.status === 'concluido') return 'concluido';
  const data = getDataPrazo(prazo);
  if (!data) return 'normal';
  const days = differenceInCalendarDays(toLocalDate(data), startOfDay(new Date()));
  if (days < 0) return 'vencido';
  if (days === 0) return 'hoje';
  if (days <= 3) return 'critico';
  return 'normal';
}

export const URGENCY_CONFIG: Record<Urgency, {
  label: string; color: string; border: string; badge: string; icon: React.ElementType; dot: string;
}> = {
  vencido:  { label: 'Vencido',    color: 'text-red-600',     border: 'border-l-red-500',     badge: 'bg-red-500/10 text-red-600 border-red-500/20',       icon: AlertTriangle, dot: 'bg-red-500' },
  hoje:     { label: 'Hoje',       color: 'text-amber-600',   border: 'border-l-amber-500',   badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20',  icon: Flame,         dot: 'bg-amber-500' },
  critico:  { label: 'Crítico',    color: 'text-orange-600',  border: 'border-l-orange-400',  badge: 'bg-orange-500/10 text-orange-600 border-orange-500/20', icon: Timer,       dot: 'bg-orange-400' },
  normal:   { label: 'No prazo',   color: 'text-sky-600',     border: 'border-l-sky-400',     badge: 'bg-sky-500/10 text-sky-600 border-sky-500/20',        icon: CalendarClock, dot: 'bg-sky-400' },
  concluido:{ label: 'Concluído',  color: 'text-emerald-600', border: 'border-l-emerald-400', badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2, dot: 'bg-emerald-400' },
};

export const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  alta:  { label: 'Alta',  color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  media: { label: 'Média', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  baixa: { label: 'Baixa', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
};

export function getDaysLabel(prazo: Prazo): string {
  if (prazo.status === 'concluido') return 'Concluído';
  const data = getDataPrazo(prazo);
  if (!data) return '—';
  const days = differenceInCalendarDays(toLocalDate(data), startOfDay(new Date()));
  if (days < 0) return `Vencido há ${Math.abs(days)}d`;
  if (days === 0) return 'Vence hoje';
  if (days === 1) return 'Amanhã';
  return `${days} dias`;
}

export function sortPrazos(items: Prazo[], dateFirst = false): Prazo[] {
  const dateCmp = (a: Prazo, b: Prazo) => {
    const dateA = getDataPrazo(a);
    const dateB = getDataPrazo(b);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.localeCompare(dateB);
  };
  return [...items].sort((a, b) => {
    // Vencidos: mais atrasado (data mais antiga) primeiro
    if (dateFirst) { const d = dateCmp(a, b); if (d !== 0) return d; }
    const prioA = PRIORIDADE_RANK[a.prioridade] ?? 1;
    const prioB = PRIORIDADE_RANK[b.prioridade] ?? 1;
    if (prioA !== prioB) return prioA - prioB;
    return dateCmp(a, b);
  });
}

export const SECTION_ORDER: Urgency[] = ['vencido', 'hoje', 'critico', 'normal', 'concluido'];
export const SECTION_LABELS: Record<Urgency, string> = {
  vencido:   'Vencidos',
  hoje:      'Vencem hoje',
  critico:   'Próximos 3 dias',
  normal:    'Futuros',
  concluido: 'Concluídos',
};
