// Páginas públicas — sem credenciais nem backend.
import { test, expect } from '@playwright/test';

test('tela de login renderiza com e-mail, senha e botão Entrar', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(page.locator('#password')).toHaveAttribute('type', 'text');
});

test('rota interna sem sessão volta para o login', async ({ page }) => {
  await page.goto('/clientes');
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
});

test('raiz redireciona (não fica em branco)', async ({ page }) => {
  await page.goto('/');
  await expect(page).not.toHaveURL(/^http:\/\/[^/]+\/$/, { timeout: 20_000 });
});
