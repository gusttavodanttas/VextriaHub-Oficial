// Ações e esperas compartilhadas pelas jornadas autenticadas.
import { expect, type Page, type Locator } from '@playwright/test';
import { cpfValido } from './_env';

/** Respostas de erro da API (REST/Auth) durante o teste — vão pra mensagem de falha. */
export const errosApi: string[] = [];
export function registrarErrosApi(page: Page) {
  errosApi.length = 0;
  page.on('response', async (r) => {
    if (r.status() < 400 || !/\/(rest|auth)\/v1\//.test(r.url())) return;
    const corpo = await r.text().catch(() => '');
    errosApi.push(`${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')} → ${r.status()} ${corpo.slice(0, 300)}`);
  });
}

/**
 * Navega e espera o app saber o escritório do usuário: logo após o load o
 * AuthContext entrega `user` sem `office_id` até o perfil chegar em background, e
 * um cadastro disparado nesse instante vai sem escritório (RLS → 403).
 * O sinal é a consulta de `user_permissions` filtrada por office_id: ela vem de
 * useMyPermissionOverrides, que só dispara com `user.office_id` preenchido (as de
 * office_subscriptions/offices saem ANTES, do próprio carregamento do perfil).
 */
export async function irPara(page: Page, url: string) {
  const escritorioPronto = page.waitForResponse(
    (r) => r.url().includes('/rest/v1/user_permissions?') && r.url().includes('office_id=eq.') && r.status() < 400,
    { timeout: 30_000 },
  );
  await page.goto(url);
  await escritorioPronto;
}

/**
 * Espera o diálogo fechar. Se ele continuar aberto, levanta um erro dizendo POR QUÊ:
 * toasts que apareceram nesse meio-tempo (somem sozinhos, por isso são colhidos a
 * cada volta), respostas de erro da API e campos que a validação nativa do navegador
 * considera inválidos (ela bloqueia o submit em silêncio).
 */
export async function esperarFechar(page: Page, dialog: Locator, timeout = 30_000) {
  const inicio = Date.now();
  const toasts = new Set<string>();
  const colherToasts = async () => {
    const textos = await page.locator('[role="status"]').allInnerTexts().catch(() => [] as string[]);
    for (const t of textos) if (t.trim()) toasts.add(t.trim().replace(/\s+/g, ' '));
  };
  while (Date.now() - inicio < timeout) {
    await colherToasts();
    if (!(await dialog.isVisible().catch(() => false))) return;
    await page.waitForTimeout(500);
  }
  const invalidos = await page.evaluate(() => {
    const form = document.querySelector('[role="dialog"] form') as HTMLFormElement | null;
    if (!form) return ['(sem <form>)'];
    return Array.from(form.querySelectorAll<HTMLInputElement>('input, select, textarea'))
      .filter((el) => !el.checkValidity())
      .map((el) => `${el.tagName.toLowerCase()}[type=${el.type} placeholder=${el.placeholder || '-'}] → ${el.validationMessage}`);
  });
  throw new Error(`Diálogo continuou aberto.\n  toasts: ${JSON.stringify([...toasts])}\n  erros da API: ${JSON.stringify(errosApi)}\n  inválidos: ${JSON.stringify(invalidos)}`);
}

/** Toasts do shadcn ficam por cima de botões em telas baixas — fecha o que estiver aberto. */
export async function fecharToasts(page: Page) {
  for (const b of await page.locator('[role="status"] button').all()) {
    await b.click({ timeout: 1000 }).catch(() => undefined);
  }
}

/** Abre um Select do Radix (gatilho identificado pelo texto atual) e escolhe a opção. */
export async function escolherOpcao(page: Page, gatilho: Locator, opcao: string | RegExp) {
  await gatilho.click();
  await page.getByRole('option', { name: opcao }).first().click();
}

/** Cadastra um cliente pessoa física pela tela /clientes e espera ele aparecer na lista. */
export async function cadastrarCliente(page: Page, nome: string) {
  await irPara(page, '/clientes');
  await page.getByRole('button', { name: 'Novo Cliente' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Nome do cliente').fill(nome);
  await dialog.getByPlaceholder('000.000.000-00').fill(cpfValido());
  await dialog.getByPlaceholder('email@exemplo.com').fill(`e2e+${Date.now()}@vextriahub.test`);
  await dialog.getByRole('button', { name: 'Cadastrar Cliente' }).click();
  await esperarFechar(page, dialog, 20_000);
  await expect(page.getByText(nome).first()).toBeVisible({ timeout: 20_000 });
}
