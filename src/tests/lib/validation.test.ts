import { describe, it, expect } from "vitest";
import {
  clienteSchema, audienciaFormSchema, prazoFormSchema,
  atendimentoFormSchema, agendarPublicacaoSchema,
  zodErrorsToMap, firstZodError,
} from "@/lib/validation";

const clienteOk = {
  name: "Maria da Silva",
  tipoPessoa: "fisica" as const,
  cpfCnpj: "529.982.247-25", // CPF matematicamente válido
  email: "maria@exemplo.com",
  phone: "(61) 99999-8888",
};

describe("clienteSchema", () => {
  it("aceita um cliente PF válido", () => {
    expect(clienteSchema.safeParse(clienteOk).success).toBe(true);
  });
  it("aceita PJ com CNPJ válido e campos opcionais vazios", () => {
    const r = clienteSchema.safeParse({
      name: "Empresa X", tipoPessoa: "juridica",
      cpfCnpj: "11.222.333/0001-81", email: "", phone: "",
    });
    expect(r.success).toBe(true);
  });
  it("exige nome", () => {
    const r = clienteSchema.safeParse({ ...clienteOk, name: "   " });
    expect(r.success).toBe(false);
    if (!r.success) expect(zodErrorsToMap(r.error).name).toBe("Nome é obrigatório.");
  });
  it("exige CPF/CNPJ com rótulo correto por tipo de pessoa", () => {
    const pf = clienteSchema.safeParse({ ...clienteOk, cpfCnpj: "" });
    if (!pf.success) expect(zodErrorsToMap(pf.error).cpfCnpj).toBe("CPF é obrigatório.");
    const pj = clienteSchema.safeParse({ ...clienteOk, tipoPessoa: "juridica", cpfCnpj: "" });
    if (!pj.success) expect(zodErrorsToMap(pj.error).cpfCnpj).toBe("CNPJ é obrigatório.");
  });
  it("rejeita CPF inválido", () => {
    const r = clienteSchema.safeParse({ ...clienteOk, cpfCnpj: "111.111.111-11" });
    expect(r.success).toBe(false);
    if (!r.success) expect(zodErrorsToMap(r.error).cpfCnpj).toBe("CPF inválido.");
  });
  it("rejeita e-mail e telefone malformados (quando preenchidos)", () => {
    const r = clienteSchema.safeParse({ ...clienteOk, email: "x@", phone: "(00) 1234" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const m = zodErrorsToMap(r.error);
      expect(m.email).toBe("E-mail inválido.");
      expect(m.phone).toBe("Telefone inválido (use DDD + número).");
    }
  });
});

describe("schemas de formulários rápidos", () => {
  it("audiência exige título, data, hora e tipo", () => {
    expect(audienciaFormSchema.safeParse({ titulo: "Conciliação", data: "2026-08-03", hora: "14:00", tipo: "Conciliação" }).success).toBe(true);
    const r = audienciaFormSchema.safeParse({ titulo: "", data: "", hora: "", tipo: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstZodError(r.error)).toBe("Preencha título, data, horário e tipo.");
  });
  it("prazo exige título e prazo fatal", () => {
    expect(prazoFormSchema.safeParse({ titulo: "Contestação", dataPrazoFatal: "2026-07-20" }).success).toBe(true);
    expect(prazoFormSchema.safeParse({ titulo: "Contestação", dataPrazoFatal: "" }).success).toBe(false);
  });
  it("atendimento rejeita o placeholder __none__ como tipo", () => {
    expect(atendimentoFormSchema.safeParse({ tipo_atendimento: "__none__", data_atendimento: "2026-07-09", hora_atendimento: "10:00" }).success).toBe(false);
    expect(atendimentoFormSchema.safeParse({ tipo_atendimento: "reuniao", data_atendimento: "2026-07-09", hora_atendimento: "10:00" }).success).toBe(true);
  });
  it("agendamento de publicação exige título e data", () => {
    const r = agendarPublicacaoSchema.safeParse({ titulo: "", data: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstZodError(r.error)).toBe("Informe o título.");
  });
});
