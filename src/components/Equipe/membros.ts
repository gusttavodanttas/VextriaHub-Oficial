// Tipos e validação pura do módulo de Equipe (extraídos de pages/Equipe.tsx).
import type { OfficeUser, Invitation } from "@/types/database";

/** Linha de office_users enriquecida com o perfil (ver useOfficeUsers). */
export type MembroEquipe = OfficeUser & { profile: { full_name: string | null; email: string | null } | null };

export const nomeDoMembro = (u: MembroEquipe) => u.profile?.full_name || u.profile?.email || "Membro";

// Validação de formato — o form não fica dentro de um <form>, então o
// type="email" do Input não é aplicado pelo navegador ao confirmar (achado do relatório).
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Motivo para recusar um convite antes de bater no servidor, ou null se ok.
 * Não há constraint única no banco para e-mail de convite — checa contra o que
 * já está carregado pra dar uma mensagem específica em vez do genérico
 * "erro ao criar convite" (achado do relatório).
 */
export function validarConvite(
  email: string,
  invitations: Pick<Invitation, "status" | "email">[],
  users: MembroEquipe[],
): { title: string; description: string } | null {
  if (!EMAIL_RE.test(email)) {
    return { title: "E-mail inválido", description: "Verifique o formato do e-mail (ex: nome@escritorio.com.br)." };
  }
  const emailLower = email.toLowerCase();
  if (invitations.some(i => i.status === "pending" && i.email.toLowerCase() === emailLower)) {
    return { title: "Convite já existe", description: "Já há um convite pendente para este e-mail." };
  }
  if (users.some(u => (u.profile?.email || "").toLowerCase() === emailLower)) {
    return { title: "Já é membro", description: "Este e-mail já pertence a um membro do escritório." };
  }
  return null;
}
