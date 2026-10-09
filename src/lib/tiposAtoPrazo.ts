// Tipos de ato processual usados no cadastro de prazo (tabela tipos_ato_prazo,
// uma lista por escritório). Fonte única dos padrões do CPC e do carregamento
// com semente: antes, só o diálogo "Novo prazo" semeava os padrões num
// escritório novo — "Gerenciar tipos" e Configurações → Prazos liam a tabela
// crua e mostravam "nenhum tipo cadastrado" até alguém abrir o diálogo.
import { supabase } from "@/integrations/supabase/client";

export interface TipoAto {
  id?: string;
  value: string;
  label: string;
  diasUteis: number;
  corridos: boolean;
  margem: number;
  ordem: number;
}

export const TIPOS_ATO_DEFAULT: Omit<TipoAto, "id">[] = [
  { value: "contestacao",   label: "Contestação",               diasUteis: 15, corridos: false, margem: 3, ordem: 0  },
  { value: "apelacao",      label: "Recurso de Apelação",       diasUteis: 15, corridos: false, margem: 3, ordem: 1  },
  { value: "agravo",        label: "Agravo de Instrumento",     diasUteis: 15, corridos: false, margem: 3, ordem: 2  },
  { value: "embargos",      label: "Embargos de Declaração",    diasUteis: 5,  corridos: false, margem: 1, ordem: 3  },
  { value: "contrarrazoes", label: "Contrarrazões",             diasUteis: 15, corridos: false, margem: 3, ordem: 4  },
  { value: "manifestacao",  label: "Manifestação / Petição",    diasUteis: 5,  corridos: false, margem: 1, ordem: 5  },
  { value: "impugnacao",    label: "Impugnação ao cumprimento", diasUteis: 15, corridos: false, margem: 3, ordem: 6  },
  { value: "resp_rext",     label: "REsp / RE",                 diasUteis: 15, corridos: false, margem: 3, ordem: 7  },
  { value: "juizado_5",     label: "Juizado — 5 dias corridos", diasUteis: 5,  corridos: true,  margem: 1, ordem: 8  },
  { value: "juizado_10",    label: "Juizado — 10 dias corridos",diasUteis: 10, corridos: true,  margem: 2, ordem: 9  },
  { value: "juizado_15",    label: "Juizado — 15 dias corridos",diasUteis: 15, corridos: true,  margem: 3, ordem: 10 },
];

type TipoAtoRow = {
  id: string; value: string; label: string; dias_uteis: number; corridos: boolean; margem: number; ordem: number;
};

export function dbToTipoAto(row: TipoAtoRow | Record<string, unknown>): TipoAto {
  const r = row as TipoAtoRow;
  return { id: r.id, value: r.value, label: r.label, diasUteis: r.dias_uteis, corridos: r.corridos, margem: r.margem, ordem: r.ordem };
}

/** Linhas para INSERT dos padrões no escritório. */
export function tiposAtoDefaultRows(officeId: string) {
  return TIPOS_ATO_DEFAULT.map(t => ({
    office_id: officeId, value: t.value, label: t.label,
    dias_uteis: t.diasUteis, corridos: t.corridos, margem: t.margem, ordem: t.ordem,
  }));
}

export interface TiposAtoCarregados {
  tipos: TipoAto[];
  /** true quando os padrões acabaram de ser gravados para este escritório. */
  semeado: boolean;
  /** true quando a tabela estava vazia e a semente NÃO pôde ser gravada (RLS/erro):
   *  os padrões vêm só em memória, sem id, para o cadastro de prazo não travar. */
  fallback: boolean;
}

/**
 * Carrega os tipos do escritório; se não houver nenhum, grava os padrões e os
 * devolve. Falha na LEITURA é propagada (o chamador mostra erro e retry); falha
 * na SEMENTE cai para os padrões em memória — pior é bloquear o prazo.
 */
export async function carregarTiposAto(officeId: string): Promise<TiposAtoCarregados> {
  const { data, error } = await supabase
    .from("tipos_ato_prazo")
    .select("*")
    .eq("office_id", officeId)
    .order("ordem", { ascending: true });
  if (error) throw error;
  const rows = (data || []) as TipoAtoRow[];
  if (rows.length > 0) return { tipos: rows.map(dbToTipoAto), semeado: false, fallback: false };

  const { data: inserted, error: insertError } = await supabase
    .from("tipos_ato_prazo")
    .insert(tiposAtoDefaultRows(officeId))
    .select("*");
  const gravados = (inserted || []) as TipoAtoRow[];
  if (insertError || gravados.length === 0) {
    return { tipos: TIPOS_ATO_DEFAULT.map((t, i) => ({ ...t, id: `default-${i}` })), semeado: false, fallback: true };
  }
  return { tipos: gravados.map(dbToTipoAto).sort((a, b) => a.ordem - b.ordem), semeado: true, fallback: false };
}
