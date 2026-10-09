// Testes E2E (Playwright) — ver "Testes E2E" no README.
//
// Dois projetos:
//  - smoke:       páginas públicas, sem credenciais nem backend (roda em qualquer lugar).
//  - conta-teste: jornada autenticada com a conta de teste (E2E_TEST_EMAIL/PASSWORD);
//                 pulada automaticamente quando as credenciais não existem.
//
// Alvo: E2E_BASE_URL (ex.: produção) ou, por padrão, um `vite preview` do build local
// em http://127.0.0.1:4173 — o build precisa de VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const temCredenciais = !!(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    // Sandbox/CI com Chromium já instalado fora do cache do Playwright.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: 'smoke', testMatch: /smoke\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'conta-teste',
      testMatch: /jornada\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: temCredenciais ? 'e2e/.auth/conta-teste.json' : undefined },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
        url: 'http://127.0.0.1:4173/login',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
