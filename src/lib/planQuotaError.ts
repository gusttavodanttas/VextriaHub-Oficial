// Traduz o erro do trigger enforce_plan_quota (Postgres) pra uma mensagem
// acionável. Na prática o botão de criar já vem desabilitado por
// usePlanLimits — isto cobre a EXCEÇÃO: contagem cliente desatualizada,
// duas abas criando ao mesmo tempo, ou a IA (que insere direto no banco e
// não passa pelo diálogo). Sem isto o usuário via só "Ocorreu um erro ao
// criar" e não fazia ideia do motivo.
const PADRAO = /Limite do plano atingido \((\d+) de (\d+) (\w+)\)/i;

const ROTULO: Record<string, string> = {
  processos: "processos",
  clientes: "clientes",
  tarefas: "tarefas",
  prazos: "prazos",
};

/** Extrai título/descrição amigáveis se `error` veio do enforce_plan_quota; senão null. */
export function planQuotaMessage(error: unknown): { title: string; description: string } | null {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const m = msg.match(PADRAO);
  if (!m) return null;
  const [, usados, limite, chave] = m;
  const rotulo = ROTULO[chave] || chave;
  return {
    title: "Limite do plano atingido",
    description: `Seu plano permite até ${limite} ${rotulo} (${usados} já cadastrados). Faça upgrade para adicionar mais.`,
  };
}
