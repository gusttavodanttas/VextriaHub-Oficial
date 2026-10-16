// Quinta jornada com a conta de teste: ciclo de exclusão e restauração pela
// Lixeira, e as telas de leitura (Dashboard, Gráficos, Publicações, Notificações)
// abrindo com dados reais e sem nenhuma resposta de erro da API.
import { test, expect } from '@playwright/test';
import { PREFIXO, exigirCredenciais } from './_env';
import { limparRastros } from './limpeza';
import { registrarErrosApi, errosApi, irPara, cadastrarCliente } from './acoes';

const P = `${PREFIXO} J5`;
const nomeCliente = `${P} Cliente`;

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => { exigirCredenciais(); });
test.beforeEach(({ page }) => { registrarErrosApi(page); });
test.afterAll(async () => { await limparRastros(P); });

test('1. exclui um cliente e o restaura pela Lixeira', async ({ page }) => {
  await cadastrarCliente(page, nomeCliente);
  // Filtra pelo nome único desta execução: sobra um card, e o botão de excluir é o dele.
  const busca = page.getByPlaceholder('Buscar por nome, e-mail, telefone ou documento...');
  await busca.fill(nomeCliente);
  const excluir = page.getByRole('button', { name: 'Excluir cliente' });
  await expect(excluir).toHaveCount(1, { timeout: 20_000 });
  await excluir.click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click();
  // Admin do escritório exclui direto (soft-delete) — some da lista na hora.
  await expect(page.getByText(nomeCliente)).toHaveCount(0, { timeout: 20_000 });

  await irPara(page, '/lixeira');
  await page.getByPlaceholder('Buscar na lixeira...').fill(nomeCliente);
  await expect(page.getByText(nomeCliente).first()).toBeVisible({ timeout: 20_000 });
  const restaurar = page.getByRole('button', { name: 'Restaurar' });
  await expect(restaurar).toHaveCount(1);
  await restaurar.click();
  await expect(page.getByText(nomeCliente)).toHaveCount(0, { timeout: 20_000 });

  await irPara(page, '/clientes');
  await page.getByPlaceholder('Buscar por nome, e-mail, telefone ou documento...').fill(nomeCliente);
  await expect(page.getByText(nomeCliente).first()).toBeVisible({ timeout: 20_000 });
  expect(errosApi, 'respostas de erro da API durante o ciclo').toEqual([]);
});

test('2. dashboard abre com os indicadores do escritório', async ({ page }) => {
  await irPara(page, '/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Bom dia|Boa tarde|Boa noite/, { timeout: 20_000 });
  for (const kpi of ['Prazos urgentes', 'Audiências', 'Processos ativos', 'Tarefas abertas', 'Clientes ativos']) {
    await expect(page.getByText(kpi, { exact: true }).first()).toBeVisible();
  }
  expect(errosApi, 'respostas de erro da API no dashboard').toEqual([]);
});

test('3. gráficos carregam o chunk de charts e renderizam os cartões', async ({ page }) => {
  await irPara(page, '/graficos');
  await expect(page.getByRole('heading', { level: 1, name: 'Gráficos' })).toBeVisible();
  await expect(page.getByText('Processos por mês')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Status dos processos')).toBeVisible();
  await page.getByRole('tab', { name: 'Prazos' }).click();
  await expect(page.getByText('Prazos por mês')).toBeVisible({ timeout: 20_000 });
  expect(errosApi, 'respostas de erro da API nos gráficos').toEqual([]);
});

test('4. publicações: resumo, filtro por termo e estado vazio', async ({ page }) => {
  await irPara(page, '/publicacoes');
  for (const card of ['Urgentes', 'Novas', 'Tratadas']) {
    await expect(page.getByText(card, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  }
  // Termo único desta execução: a busca roda no servidor e cai no estado vazio.
  await page.getByPlaceholder('Busca rápida por termo ou resumo...').fill(P);
  await expect(page.getByText(/Nenhum registro encontrado/)).toBeVisible({ timeout: 20_000 });
  expect(errosApi, 'respostas de erro da API nas publicações').toEqual([]);
});

test('5. notificações abrem com a lista ou o estado vazio', async ({ page }) => {
  // Diagnóstico em falha: o que a página mostrou, onde parou e o que o console acusou.
  const errosConsole: string[] = [];
  page.on('pageerror', (e) => errosConsole.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errosConsole.push(`console: ${m.text().slice(0, 300)}`); });
  await irPara(page, '/notificacoes');
  const titulo = page.getByRole('heading', { level: 1 });
  await titulo.first().waitFor({ timeout: 20_000 }).catch(async () => {
    const texto = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 800));
    throw new Error(`Sem <h1> em ${page.url()}.\n  texto: ${texto}\n  console: ${JSON.stringify(errosConsole)}\n  erros da API: ${JSON.stringify(errosApi)}`);
  });
  await expect(titulo).toContainText(/Notifica/);
  await expect(
    page.getByText(/Nenhuma notificação no momento/).or(page.getByTitle('Marcar como lida').first()).or(page.getByRole('button', { name: 'Marcar todas como lidas' })),
  ).toBeVisible({ timeout: 20_000 });
  expect(errosApi, 'respostas de erro da API nas notificações').toEqual([]);
});
