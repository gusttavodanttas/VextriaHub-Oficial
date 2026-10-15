// Credenciais e helpers compartilhados pelos specs. Nunca grave valores aqui:
// tudo vem de variáveis de ambiente (secrets do CI ou .env local não versionado).
import { test } from '@playwright/test';

export const CRED = {
  email: process.env.E2E_TEST_EMAIL || '',
  password: process.env.E2E_TEST_PASSWORD || '',
};
export const temCredenciais = () => !!(CRED.email && CRED.password);

/** Pula o spec inteiro quando a conta de teste não está configurada. */
export function exigirCredenciais() {
  test.skip(!temCredenciais(), 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD não configurados — jornada autenticada pulada.');
}

/** Carimbo único por execução: tudo que o E2E cria leva este prefixo (e é apagado no fim). */
export const PREFIXO = `E2E ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

/** CPF válido aleatório (dígitos verificadores pelo mod 11) — evita "documento já cadastrado". */
export function cpfValido(): string {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (base: number[]) => {
    const soma = base.reduce((s, d, i) => s + d * (base.length + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(n); const d2 = dv([...n, d1]);
  const d = [...n, d1, d2].join('');
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export const emDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
