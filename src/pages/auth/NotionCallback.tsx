import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Página de retorno do OAuth do Notion. O Notion redireciona pra cá com ?code&state;
// repassamos pra edge notion-oauth-callback (que valida o state, guarda o token e
// acha/cria as bases Processos e Clientes) e voltamos pra Configurações → Integração.
export default function NotionCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "erro">("loading");
  const [msg, setMsg] = useState("Conectando o Notion do escritório…");
  const ran = useRef(false); // evita rodar 2x no StrictMode

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const notionError = params.get("error");

    if (notionError || !code || !state) {
      setStatus("erro");
      setMsg(notionError === "access_denied" ? "Você cancelou a conexão com o Notion." : "Não recebemos a autorização do Notion. Tente novamente.");
      return;
    }

    (async () => {
      const { data, error } = await supabase.functions.invoke("notion-oauth-callback", {
        body: { code, state },
      });
      if (error || (data && data.error)) {
        setStatus("erro");
        setMsg(
          data?.error === "sem-bases"
            ? data?.detail || "Nenhuma página foi compartilhada com o VextriaHub. Reconecte e marque uma página do seu Notion."
            : data?.error === "plano-sem-notion"
            ? "O plano do seu escritório não inclui a integração com o Notion."
            : "Não foi possível concluir a conexão. Tente novamente em Configurações → Integração.",
        );
        return;
      }
      setStatus("ok");
      setMsg("Notion conectado! Os processos e clientes do escritório começam a aparecer nas bases Processos e Clientes em alguns minutos.");
      setTimeout(() => navigate("/configuracoes", { replace: true }), 1800);
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center glass-card rounded-[2rem] border border-black/5 dark:border-border shadow-premium p-8">
        {status === "loading" && <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />}
        {status === "ok" && <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />}
        {status === "erro" && <XCircle className="h-12 w-12 text-destructive mx-auto" />}
        <h1 className="text-lg font-black mt-4">
          {status === "loading" ? "Conectando…" : status === "ok" ? "Tudo certo!" : "Não deu certo"}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">{msg}</p>
        {status === "erro" && (
          <Button className="rounded-xl font-bold mt-5" onClick={() => navigate("/configuracoes", { replace: true })}>
            Voltar para Configurações
          </Button>
        )}
      </div>
    </div>
  );
}
