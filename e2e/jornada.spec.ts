// Jornada principal com a conta de teste: cliente → processo → prazo, passando pela
// RLS e pelas cotas de verdade. Tudo que é criado leva PREFIXO e é apagado no fim
// (limpeza direta no Supabase com a sessão da própria conta — ver limparRastros).
import { test, expect, type Page } from '@playwright/test';
import { PREFIXO, cpfValido, emDias, exigirCredenciais } from './_env';
import { limparRastros } from './limpeza';

const nomeCliente = `${PREFIXO} Cliente`;
const tituloProcesso = `${PREFIXO} Processo`;
const tituloPrazo = `${PREFIXO} Prazo`;

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => { exigirCredenciais(); });
test.afterAll(async () => { await limparRastros(PREFIXO); });

async function fecharToasts(page: Page) {
  // Toasts do shadcn ficam por cima de botões em telas baixas — fecha o que estiver aberto.
  for (const b of await page.locator('[data-radix-toast-announce-exclude] button, [role="status"] button').all()) {
    await b.click({ timeout: 1000 }).catch(() => undefined);
  }
}

test('1. cadastra um cliente', async ({ page }) => {
  await page.goto('/clientes');
  await page.getByRole('button', { name: 'Novo Cliente' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Nome do cliente').fill(nomeCliente);
  await dialog.getByPlaceholder('000.000.000-00').fill(cpfValido());
  await dialog.getByPlaceholder('email@exemplo.com').fill(`e2e+${Date.now()}@vextriahub.test`);
  await dialog.getByRole('button', { name: 'Cadastrar Cliente' }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText(nomeCliente).first()).toBeVisible({ timeout: 20_000 });
});

test('2. cadastra um processo manual vinculado ao cliente', async ({ page }) => {
  await page.goto('/processos');
  await page.getByRole('button', { name: 'Novo Processo' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Manual', { exact: true }).click();
  await dialog.getByLabel('Título do Processo').fill(tituloProcesso);
  const cliente = dialog.getByPlaceholder('Selecionar cliente do cadastro...');
  await cliente.fill(PREFIXO);
  await dialog.getByRole('button', { name: nomeCliente }).first().click();
  await fecharToasts(page);
  await dialog.getByRole('button', { name: 'Finalizar Cadastro' }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText(tituloProcesso).first()).toBeVisible({ timeout: 20_000 });
});

test('3. lança um prazo fatal', async ({ page }) => {
  await page.goto('/prazos');
  await page.getByRole('button', { name: 'Novo Prazo' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Ex: Contestação, Recurso, Manifestação...').fill(tituloPrazo);
  // A linha "Prazo Fatal *" tem um <input type="date"> nativo ao lado do calendário.
  const linhaFatal = dialog.locator('div', { hasText: 'Prazo Fatal' }).filter({ has: page.locator('input[type="date"]') }).last();
  await linhaFatal.locator('input[type="date"]').fill(emDias(10));
  await dialog.getByRole('button', { name: 'Criar Prazo' }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText(tituloPrazo).first()).toBeVisible({ timeout: 20_000 });
});
