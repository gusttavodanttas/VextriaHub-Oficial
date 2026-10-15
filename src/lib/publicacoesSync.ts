// Mapeamento puro dos itens devolvidos pelas edge functions (fetch-by-oab /
// fetch-processo) para o registro gravado em `publicacoes`. Extraído de
// hooks/usePublicacoes.tsx (syncByOab / fetchByCnj) — mesma lógica, sem I/O,
// para dar pra testar sem Supabase.
import type { NovaPublicacao } from "@/types/publicacao";

/** Item devolvido pela edge function fetch-by-oab (PJE Comunica / DataJud) — só o que o sync lê. */
export interface ItemOab {
  numeroProcesso?: string | null;
  fonte?: string | null;
  conteudo?: string | null;
  data_disponibilizacao?: string | null;
  titulo?: string | null;
  tribunal?: string | null;
  comarca?: string | null;
  vara?: string | null;
  nome_orgao?: string | null;
  tipo_comunicacao?: string | null;
  tipo_documento?: string | null;
  ultimoAndamento?: { descricao?: string | null; data?: string | null } | null;
}

// Urgência automática: publicação que dispara prazo/ato = alta
export function deriveUrgencia(conteudo?: string | null, tipo?: string | null): 'alta' | 'media' {
  const t = `${conteudo || ''} ${tipo || ''}`.toLowerCase();
  return /(prazo|intim|manifest|contest|impugna|recurso|apelaç|agravo|embargos|contrarraz|cite-se|cita[çc]|r[ée]plica|cumprimento de senten|penhora|leil[aã]o|audi[êe]ncia)/.test(t)
    ? 'alta' : 'media';
}

export const soDigitos = (v?: string | null) => (v || '').replace(/\D/g, '');

/** Data de publicação (yyyy-mm-dd): disponibilização > último andamento > hoje. */
export function dataPublicacaoDoItem(item: ItemOab): string {
  return item.data_disponibilizacao
    ? new Date(item.data_disponibilizacao).toISOString().split('T')[0]
    : item.ultimoAndamento?.data
    ? new Date(item.ultimoAndamento.data).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
}

/**
 * Registro para um item da busca por OAB. Devolve null para o que o sync ignora:
 * andamentos do DataJud (não são publicações oficiais) e conteúdo curto demais.
 * `processoMap` (numero_processo só dígitos → id) vincula automaticamente a um
 * processo já cadastrado.
 */
export function montarRegistroOab(item: ItemOab, processoMap: Map<string, string>): NovaPublicacao | null {
  // DataJud retorna andamentos processuais — ignorar, não são publicações oficiais
  if (item.fonte === 'datajud') return null;

  // A partir daqui: somente itens do PJE Comunica (publicações oficiais)
  const conteudo = item.conteudo || item.ultimoAndamento?.descricao || 'Expediente processual identificado via sincronização automática.';
  if (!conteudo || conteudo.length < 10) return null;

  // Título vem pronto do mapPjeItem: "Autor x Réu" ou "Intimação" etc.
  const titulo = item.titulo && !item.titulo.startsWith('Publicação')
    ? item.titulo
    : item.tipo_documento || item.tipo_comunicacao || `Publicação ${item.numeroProcesso}`;

  // Vincula automaticamente se já houver processo cadastrado com esse número
  const processoIdVinculado = processoMap.get(soDigitos(item.numeroProcesso)) || null;

  return {
    titulo,
    conteudo,
    data_publicacao: dataPublicacaoDoItem(item),
    numero_processo: item.numeroProcesso,
    status: 'nova' as const,
    urgencia: deriveUrgencia(conteudo, item.tipo_documento || item.tipo_comunicacao),
    tags: [item.tribunal?.toUpperCase() || 'TRIBUNAL', 'pje_comunica'].filter(Boolean),
    tribunal: item.tribunal || null,
    comarca: item.comarca || null,
    vara: item.vara || null,
    tipo_documento: item.tipo_documento || null,
    nome_orgao: item.nome_orgao || item.vara || null,
    processo_id: processoIdVinculado,
  } as NovaPublicacao;
}

/** Registro para um item da busca por CNJ (fetch-processo). */
export function montarRegistroCnj(item: ItemOab, cnj: string): NovaPublicacao {
  const conteudo = item.fonte === 'datajud'
    ? (item.ultimoAndamento?.descricao || item.conteudo?.split('\n\n')[0] || `Andamento processual — ${cnj}`)
    : (item.conteudo || item.ultimoAndamento?.descricao || `Andamento processual — ${cnj}`);
  return {
    titulo: item.titulo || `Processo ${cnj}`,
    conteudo,
    data_publicacao: dataPublicacaoDoItem(item),
    numero_processo: cnj,
    status: 'nova',
    urgencia: deriveUrgencia(conteudo, item.tipo_documento || item.tipo_comunicacao),
    tags: [item.tribunal?.toUpperCase() || 'CNJ'],
    tribunal: item.tribunal || null,
    comarca: item.comarca || null,
    vara: item.vara || null,
    tipo_documento: item.tipo_documento || null,
    nome_orgao: item.nome_orgao || null,
  } as NovaPublicacao;
}
