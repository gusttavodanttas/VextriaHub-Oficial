// Terceira jornada com a conta de teste: lançamento financeiro, consultivo e registro
// manual de horas (timesheet). Mesma limpeza por prefixo no fim.
import { test, expect } from '@playwright/test';
import { PREFIXO, emDias, exigirCredenciais } from './_env';
import { limparRastros } from './limpeza';
import { registrarErrosApi, irPara, esperarFechar, fecharToasts } from './acoes';

const P = `${PREFIXO} J3`;
const descReceita = `${P} Honorários`;
const tituloConsultivo = `${P} Consultivo`;
const descTimesheet = `${P} Horas`;

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => { exigirCredenciais(); });
test.beforeEach(({ page }) => { registrarErrosApi(page); });
test.afterAll(async () => { await limparRastros(P); });

test('1. registra uma receita no financeiro', async ({ page }) => {
  await irPara(page, '/financeiro');
  await page.getByRole('button', { name: 'Nova Receita' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Ex: Honorários advocatícios').fill(descReceita);
  await dialog.getByPlaceholder('0,00').first().fill('1500');
  await dialog.locator('input[type="date"]').first().fill(emDias(10));
  await fecharToasts(page);
  await dialog.getByRole('button', { name: 'Registrar receita' }).click();
  await esperarFechar(page, dialog);
  // A lista é filtrada pelo mês do vencimento; busca pela descrição independe do mês.
  await page.getByPlaceholder('Buscar por descrição ou cliente...').fill(P);
  await expect(page.getByText(descReceita).first()).toBeVisible({ timeout: 20_000 });
});

test('2. abre um consultivo com categoria e prazo', async ({ page }) => {
  await irPara(page, '/consultivo');
  await page.getByRole('button', { name: 'Novo Consultivo' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Ex: Análise de Contrato de Prestação de Serviços').fill(tituloConsultivo);
  await dialog.locator('input[type="date"]').first().fill(emDias(15));
  // Categoria é uma grade de botões (as do escritório ou, sem nenhuma, as padrão): escolhe a primeira.
  await dialog.locator('button[type="button"]:has(span.line-clamp-1)').first().click();
  await dialog.getByPlaceholder('Descreva os detalhes da consulta jurídica...').fill(`${P} descrição`);
  await fecharToasts(page);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await esperarFechar(page, dialog);
  await expect(page.getByText(tituloConsultivo).first()).toBeVisible({ timeout: 20_000 });
});

test('3. lança horas manualmente no timesheet', async ({ page }) => {
  await irPara(page, '/timesheet');
  await page.getByRole('button', { name: 'Manual' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Descrição da atividade').fill(descTimesheet);
  // Categoria é uma grade de botões; "Reunião" existe sempre (TIMESHEET_CATEGORIAS).
  await dialog.getByRole('button', { name: 'Reunião' }).click();
  await dialog.locator('input[type="date"]').first().fill(emDias(0));
  const horas = dialog.locator('input[type="time"]');
  await horas.nth(0).fill('09:00');
  await horas.nth(1).fill('10:30');
  await fecharToasts(page);
  await dialog.getByRole('button', { name: 'Lançar' }).click();
  await esperarFechar(page, dialog);
  await expect(page.getByText(descTimesheet).first()).toBeVisible({ timeout: 20_000 });
});
