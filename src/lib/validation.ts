// Camada única de validação de formulários (zod).
//
// Regra da casa: os schemas REUTILIZAM os validadores já existentes
// (document.ts, phone.ts) e mantêm as MESMAS mensagens que a UI exibia —
// centraliza a regra sem mudar a experiência. Ao validar em um dialog,
// use `schema.safeParse(...)` + `zodErrorsToMap`/`firstZodError`.
import { z } from "zod";
import { onlyDigits, isValidCpfCnpj } from "@/lib/document";
import { isValidPhone } from "@/lib/phone";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Converte um ZodError em { campo: primeiraMensagem } para estados de erro por campo. */
export function zodErrorsToMap(err: z.ZodError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!map[key]) map[key] = issue.message;
  }
  return map;
}

/** Primeira mensagem de erro (para toasts). */
export function firstZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Dados inválidos.";
}

// ─── Cliente ─────────────────────────────────────────────────────────────────

export const clienteSchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório."),
    tipoPessoa: z.enum(["fisica", "juridica"]),
    cpfCnpj: z.string(),
    email: z.string(),
    phone: z.string(),
  })
  .superRefine((v, ctx) => {
    const label = v.tipoPessoa === "juridica" ? "CNPJ" : "CPF";
    if (!onlyDigits(v.cpfCnpj)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cpfCnpj"], message: `${label} é obrigatório.` });
    } else if (!isValidCpfCnpj(v.cpfCnpj, v.tipoPessoa)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cpfCnpj"], message: `${label} inválido.` });
    }
    if (v.email && !EMAIL_RE.test(v.email)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "E-mail inválido." });
    }
    if (v.phone && !isValidPhone(v.phone)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Telefone inválido (use DDD + número)." });
    }
  });

// ─── Audiência (dialog principal) ────────────────────────────────────────────

export const audienciaFormSchema = z.object({
  titulo: z.string().trim().min(1, "Preencha título, data, horário e tipo."),
  data: z.string().min(1, "Preencha título, data, horário e tipo."),
  hora: z.string().min(1, "Preencha título, data, horário e tipo."),
  tipo: z.string().trim().min(1, "Preencha título, data, horário e tipo."),
});

// ─── Prazo (dialog standalone) ───────────────────────────────────────────────

export const prazoFormSchema = z.object({
  titulo: z.string().trim().min(1, "Preencha o título e o prazo fatal."),
  dataPrazoFatal: z.string().min(1, "Preencha o título e o prazo fatal."),
});

// ─── Atendimento (form dialog) ───────────────────────────────────────────────

const NONE = "__none__";

export const atendimentoFormSchema = z.object({
  tipo_atendimento: z.string().refine((v) => !!v && v !== NONE, "Selecione o tipo de atendimento."),
  data_atendimento: z.string().min(1, "Informe a data."),
  hora_atendimento: z.string().min(1, "Informe a hora."),
});

// ─── Agendamento a partir de publicação (prazo/tarefa/audiência) ─────────────

export const agendarPublicacaoSchema = z.object({
  titulo: z.string().trim().min(1, "Informe o título."),
  data: z.string().min(1, "Informe a data."),
});
