// Extrai uma mensagem legível de um erro de tipo `unknown`, sem depender de `any`.
// Cobre Error, erros do Supabase/PostgREST ({ message }), strings soltas e o resto.
// Serve para tipar os blocos catch como `unknown` e ainda exibir um toast útil:
//   } catch (e: unknown) {
//     toast({ description: getErrorMessage(e, "Falha ao salvar.") });
//   }
export function getErrorMessage(e: unknown, fallback = "Ocorreu um erro inesperado."): string {
  if (typeof e === "string") return e.trim() || fallback;
  if (e instanceof Error) return e.message.trim() || fallback;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

// Erro de "sem permissão" pra usar em catch/toast quando um UPDATE/DELETE some
// silenciosamente (ver assertRowsAffected abaixo) — mensagem única e reconhecível.
export const PERMISSAO_NEGADA = "Você não tem permissão para esta ação. Fale com o administrador do escritório.";

// Postgres NÃO lança erro quando um UPDATE/DELETE é bloqueado pela RLS (policy
// RESTRICTIVE via USING) — só casa 0 linhas e devolve sucesso. Sem checar quantas
// linhas voltaram (por isso as mutations precisam encadear `.select('id')`), a UI
// mostrava "sucesso" com a linha intocada no banco (mesma classe do bug corrigido
// em Lixeira.tsx). Uso: `const { data, error } = await q.select('id'); assertRowsAffected(data, error, ids.length);`
export function assertRowsAffected(data: unknown[] | null, error: unknown, expected: number): void {
  if (error) throw error;
  if ((data?.length ?? 0) < expected) throw new Error(PERMISSAO_NEGADA);
}

// Algumas queries (ex.: tarefa_subtarefas, tarefa_comentarios) tratavam QUALQUER
// erro como "tabela ainda não existe nesse ambiente" e devolviam [] silenciosamente
// — o que escondia falhas reais de rede/RLS como se fosse "sem itens". Só a tabela
// genuinamente ausente do schema cache do PostgREST (42P01 undefined_table,
// PGRST205 quando a tabela não está exposta) deve ter esse fallback; qualquer outro
// erro precisa subir e aparecer pro usuário.
export function isMissingTableError(error: unknown): boolean {
  const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
  if (code === "42P01" || code === "PGRST205") return true;
  const msg = getErrorMessage(error, "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("schema cache");
}
