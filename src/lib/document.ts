// Máscaras e validação de CPF/CNPJ (dígitos verificadores).
export const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");

export function formatCPF(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatCNPJ(v: string): string {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function formatCpfCnpj(v: string, tipo?: "fisica" | "juridica"): string {
  const d = onlyDigits(v);
  if (!d) return "";
  if (tipo === "juridica" || d.length > 11) return formatCNPJ(d);
  return formatCPF(d);
}

export function isValidCPF(v: string): boolean {
  const c = onlyDigits(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10) r = 0;
  if (r !== parseInt(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10) r = 0;
  return r === parseInt(c[10]);
}

export function isValidCNPJ(v: string): boolean {
  const c = onlyDigits(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    let s = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) {
      s += parseInt(c[len - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(c[12]) && calc(13) === parseInt(c[13]);
}

export function isValidCpfCnpj(v: string, tipo: "fisica" | "juridica"): boolean {
  return tipo === "fisica" ? isValidCPF(v) : isValidCNPJ(v);
}
