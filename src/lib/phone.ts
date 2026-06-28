// Telefone brasileiro: (XX) XXXXX-XXXX (celular) ou (XX) XXXX-XXXX (fixo)

/** Formata progressivamente conforme o usuário digita. Mantém só dígitos (máx 11). */
export function formatPhone(value: string): string {
  const d = (value || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Vazio é considerado "válido" (campo opcional). Caso tenha conteúdo, exige 10 ou 11 dígitos com DDD plausível. */
export function isValidPhone(value: string): boolean {
  const d = (value || "").replace(/\D/g, "");
  if (d.length === 0) return true;
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = parseInt(d.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) return false;
  // Celular (11 dígitos) deve começar com 9 após o DDD
  if (d.length === 11 && d[2] !== "9") return false;
  return true;
}
