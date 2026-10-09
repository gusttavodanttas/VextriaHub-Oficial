// Apaga o que a jornada criou, usando a própria sessão da conta de teste (anon key +
// e-mail/senha) — passa pela mesma RLS do app. Tenta apagar de verdade; se a policy
// só permitir soft-delete, marca `deletado` (a Lixeira do app mostra e o admin esvazia).
import { createClient } from '@supabase/supabase-js';
import { CRED, temCredenciais } from './_env';

export async function limparRastros(prefixo: string): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!temCredenciais() || !url || !anon) return;
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { error: loginErr } = await sb.auth.signInWithPassword({ email: CRED.email, password: CRED.password });
  if (loginErr) { console.warn('[e2e/limpeza] login falhou:', loginErr.message); return; }

  // Ordem respeita as FKs: prazos → processos → clientes.
  const alvos: Array<{ tabela: string; coluna: string }> = [
    { tabela: 'prazos', coluna: 'titulo' },
    { tabela: 'processos', coluna: 'titulo' },
    { tabela: 'clientes', coluna: 'nome' },
  ];
  for (const { tabela, coluna } of alvos) {
    const { data: apagados, error } = await sb.from(tabela).delete().like(coluna, `${prefixo}%`).select('id');
    if (error || !apagados?.length) {
      const { data: marcados } = await sb.from(tabela).update({ deletado: true }).like(coluna, `${prefixo}%`).select('id');
      console.warn(`[e2e/limpeza] ${tabela}: delete ${error ? `falhou (${error.message})` : 'não casou'}; soft-delete em ${marcados?.length ?? 0} linha(s)`);
    } else {
      console.log(`[e2e/limpeza] ${tabela}: ${apagados.length} linha(s) apagada(s)`);
    }
  }
  await sb.auth.signOut();
}
