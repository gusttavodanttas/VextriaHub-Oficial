// Realtime: o websocket precisa passar no gateway (101) com a chave do build.
// Regressão do 09/10/2026: o secret da anon key tinha um "\n" no fim; REST/Auth
// (header) passavam, mas no query param do websocket virava "%0A" e todo
// navegador recebia 401 UNAUTHORIZED_INVALID_API_KEY — sem notificação em tempo
// real para ninguém. Em falha, a mensagem descreve o formato da chave enviada
// (tamanho, espaço no fim, igualdade com a env), nunca o valor.
import { test, expect } from '@playwright/test';
import { exigirCredenciais } from './_env';
import { irPara } from './acoes';

function descreverChave(rotulo: string, valor: string) {
  const terminaEmBranco = /\s$/.test(valor);
  return `${rotulo}: tamanho=${valor.length} semEspacos=${valor.trim().length} terminaEmBranco=${terminaEmBranco}` +
    (terminaEmBranco ? ` (código ${valor.charCodeAt(valor.length - 1)})` : '');
}

test('websocket do Realtime conecta com a chave do build', async ({ page }) => {
  exigirCredenciais();
  const chaveEnv = process.env.VITE_SUPABASE_ANON_KEY ?? '';
  const eventos: string[] = [descreverChave('VITE_SUPABASE_ANON_KEY no CI', chaveEnv)];
  let abriuSocket = false;
  let erroSocket = '';
  let recebeuFrame = false;

  page.on('websocket', (ws) => {
    const u = new URL(ws.url());
    if (!u.pathname.includes('/realtime/')) return;
    abriuSocket = true;
    const chave = u.searchParams.get('apikey') ?? '';
    eventos.push(`abriu ${u.pathname}${u.search.replace(/apikey=[^&]*/, 'apikey=…')}`);
    eventos.push(descreverChave('apikey do websocket', chave));
    eventos.push(`apikey igual à env: ${chave === chaveEnv}; igual à env sem espaços: ${chave === chaveEnv.trim()}`);
    ws.on('socketerror', (e) => { erroSocket = String(e); eventos.push(`socketerror: ${erroSocket}`); });
    ws.on('close', () => eventos.push('close'));
    ws.on('framereceived', (f) => { recebeuFrame = true; eventos.push(`frame recebido: ${String(f.payload).slice(0, 120)}`); });
  });

  // O sino do cabeçalho (NotificationCenter) assina o canal em qualquer rota interna.
  await irPara(page, '/clientes');
  await expect.poll(() => recebeuFrame || !!erroSocket, { timeout: 15_000, message: 'websocket sem resposta' }).toBe(true);

  const diagnostico = eventos.join('\n');
  expect(abriuSocket, 'o app não abriu websocket do Realtime').toBe(true);
  expect(erroSocket, `websocket com erro:\n${diagnostico}`).toBe('');
  expect(recebeuFrame, `websocket sem resposta do servidor:\n${diagnostico}`).toBe(true);
});
