import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Página de retorno do OAuth do Google. O Google redireciona pra cá com ?code&state;
// repassamos pra edge google-oauth-callback (que valida o state e guarda os tokens)
// e voltamos pra Configurações → Integração.
export default function GoogleCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "erro">("loading");
  const [msg, setMsg] = useState("Conectando sua agenda do Google…");
  const ran = useRef(false); // evita rodar 2x no StrictMode

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const googleError = params.get("error");

    if (googleError || !code || !state) {
      setStatus("erro");
      setMsg(googleError === "access_denied" ? "Você cancelou a conexão com o Google." : "Não recebemos a autorização do Google. Tente novamente.");
      return;
    }

    (async () => {
      const { data, error } = await supabase.functions.invoke("google-oauth-callback", {
        body: { code, state, redirectUri: `${window.location.origin}/auth/google/callback` },
      });
      if (error || (data && data.error)) {
        setStatus("erro");
        setMsg("Não foi possível concluir a conexão. Tente novamente em Configurações → Integração.");
        return;
      }
      setStatus("ok");
      setMsg("Agenda conectada! Seus prazos e audiências vão aparecer no Google Calendar.");
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
