import { supabase } from '@/integrations/supabase/client';

// Tipos e helpers puros da sincronização judicial (busca por OAB e importação).

export interface Andamento {
  data: string | null;
  resumo: string;
  descricao?: string;
  fase?: string;
}

export interface JudicialProcessResult {
  id: string;
  fonte?: string;
  numeroProcesso: string;
  numeroFormatado?: string;
  titulo: string;
  partes: string;
  tribunal: string;
  ultimoAndamento: { descricao: string; data: string | null } | null;
  andamentos?: Andamento[];
  faseProcessual: string;
  classe?: string;
  assunto?: string;
  dataAjuizamento?: string | null;
  instancia?: string;
  valorCausa?: number;
  vara?: string;
  comarca?: string;
  orgaoJulgadorCodigo?: string;
  nivelSigilo?: number;
  conteudo?: string;
  autor: string;
  reu: string;
}

export type PoloCliente = 'autor' | 'reu';

export type ProcessoParaImportar = JudicialProcessResult & { clienteId?: string | null };

export function looksLikeContaminatedName(s: string): boolean {
  if (!s) return false;
  if (s.length > 120) return true;
  if (s.split(' ').length > 12) return true;
  return /\b(SENTEN[ÇC]A|DECIS[ÃA]O|CERTID[ÃA]O|FINALIDADE|DESTINAT|OBSERVA[ÇC][ÃA]O|INTIMA[ÇC][ÃA]O)\b/i.test(s);
}

export function normalizeClientName(s: string): string {
  return s.replace(/\s+/g, ' ').trim().split(' ').slice(0, 8).join(' ').slice(0, 100);
}

/** Só dígitos do número CNJ — chave usada para dedup contra processos já importados/descartados. */
export const somenteDigitos = (numero: string | null | undefined) => (numero || '').replace(/\D/g, '');

/**
 * Resolve o cliente do processo a partir do polo marcado como "meu cliente":
 * reaproveita um cliente com o mesmo nome no escritório ou cria um novo.
 * Devolve null quando não há polo marcado, nome vazio ou o insert falhou
 * (o processo é importado sem cliente — mesmo comportamento de antes).
 */
export async function resolverClienteId(
  proc: JudicialProcessResult,
  polo: PoloCliente | undefined,
  officeId: string,
  userId: string,
): Promise<string | null> {
  if (!polo) return null;
  const rawName = polo === 'autor' ? proc.autor : proc.reu;
  if (!rawName) return null;
  const nomeCliente = normalizeClientName(rawName);

  const { data: existing } = await supabase
    .from('clientes')
    .select('id')
    .eq('nome', nomeCliente)
    .eq('office_id', officeId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: novo, error } = await supabase
    .from('clientes')
    .insert({ nome: nomeCliente, office_id: officeId, user_id: userId })
    .select('id')
    .single();
  return !error && novo ? novo.id : null;
}
