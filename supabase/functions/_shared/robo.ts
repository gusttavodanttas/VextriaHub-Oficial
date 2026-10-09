// Client de serviço e retry para as edge functions chamadas pelos robôs (pg_cron).
//
// Por que não usar só SUPABASE_SERVICE_ROLE_KEY: no projeto novo a plataforma injeta
// nessa variável a chave de formato novo (`sb_secret_…`). O gateway troca essa chave
// por um JWT curto antes de repassar ao PostgREST, e esse JWT chega vencido de vez
// em quando — resposta 401 com `PGRST303` (JWT expirado). Em 24 h de 09/10/2026 foram
// 16 de 95 chamadas do google-sync e 2 do notion-sync, todas "200" para o cron, que
// só vê a resposta da function. O cron já manda no `Authorization` o service_role
// legado (JWT do vault, sem troca no gateway); para o caminho do robô usamos essa
// chave e, por garantia, repetimos uma vez quando o PostgREST reclama do JWT.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Só depois de conferir o x-robot-secret: o Bearer vem do cron e é tratado como service_role. */
export function serviceClientDoRobo(req: Request): SupabaseClient {
  const authz = req.headers.get("Authorization") || "";
  const bearer = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  const key = bearer.startsWith("eyJ") ? bearer : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(Deno.env.get("SUPABASE_URL")!, key, { auth: { persistSession: false } });
}

type Resultado<T> = { data: T | null; error: { code?: string; message?: string } | null };

const ERRO_DE_JWT = /PGRST30[13]|jwt|invalid api key/i;

/**
 * Executa a consulta e repete uma vez (após 400 ms) se o erro for de JWT/chave.
 * Qualquer outro erro, ou o segundo erro de JWT, é devolvido ao chamador — que deve
 * responder não-200 para o `robo-alertas-horario` enxergar a falha.
 */
export async function comRetryDeJwt<T>(consulta: () => PromiseLike<Resultado<T>>): Promise<Resultado<T>> {
  const primeira = await consulta();
  const e = primeira.error;
  if (!e || !ERRO_DE_JWT.test(`${e.code ?? ""} ${e.message ?? ""}`)) return primeira;
  await new Promise((r) => setTimeout(r, 400));
  return await consulta();
}
