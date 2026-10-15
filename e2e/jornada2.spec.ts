// Segunda jornada com a conta de teste: audiência, tarefa e atendimento (este
// último exige cliente, então cadastra o seu). Mesma limpeza por prefixo no fim.
import { test, expect } from '@playwright/test';
import { PREFIXO, emDias, exigirCredenciais } from './_env';
import { limparRastros } from './limpeza';
import { registrarErrosApi, irPara, esperarFechar, fecharToasts, escolherOpcao, cadastrarCliente } from './acoes';

const P = `${PREFIXO} J2`;
const nomeCliente = `${P} Cliente`;
const tituloAudiencia = `${P} Audiência`;
const tituloTarefa = `${P} Tarefa`;
const obsAtendimento = `${P} Atendimento`;

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => { exigirCredenciais(); });
test.beforeEach(({ page }) => { registrarErrosApi(page); });
test.afterAll(async () => { await limparRastros(P); });

test('1. agenda uma audiência', async ({ page }) => {
  await irPara(page, '/audiencias');
  await page.getByRole('button', { name: 'Nova Audiência' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#titulo').fill(tituloAudiencia);
  await dialog.locator('#data').fill(emDias(7));
  await dialog.locator('#hora').fill('14:00');
  // Tipo: o gatilho ainda mostra o placeholder "Selecionar"; escolhe o primeiro tipo do escritório.
  await escolherOpcao(page, dialog.getByRole('combobox').filter({ hasText: /^Selecionar$/ }), /.+/);
  await fecharToasts(page);
  await dialog.getByRole('button', { name: 'Criar Audiência' }).click();
  await esperarFechar(page, dialog);
  await expect(page.getByText(tituloAudiencia).first()).toBeVisible({ timeout: 20_000 });
});

test('2. cria uma tarefa com vencimento', async ({ page }) => {
  await irPara(page, '/tarefas');
  await page.getByRole('button', { name: 'Nova Tarefa' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#titulo').fill(tituloTarefa);
  await dialog.locator('#data').fill(emDias(3));
  await fecharToasts(page);
  await dialog.getByRole('button', { name: 'Criar Tarefa' }).click();
  await esperarFechar(page, dialog);
  await expect(page.getByText(tituloTarefa).first()).toBeVisible({ timeout: 20_000 });
});

test('3. registra um atendimento vinculado a um cliente novo', async ({ page }) => {
  await cadastrarCliente(page, nomeCliente);
  await irPara(page, '/atendimentos');
  await page.getByRole('button', { name: 'Novo Atendimento' }).first().click();
  const dialog = page.getByRole('dialog');
  // "Tipo *" é uma grade de botões (TIPOS_FIXOS: Consulta, Reunião, …), não um Select.
  await dialog.getByRole('button', { name: 'Reunião' }).click();
  await dialog.locator('input[type="date"]').first().fill(emDias(1));
  await dialog.locator('input[type="time"]').first().fill('10:30');
  const cliente = dialog.getByPlaceholder('Selecionar cliente');
  await cliente.fill(P);
  await dialog.getByRole('button', { name: nomeCliente }).first().click();
  await dialog.getByPlaceholder('Detalhes do atendimento...').fill(obsAtendimento);
  await fecharToasts(page);
  await dialog.getByRole('button', { name: 'Registrar' }).click();
  await esperarFechar(page, dialog);
  await expect(page.getByText(obsAtendimento).first()).toBeVisible({ timeout: 20_000 });
});
