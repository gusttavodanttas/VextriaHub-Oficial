// Fonte única da verdade para os status de audiências e atendimentos.
//
// Histórico: o banco acumulou variações de gênero ("agendado" em audiências,
// "agendada" em atendimentos) porque cada tela gravava o seu. Isso quebrava
// selects de edição (valor não batia com as opções) e filtros. Regra adotada:
//   • audiencias  → feminino  (agendada, confirmada, pendente, realizada, cancelada)
//   • atendimentos → masculino (agendado, realizado, cancelado, pendente)
// Estes normalizadores aceitam qualquer variação e devolvem o valor canônico.

export const AUDIENCIA_STATUS = ["agendada", "confirmada", "pendente", "realizada", "cancelada"] as const;
export type AudienciaStatus = typeof AUDIENCIA_STATUS[number];

const AUD_MAP: Record<string, AudienciaStatus> = {
  agendado: "agendada",
  confirmado: "confirmada",
  realizado: "realizada",
  cancelado: "cancelada",
};

export function normalizeAudienciaStatus(s?: string | null): AudienciaStatus {
  const v = (s || "").toLowerCase().trim();
  if ((AUDIENCIA_STATUS as readonly string[]).includes(v)) return v as AudienciaStatus;
  return AUD_MAP[v] || "agendada";
}

export const ATENDIMENTO_STATUS = ["agendado", "realizado", "cancelado", "pendente"] as const;
export type AtendimentoStatus = typeof ATENDIMENTO_STATUS[number];

const ATE_MAP: Record<string, AtendimentoStatus> = {
  agendada: "agendado",
  realizada: "realizado",
  cancelada: "cancelado",
  confirmado: "agendado",
  confirmada: "agendado",
};

export function normalizeAtendimentoStatus(s?: string | null): AtendimentoStatus {
  const v = (s || "").toLowerCase().trim();
  if ((ATENDIMENTO_STATUS as readonly string[]).includes(v)) return v as AtendimentoStatus;
  return ATE_MAP[v] || "agendado";
}
