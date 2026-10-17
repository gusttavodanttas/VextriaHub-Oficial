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

  // Ordem respeita as FKs: dependentes antes de processos → clientes.
  // `contem`: casa o prefixo em qualquer posição (busca da jurisprudência começa pelo termo).
  // `semSoftDelete`: tabela sem coluna `deletado` — não tenta o fallback.
  const alvos: Array<{ tabela: string; coluna: string; contem?: boolean; semSoftDelete?: boolean }> = [
    { tabela: 'juris_user_searches', coluna: 'query', contem: true, semSoftDelete: true },
    { tabela: 'office_teams', coluna: 'name', semSoftDelete: true },
    { tabela: 'metas', coluna: 'titulo' },
    { tabela: 'timesheets', coluna: 'tarefa_descricao' },
    { tabela: 'financeiro', coluna: 'descricao' },
    { tabela: 'consultivos', coluna: 'titulo' },
    { tabela: 'atendimentos', coluna: 'observacoes' },
    { tabela: 'tarefas', coluna: 'titulo' },
    { tabela: 'audiencias', coluna: 'titulo' },
    { tabela: 'prazos', coluna: 'titulo' },
    { tabela: 'processos', coluna: 'titulo' },
    { tabela: 'clientes', coluna: 'nome' },
  ];
  for (const { tabela, coluna, contem, semSoftDelete } of alvos) {
    const padrao = contem ? `%${prefixo}%` : `${prefixo}%`;
    const { data: apagados, error } = await sb.from(tabela).delete().like(coluna, padrao).select('id');
    if (error || !apagados?.length) {
      if (semSoftDelete) { if (error) console.warn(`[e2e/limpeza] ${tabela}: delete falhou (${error.message})`); continue; }
      const { data: marcados } = await sb.from(tabela).update({ deletado: true }).like(coluna, padrao).select('id');
      console.warn(`[e2e/limpeza] ${tabela}: delete ${error ? `falhou (${error.message})` : 'não casou'}; soft-delete em ${marcados?.length ?? 0} linha(s)`);
    } else {
      console.log(`[e2e/limpeza] ${tabela}: ${apagados.length} linha(s) apagada(s)`);
    }
  }
  // 'local': só esta sessão da limpeza. O padrão ('global') revoga TODAS as sessões do
  // usuário — inclusive a do navegador do Playwright, criada no auth.setup. O JWT
  // continuava valendo no REST, mas qualquer chamada a /auth/v1/user (o Perfil faz uma)
  // respondia 403 session_not_found, o supabase-js descartava a sessão e a tela caía
  // em /login (achado da jornada 6).
  await sb.auth.signOut({ scope: 'local' });
}
