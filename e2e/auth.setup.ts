// Faz login UMA vez com a conta de teste e guarda a sessão para os specs autenticados.
import { test as setup, expect } from '@playwright/test';
import { CRED, exigirCredenciais } from './_env';

setup('login com a conta de teste', async ({ page }) => {
  exigirCredenciais();
  await page.goto('/login');
  await page.getByLabel('Email', { exact: false }).or(page.locator('#email')).first().fill(CRED.email);
  await page.locator('#password').fill(CRED.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  // Sai do /login para a área interna (o destino depende do papel: /home, /dashboard…)
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  await expect(page.getByText(/E-mail ou senha incorretos/)).toHaveCount(0);
  await page.context().storageState({ path: 'e2e/.auth/conta-teste.json' });
});
