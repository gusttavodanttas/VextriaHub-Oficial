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

// Respostas de erro da API (REST/Auth) durante o teste — vão pra mensagem de falha.
const errosApi: string[] = [];
test.beforeEach(({ page }) => {
  errosApi.length = 0;
  page.on('response', async (r) => {
    if (r.status() < 400 || !/\/(rest|auth)\/v1\//.test(r.url())) return;
    const corpo = await r.text().catch(() => '');
    errosApi.push(`${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')} → ${r.status()} ${corpo.slice(0, 300)}`);
  });
});

/**
 * Espera o diálogo fechar. Se ele continuar aberto, levanta um erro dizendo POR QUÊ:
 * toasts que apareceram nesse meio-tempo (somem sozinhos, por isso são colhidos a
 * cada volta), respostas de erro da API e campos que a validação nativa do navegador
 * considera inválidos (ela bloqueia o submit em silêncio).
 */
async function esperarFechar(page: Page, dialog: ReturnType<Page['getByRole']>, timeout = 30_000) {
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
  await esperarFechar(page, dialog, 20_000);
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
  await esperarFechar(page, dialog);
  await expect(page.getByText(tituloProcesso).first()).toBeVisible({ timeout: 20_000 });
});

test('3. lança um prazo fatal', async ({ page }) => {
  await page.goto('/prazos');
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
