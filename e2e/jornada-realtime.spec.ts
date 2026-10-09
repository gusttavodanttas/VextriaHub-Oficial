// Realtime: o websocket precisa passar no gateway (101) com a chave do build.
// Em 09/10/2026 todo navegador recebia 401 UNAUTHORIZED_INVALID_API_KEY nesse
// handshake enquanto REST/Auth com a mesma chave passavam; este spec registra o
// que o app realmente manda (sem imprimir a chave) e falha se a conexão não abrir.
import { test, expect } from '@playwright/test';
import { exigirCredenciais } from './_env';
import { irPara } from './acoes';

function descreverChave(rotulo: string, valor: string) {
  const ultimo = valor.charCodeAt(valor.length - 1);
  const terminaEmBranco = /\s$/.test(valor);
  return `${rotulo}: tamanho=${valor.length} semEspacos=${valor.trim().length} ` +
    `terminaEmBranco=${terminaEmBranco}${terminaEmBranco ? ` (código ${ultimo})` : ''} ` +
    `prefixo=${valor.trim().slice(0, 14)}…`;
}

test('websocket do Realtime conecta com a chave do build', async ({ page }) => {
  exigirCredenciais();
  const chaveEnv = process.env.VITE_SUPABASE_ANON_KEY ?? '';
  const eventos: string[] = [];
  let abriuSocket = false;
  let erroSocket = '';
  let recebeuFrame = false;

  page.on('websocket', (ws) => {
    const bruta = ws.url();
    const u = new URL(bruta);
    if (!u.pathname.includes('/realtime/')) return;
    abriuSocket = true;
    const chave = u.searchParams.get('apikey') ?? '';
    eventos.push(`abriu ${u.pathname}${u.search.replace(/apikey=[^&]*/, 'apikey=…')}`);
    eventos.push(descreverChave('apikey do websocket', chave));
    eventos.push(`apikey igual à env: ${chave === chaveEnv}; igual à env sem espaços: ${chave === chaveEnv.trim()}`);
    eventos.push(`URL bruta contém %0A/%20/%09/+ antes de &vsn: ${/apikey=[^&]*(%0A|%0D|%20|%09|\+)/i.test(bruta)}`);
    ws.on('socketerror', (e) => { erroSocket = String(e); eventos.push(`socketerror: ${erroSocket}`); });
    ws.on('close', () => eventos.push('close'));
    ws.on('framereceived', (f) => { recebeuFrame = true; eventos.push(`frame recebido: ${String(f.payload).slice(0, 120)}`); });
  });

  // Resposta do handshake não aparece como `response`; buscamos a mesma URL por fetch
  // para ler o corpo/erro que o gateway devolve ao navegador.
  await irPara(page, '/notificacoes');
  await page.waitForTimeout(6_000);

  eventos.unshift(descreverChave('VITE_SUPABASE_ANON_KEY no CI', chaveEnv));
  const url = process.env.VITE_SUPABASE_URL ?? '';
  if (url && chaveEnv) {
    const resposta = await page.evaluate(async ({ url, chave }) => {
      const r = await fetch(`${url}/realtime/v1/websocket?apikey=${encodeURIComponent(chave)}&vsn=2.0.0`);
      return `${r.status} sb-error-code=${r.headers.get('sb-error-code')} ${(await r.text()).slice(0, 200)}`;
    }, { url, chave: chaveEnv }).catch((e) => `fetch falhou: ${e}`);
    eventos.push(`fetch do handshake com a chave do CI (crua): ${resposta}`);
    const respostaTrim = await page.evaluate(async ({ url, chave }) => {
      const r = await fetch(`${url}/realtime/v1/websocket?apikey=${encodeURIComponent(chave)}&vsn=2.0.0`);
      return `${r.status} sb-error-code=${r.headers.get('sb-error-code')} ${(await r.text()).slice(0, 200)}`;
    }, { url, chave: chaveEnv.trim() }).catch((e) => `fetch falhou: ${e}`);
    eventos.push(`fetch do handshake com a chave do CI (trim): ${respostaTrim}`);
  }

  console.log(['[realtime]', ...eventos].join('\n'));
  expect(abriuSocket, 'o app não abriu websocket do Realtime').toBe(true);
  expect(erroSocket, `websocket com erro:\n${eventos.join('\n')}`).toBe('');
  expect(recebeuFrame, `websocket sem resposta do servidor:\n${eventos.join('\n')}`).toBe(true);
});
