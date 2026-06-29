import { onlyDigits } from "@/lib/document";

const primeiroNome = (nome: string) => (nome || "").trim().split(/\s+/)[0] || "";

// Monta uma mensagem profissional de retomada de contato (o usuário revisa e envia).
export function gerarMensagemContato(lead: { nome?: string }, remetente?: string): string {
  const ola = `Olá${lead.nome ? `, ${primeiroNome(lead.nome)}` : ""}! Tudo bem?`;
  const corpo = "Estou retomando seu atendimento para dar continuidade. Você tem disponibilidade para conversarmos?";
  const fim = remetente ? `\n\nFico à disposição,\n${remetente}` : "\n\nFico à disposição.";
  return `${ola} ${corpo}${fim}`;
}

export function linkWhatsapp(telefone: string, msg: string): string {
  return `https://wa.me/55${onlyDigits(telefone)}?text=${encodeURIComponent(msg)}`;
}

export function linkEmail(email: string, msg: string, assunto = "Retomada de contato"): string {
  return `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(msg)}`;
}
