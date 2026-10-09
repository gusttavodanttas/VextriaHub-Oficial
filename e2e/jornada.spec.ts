// Jornada principal com a conta de teste: cliente → processo → prazo, passando pela
// RLS e pelas cotas de verdade. Tudo que é criado leva PREFIXO e é apagado no fim
// (limpeza direta no Supabase com a sessão da própria conta — ver limparRastros).
import { test, expect } from '@playwright/test';
import { PREFIXO, emDias, exigirCredenciais } from './_env';
import { limparRastros } from './limpeza';
import { registrarErrosApi, irPara, esperarFechar, fecharToasts, cadastrarCliente } from './acoes';

const nomeCliente = `${PREFIXO} Cliente`;
const tituloProcesso = `${PREFIXO} Processo`;
const tituloPrazo = `${PREFIXO} Prazo`;

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => { exigirCredenciais(); });
test.beforeEach(({ page }) => { registrarErrosApi(page); });
test.afterAll(async () => { await limparRastros(PREFIXO); });

test('1. cadastra um cliente', async ({ page }) => {
  await cadastrarCliente(page, nomeCliente);
});

test('2. cadastra um processo manual vinculado ao cliente', async ({ page }) => {
  await irPara(page, '/processos');
  await page.getByRole('button', { name: 'Novo Processo' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Manual', { exact: true }).click();
  await dialog.getByLabel('Título do Processo').fill(tituloProcesso);
  const cliente = dialog.getByPlaceholder('Selecionar cliente do cadastro...');
  await cliente.fill(PREFIXO);
  await dialog.getByRole('button', { name: nomeCliente }).first().click();
  await fecharToasts(page);
  await dialog.getByRole('button', { name: 'Finalizar Cadastro' }).click();
  await esperarFechar(page, dialog);
  await expect(page.getByText(tituloProcesso).first()).toBeVisible({ timeout: 20_000 });
});

test('3. lança um prazo fatal', async ({ page }) => {
  await irPara(page, '/prazos');
  await page.getByRole('button', { name: 'Novo Prazo' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Ex: Contestação, Recurso, Manifestação...').fill(tituloPrazo);
  // Só o "Prazo Fatal" tem o <input type="date"> nativo marcado como obrigatório
  // (DATE_FIELDS em prazoForm.ts); a Data da Publicação e o Prazo Interno não.
  const fatal = dialog.locator('input[type="date"][required]').first();
  const data = emDias(10);
  await fatal.fill(data);
  await expect(fatal).toHaveValue(data);
  await fecharToasts(page);
  await dialog.getByRole('button', { name: 'Criar Prazo' }).click();
  await esperarFechar(page, dialog);
  await expect(page.getByText(tituloPrazo).first()).toBeVisible({ timeout: 20_000 });
});
