// Quarta jornada com a conta de teste: lead no CRM (com mudança de temperatura),
// meta, equipe (criada e excluída pela tela) e busca na jurisprudência. Mesma
// limpeza por prefixo no fim.
import { test, expect } from '@playwright/test';
import { PREFIXO, exigirCredenciais } from './_env';
import { limparRastros } from './limpeza';
import { registrarErrosApi, irPara, esperarFechar, fecharToasts, escolherOpcao } from './acoes';

const P = `${PREFIXO} J4`;
const nomeLead = `${P} Lead`;
const tituloMeta = `${P} Meta`;
const nomeEquipe = `${P} Equipe`;

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => { exigirCredenciais(); });
test.beforeEach(({ page }) => { registrarErrosApi(page); });
test.afterAll(async () => { await limparRastros(P); });

test('1. registra um lead no CRM e muda a temperatura para quente', async ({ page }) => {
  await irPara(page, '/crm');
  await page.getByRole('button', { name: 'Novo Lead' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Nome completo/).fill(nomeLead);
  await dialog.getByLabel(/WhatsApp \/ Telefone/).fill('11999990000');
  await fecharToasts(page);
  await dialog.getByRole('button', { name: 'Registrar Lead' }).click();
  await esperarFechar(page, dialog);
  const linha = page.getByText(nomeLead).first().locator('xpath=ancestor::div[contains(@class,"group")][1]');
  await expect(linha).toBeVisible({ timeout: 20_000 });
  // Temperatura: menu na própria linha (admin pode mudar); persiste e a linha re-renderiza.
  await linha.getByTitle('Mudar temperatura').click();
  await page.getByRole('menuitem', { name: 'Quente' }).click();
  await expect(linha.getByTitle('Mudar temperatura')).toHaveText(/quente/i, { timeout: 20_000 });
});

test('2. cria uma meta mensal de novos clientes', async ({ page }) => {
  await irPara(page, '/metas');
  await page.getByRole('button', { name: /Nova Meta|Criar Primeira Meta/ }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Ex: Meta de Receita Mensal').fill(tituloMeta);
  // Tipo e período são Selects do Radix (role combobox), nesta ordem no formulário.
  await escolherOpcao(page, dialog.getByRole('combobox').nth(0), 'Novos Clientes');
  await escolherOpcao(page, dialog.getByRole('combobox').nth(1), 'Mensal');
  await dialog.getByLabel(/Valor da Meta/).fill('20');
  await fecharToasts(page);
  await dialog.getByRole('button', { name: 'Criar Meta' }).click();
  await esperarFechar(page, dialog);
  await expect(page.getByText(tituloMeta).first()).toBeVisible({ timeout: 20_000 });
});

test('3. cria uma equipe e a exclui pela tela', async ({ page }) => {
  await irPara(page, '/equipe');
  await page.getByRole('tab', { name: /Equipes/ }).click();
  await page.getByRole('button', { name: /Nova Equipe|Criar primeira equipe/ }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Ex: Cível, Previdenciário…').fill(nomeEquipe);
  await fecharToasts(page);
  await dialog.getByRole('button', { name: 'Criar Equipe' }).click();
  await esperarFechar(page, dialog);
  const card = page.getByText(nomeEquipe).first().locator('xpath=ancestor::div[contains(@class,"group")][1]');
  await expect(card).toBeVisible({ timeout: 20_000 });
  // Exclusão confirmada pelo AlertDialog do card (os atalhos aparecem no hover).
  await card.hover();
  await card.getByTitle('Excluir equipe').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByText(nomeEquipe)).toHaveCount(0, { timeout: 20_000 });
});

test('4. busca na jurisprudência devolve resultados do acervo', async ({ page }) => {
  await irPara(page, '/jurisprudencia');
  // "OR" é sintaxe do websearch_to_tsquery: casa "contrato" no acervo e deixa o
  // carimbo da execução gravado no histórico de buscas (apagado pela limpeza).
  await page.getByPlaceholder(/aspas = frase exata/).fill(`contrato OR ${P}`);
  await page.getByRole('button', { name: 'Pesquisar' }).click();
  const contagem = page.getByText(/^\d+ resultado\(s\)/);
  await expect(contagem).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => parseInt((await contagem.innerText()) || '0', 10), { timeout: 30_000 }).toBeGreaterThan(0);
});
