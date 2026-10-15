// Tipos do módulo de Publicações (extraídos de hooks/usePublicacoes.tsx).

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

/** Shape que `createPublication` aceita — o que falta (office_id/user_id) o hook preenche. */
export type NovaPublicacao = Omit<Publication, 'id' | 'created_at' | 'office_id'>;

export interface PrazoInfo {
  data_intimacao: string;
  data_fim_prazo: string | null;
  dias_uteis: number | null;
  base_legal: string;
  eh_juizado: boolean;
  dias_corridos: boolean;
}

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
  refetch: () => void;
}

export type PublicacoesFilters = Omit<PublicacoesListaParams, 'page' | 'pageSize'>;

export interface PublicacoesStats {
  total: number;
  prazosSemana: number;
  naoTratadas: number;
  semVinculo: number;
  comVinculo: number;
  novosAndamentos: number;
  tratadas: number;
}
