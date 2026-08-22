import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Loader2, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Conn = "loading" | "off" | "on" | "revoked";

// Card da integração Google Agenda (Config → Integração). Conexão por usuário,
// mão única: prazos e audiências do escritório viram eventos num calendário
// "VextriaHub" separado na conta do advogado (escopo app.created).
export function GoogleCalendarCard() {
  const { toast } = useToast();
  const [conn, setConn] = useState<Conn>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    const { data, error } = await supabase.rpc("google_status");
    if (error) { setConn("off"); return; }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) { setConn("off"); setEmail(null); setLastSync(null); return; }
    setConn(row.status === "revoked" ? "revoked" : "on");
    setEmail(row.google_email ?? null);
    setLastSync(row.last_sync_at ?? null);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const connect = useCallback(async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("google-oauth-start", {
      body: { redirectUri: `${window.location.origin}/auth/google/callback` },
    });
    if (error || !data?.url) {
      setBusy(false);
      toast({ title: "Não foi possível iniciar a conexão", description: "Tente novamente em instantes.", variant: "destructive" });
      return;
    }
    window.location.href = data.url; // vai pro consentimento do Google
  }, [toast]);

  const syncNow = useCallback(async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("google-sync");
    setBusy(false);
    if (error || data?.error) {
      toast({ title: "Falha ao sincronizar", description: "Tente de novo em instantes.", variant: "destructive" });
      return;
    }
    const r = data?.results?.[0];
    if (r?.error) {
      toast({ title: "Sincronização com erro", description: "Reconecte a conta do Google.", variant: "destructive" });
    } else {
      const c = r?.created ?? 0, u = r?.updated ?? 0, d = r?.deleted ?? 0;
      toast({ title: "Agenda sincronizada", description: `${c} novo(s), ${u} atualizado(s), ${d} removido(s).` });
    }
    loadStatus();
  }, [toast, loadStatus]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("google-disconnect");
    setBusy(false);
    if (error) { toast({ title: "Falha ao desconectar", variant: "destructive" }); return; }
    toast({ title: "Google Agenda desconectada" });
    setConn("off"); setEmail(null); setLastSync(null);
  }, [toast]);

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01] hover:border-primary/20 transition-all">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 text-blue-500 bg-blue-500/10">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-sm">Google Calendar</h4>
            {conn === "on" && (
              <Badge className="rounded-full text-[9px] font-black uppercase tracking-wide gap-1 px-2 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">
                <Check className="h-2.5 w-2.5" /> Conectado
              </Badge>
            )}
            {conn === "revoked" && (
              <Badge variant="secondary" className="rounded-full text-[9px] font-black uppercase tracking-wide gap-1 px-2 text-amber-600">
                <AlertTriangle className="h-2.5 w-2.5" /> Reconectar
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
            {conn === "on" && email
              ? `Prazos e audiências sincronizando com ${email}.`
              : conn === "revoked"
              ? "O acesso ao Google expirou. Reconecte para voltar a sincronizar."
              : "Sincronize audiências e prazos com sua agenda do Google."}
          </p>
          {conn === "on" && (
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              {lastSync ? `Última sincronização: ${new Date(lastSync).toLocaleString("pt-BR")}` : "Ainda não sincronizado."}
            </p>
          )}
        </div>
      </div>

      {conn === "loading" && (
        <Button variant="outline" size="sm" disabled className="rounded-xl font-bold w-full">
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      )}

      {conn === "off" && (
        <Button size="sm" onClick={connect} disabled={busy} className="rounded-xl font-bold w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conectar"}
        </Button>
      )}

      {conn === "revoked" && (
        <Button size="sm" onClick={connect} disabled={busy} className="rounded-xl font-bold w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reconectar"}
        </Button>
      )}

      {conn === "on" && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={syncNow} disabled={busy} className="rounded-xl font-bold flex-1">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5" /> Sincronizar</>}
          </Button>
          <Button variant="ghost" size="sm" onClick={disconnect} disabled={busy} className="rounded-xl font-bold text-destructive hover:text-destructive">
            Desconectar
          </Button>
        </div>
      )}
    </div>
  );
}
