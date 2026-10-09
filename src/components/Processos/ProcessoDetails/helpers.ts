import type React from 'react';
import type { useProcessoSubData } from '@/hooks/useProcessoSubData';
import type { useProcessoMovimentacoes } from '@/hooks/useProcessoMovimentacoes';

// Tipos e helpers puros compartilhados pelas abas do ProcessoDetailsDrawer.
// (Separado de shared.tsx para o Fast Refresh: lá só vivem componentes.)

export type SubData = ReturnType<typeof useProcessoSubData>;
export type Movimentacoes = ReturnType<typeof useProcessoMovimentacoes>;

export interface ProcessoEditData {
  titulo: string;
  numero_processo: string;
  status: string;
  parte_autora: string;
  requerido: string;
  classe_judicial: string;
  assunto_principal: string;
  fase_processual: string;
  instancia: string;
  tribunal: string;
  vara: string;
  comarca: string;
  valor_causa: number;
  team_id: string;
  responsavel_id: string;
  resultado: string;
}

export type SetEditData = React.Dispatch<React.SetStateAction<ProcessoEditData>>;

export const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
export const fmtDateTime = (d: string | null | undefined) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtDuration = (min: number | null | undefined) => {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? `${String(m).padStart(2, '0')}min` : ''}` : `${m}min`;
};

export const getStatusStyle = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s.includes('andamento') || s === 'ativo') return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  if (s.includes('concluído') || s.includes('encerrado')) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  if (s.includes('suspenso')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
};

export const getPrioridadeStyle = (p: string) => {
  if (p === 'alta' || p === 'urgente') return 'text-rose-600 bg-rose-500/10 border-rose-500/20';
  if (p === 'media') return 'text-amber-600 bg-amber-500/10 border-amber-500/20';
  return 'text-slate-600 bg-slate-500/10 border-slate-500/20';
};
