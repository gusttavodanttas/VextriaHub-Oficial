// Sexta jornada com a conta de teste: as telas de administração. Perfil e
// Escritório editam um campo e o devolvem ao valor original; Configurações
// alterna uma preferência e desfaz; Admin abre na visão do admin do escritório;
// Equipe (detalhe) cria uma equipe, adiciona um membro e abre a produtividade.
import { test, expect, type Page } from '@playwright/test';
import { PREFIXO, exigirCredenciais } from './_env';
import { limparRastros } from './limpeza';
import { registrarErrosApi, errosApi, irPara, esperarFechar, fecharToasts } from './acoes';

const P = `${PREFIXO} J6`;
const nomeEquipe = `${P} Equipe`;

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => { exigirCredenciais(); });
test.beforeEach(({ page }) => { registrarErrosApi(page); });
test.afterAll(async () => { await limparRastros(P); });

/** Espera o toast com o título dado aparecer (shadcn: role=status). */
async function esperarToast(page: Page, titulo: RegExp) {
  await expect(page.locator('[role="status"]').filter({ hasText: titulo }).first()).toBeVisible({ timeout: 20_000 });
}

test('1. perfil: edita o telefone, confere após recarregar e restaura', async ({ page }) => {
  await irPara(page, '/perfil');
  await expect(page.getByRole('heading', { level: 1, name: 'Meu Perfil' })).toBeVisible();
  await page.getByRole('button', { name: 'Editar Perfil' }).click();
  const telefone = page.getByPlaceholder('(11) 91234-5678');
  const original = await telefone.inputValue();
  const novo = original === '(11) 98888-7777' ? '(11) 97777-8888' : '(11) 98888-7777';
  await telefone.fill(novo);
  await fecharToasts(page);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await esperarToast(page, /Perfil atualizado/);

  await irPara(page, '/perfil');
  await expect(page.getByText(novo)).toBeVisible({ timeout: 20_000 });

  // Restaura o valor que estava (vazio inclusive) para a conta de teste não mudar entre execuções.
  await page.getByRole('button', { name: 'Editar Perfil' }).click();
  await page.getByPlaceholder('(11) 91234-5678').fill(original);
  await fecharToasts(page);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await esperarToast(page, /Perfil atualizado/);
  expect(errosApi, 'respostas de erro da API no perfil').toEqual([]);
});

test('2. escritório: edita o telefone, confere após recarregar e restaura', async ({ page }) => {
  await irPara(page, '/escritorio');
  await expect(page.getByRole('heading', { level: 1, name: 'Meu Escritório' })).toBeVisible();
  const salvar = page.getByRole('button', { name: 'Salvar Alterações' });
  // Salvar fica bloqueado até os dados atuais carregarem (não gravar defaults por cima).
  await expect(salvar).toBeEnabled({ timeout: 20_000 });
  const telefone = page.locator('#phone');
  const original = await telefone.inputValue();
  const novo = original === '(11) 97777-6666' ? '(11) 96666-7777' : '(11) 97777-6666';
  await telefone.fill(novo);
  await fecharToasts(page);
  await salvar.click();
  await esperarToast(page, /Escritório atualizado/);

  await irPara(page, '/escritorio');
  await expect(page.getByRole('button', { name: 'Salvar Alterações' })).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator('#phone')).toHaveValue(novo);

  await page.locator('#phone').fill(original);
  await fecharToasts(page);
  await page.getByRole('button', { name: 'Salvar Alterações' }).click();
  await esperarToast(page, /Escritório atualizado/);
  expect(errosApi, 'respostas de erro da API no escritório').toEqual([]);
});

test('3. configurações: alterna a preferência de notificação do financeiro e desfaz', async ({ page }) => {
  await irPara(page, '/configuracoes');
  await expect(page.getByRole('heading', { level: 1, name: 'Configurações' })).toBeVisible();
  await page.getByRole('button', { name: /Notificações/ }).first().click();
  // A linha da preferência é o ancestral mais próximo da descrição que contém um switch.
  const linha = page.getByText('Recebimentos e contas a pagar').locator('xpath=ancestor::div[.//button[@role="switch"]][1]');
  const chave = linha.getByRole('switch');
  await expect(chave).toBeEnabled({ timeout: 20_000 });
  const antes = (await chave.getAttribute('aria-checked')) === 'true';
  await chave.click();
  await expect(chave).toHaveAttribute('aria-checked', String(!antes));

  // Persistiu: recarrega e lê de novo.
  await irPara(page, '/configuracoes');
  await page.getByRole('button', { name: /Notificações/ }).first().click();
  const chave2 = page.getByText('Recebimentos e contas a pagar').locator('xpath=ancestor::div[.//button[@role="switch"]][1]').getByRole('switch');
  await expect(chave2).toBeEnabled({ timeout: 20_000 });
  await expect(chave2).toHaveAttribute('aria-checked', String(!antes));
  await chave2.click();
  await expect(chave2).toHaveAttribute('aria-checked', String(antes));
  expect(errosApi, 'respostas de erro da API nas configurações').toEqual([]);
});

test('4. admin abre na visão do administrador do escritório', async ({ page }) => {
  await irPara(page, '/admin');
  // A conta de teste é admin do escritório, não super admin: vê só as solicitações de exclusão.
  await expect(page.getByText('Solicitações de Exclusão').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Acesso Negado')).toHaveCount(0);
  expect(errosApi, 'respostas de erro da API no admin').toEqual([]);
});

test('5. equipe: cria, adiciona um membro pelo detalhe e abre a produtividade', async ({ page }) => {
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

  // Detalhe: ainda sem membros; adiciona o primeiro disponível (a própria conta).
  await card.click();
  const detalhe = page.getByRole('dialog');
  await expect(detalhe.getByText('Nenhum membro ainda. Adicione abaixo.')).toBeVisible({ timeout: 20_000 });
  const candidato = detalhe.getByTitle('Adicionar como membro').first();
  await candidato.hover();
  await candidato.click();
  await esperarToast(page, /Adicionado à equipe/);
  await expect(detalhe.getByText(/Membros \(1\)/)).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('Escape');
  await esperarFechar(page, detalhe);

  // Produtividade da equipe (/equipe/:id) a partir do card.
  await card.hover();
  await card.getByTitle('Ver produtividade').click();
  await expect(page).toHaveURL(/\/equipe\/[0-9a-f-]+/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1, name: nomeEquipe })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Produtividade por Membro')).toBeVisible();
  expect(errosApi, 'respostas de erro da API na equipe').toEqual([]);
});
