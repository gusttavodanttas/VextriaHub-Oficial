import { Newspaper, Shield, AlertOctagon } from "lucide-react";

// Tipos e helpers puros do formulário de prazo (NovoPrazoStandaloneDialog).

export interface ProcessoOption {
  id: string;
  titulo: string;
  numero_processo: string;
}

export interface PrazoFormData {
  id?: string;
  titulo: string;
  descricao?: string | null;
  data_publicacao?: string | null;
  data_prazo_interno?: string | null;
  data_fim_prazo?: string | null;
  prioridade: string;
  processo_id?: string | null;
  office_id?: string | null;
  user_id?: string;
  responsavel_id?: string | null;
  avisos_dias?: number[] | null;
  titular?: string | null;
}

export type FormState = {
  titulo: string;
  descricao: string;
  dataPublicacao: string;
  dataPrazoInterno: string;
  dataPrazoFatal: string;
  prioridade: string;
  responsavel_id: string;
  avisosDias: number[] | null;
  titular: string;
};

export function emptyForm(tituloSugerido?: string, numeroProcesso?: string, userId = ""): FormState {
  return {
    titulo: tituloSugerido || "",
    descricao: numeroProcesso ? `Prazo vinculado à publicação do processo ${numeroProcesso}` : "",
    dataPublicacao: "", dataPrazoInterno: "", dataPrazoFatal: "", prioridade: "media",
    responsavel_id: userId,
    avisosDias: null,
    titular: "nosso",
  };
}
export function prazoToForm(p: PrazoFormData, userId = ""): FormState {
  return {
    titulo: p.titulo,
    descricao: p.descricao || "",
    dataPublicacao: p.data_publicacao || "",
    dataPrazoInterno: p.data_prazo_interno || "",
    dataPrazoFatal: p.data_fim_prazo || "",
    prioridade: p.prioridade || "media",
    responsavel_id: p.responsavel_id || userId,
    avisosDias: p.avisos_dias ?? null,
    titular: p.titular || "nosso",
  };
}

export const DATE_FIELDS = [
  { key: 'dataPublicacao'   as const, label: 'Data da Publicação', hint: 'Quando foi publicado no diário',  icon: Newspaper,    color: 'text-sky-500',    ring: 'border-sky-500/20',    bg: 'bg-sky-500/5',    required: false },
  { key: 'dataPrazoInterno' as const, label: 'Prazo Interno',       hint: 'Limite interno do escritório',    icon: Shield,       color: 'text-amber-500',  ring: 'border-amber-500/20',  bg: 'bg-amber-500/5',  required: false },
  { key: 'dataPrazoFatal'   as const, label: 'Prazo Fatal',          hint: 'Data limite legal — obrigatório', icon: AlertOctagon, color: 'text-red-500',    ring: 'border-red-500/20',    bg: 'bg-red-500/5',    required: true  },
] as const;
export type DateKey = typeof DATE_FIELDS[number]['key'];

/** Lê a lista `prazo_feriados` de offices.settings, separando os anuais (MM-DD) dos de data fixa (YYYY-MM-DD). */
export function separarFeriados(arr: string[]) {
  const anual = new Set<string>(); const esp = new Set<string>();
  arr.forEach(s => { if (s.length === 5) anual.add(s); else if (s.length === 10) esp.add(s); });
  return { anual, esp };
}
