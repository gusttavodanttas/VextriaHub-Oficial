import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { BookOpen, Loader2, RefreshCw, Check, AlertTriangle, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { captureError } from "@/lib/monitoring";
import { assertRowsAffected } from "@/lib/errors";

type NotionStatus = {
  office_id: string;
  permitido: boolean;
  ligado: boolean;
  status: string; // desconectado | conectado | erro
  workspace_name: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  pode_gerenciar: boolean;
  pendentes: number;
};

const ERROS: Record<string, string> = {
  "plano-sem-notion": "O plano do seu escritório não inclui a integração com o Notion.",
  "apenas-admin-do-escritorio": "Só o administrador do escritório pode alterar esta integração.",
  "notion-nao-configurado": "A integração com o Notion ainda não foi habilitada no VextriaHub. Fale com o suporte.",
};

// Card da integração Notion (Config → Integração). Conexão POR ESCRITÓRIO:
// processos e clientes vão e voltam entre o VextriaHub e as bases "Processos" e
// "Clientes" do Notion do escritório. Disponível conforme o plano (ou liberação
// do super admin); o admin do escritório conecta e liga/desliga.
export function NotionCard() {
  const { toast } = useToast();
  const [st, setSt] = useState<NotionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("notion_status");
    setLoading(false);
    if (error) { captureError(error, { context: "NotionCard.notion_status" }); setLoadError(true); return; }
    setLoadError(false);
    setSt((Array.isArray(data) ? data[0] : null) as NotionStatus | null);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const fail = useCallback((title: string, code?: string) => {
    toast({ title, description: (code && ERROS[code]) || "Tente novamente em instantes.", variant: "destructive" });
  }, [toast]);

  const connect = useCallback(async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("notion-oauth-start", {
      body: { redirectUri: `${window.location.origin}/auth/notion/callback` },
    });
    if (error || !data?.url) {
      if (error) captureError(error, { context: "NotionCard.connect" });
      setBusy(false);
      fail("Não foi possível iniciar a conexão", data?.error);
      return;
    }
    window.location.href = data.url; // vai pra tela de autorização do Notion
  }, [fail]);

  const toggle = useCallback(async (enabled: boolean) => {
    if (!st) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("office_integrations")
        .update({ enabled }).eq("office_id", st.office_id).eq("provider", "notion").select("id");
      assertRowsAffected(data, error, 1);
      toast({ title: enabled ? "Sincronização com o Notion ligada" : "Sincronização com o Notion desligada" });
      if (enabled) await supabase.rpc("notion_enqueue_all", { p_office: st.office_id });
    } catch (e) {
      captureError(e, { context: "NotionCard.toggle" });
      fail("Não foi possível alterar", st.permitido ? undefined : "plano-sem-notion");
    } finally {
      setBusy(false);
      loadStatus();
    }
  }, [st, toast, fail, loadStatus]);

  const syncNow = useCallback(async (full = false) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("notion-sync", { body: { full } });
    setBusy(false);
    if (error || data?.error) {
      captureError(error ?? data?.error, { context: "NotionCard.sync" });
      fail("Falha ao sincronizar", data?.error);
      loadStatus();
      return;
    }
    const r = st ? data?.results?.[st.office_id] : null;
    if (r?.erro) {
      toast({ title: "Sincronização com erro", description: String(r.erro), variant: "destructive" });
    } else if (r) {
      toast({
        title: "Notion sincronizado",
        description: `${r.enviados ?? 0} enviado(s), ${r.recebidos ?? 0} atualizado(s) a partir do Notion, ${r.criados_no_vextria ?? 0} novo(s) no VextriaHub.`,
      });
    }
    loadStatus();
  }, [st, toast, fail, loadStatus]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("notion-disconnect");
    setBusy(false);
    if (error || data?.error) {
      captureError(error ?? data?.error, { context: "NotionCard.disconnect" });
      fail("Falha ao desconectar", data?.error);
      return;
    }
    toast({ title: "Notion desconectado", description: "As páginas que já estão no Notion foram mantidas." });
    loadStatus();
  }, [toast, fail, loadStatus]);

  const connected = st?.status === "conectado";
  const hasError = st?.status === "erro";
  const blocked = !!st && !st.permitido;
  const canManage = !!st?.pode_gerenciar;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01] hover:border-primary/20 transition-all">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 text-foreground bg-foreground/10">
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-sm">Notion</h4>
            {blocked && (
              <Badge variant="secondary" className="rounded-full text-[9px] font-black uppercase tracking-wide gap-1 px-2">
                <Lock className="h-2.5 w-2.5" /> Premium
              </Badge>
            )}
            {!blocked && connected && st?.ligado && (
              <Badge className="rounded-full text-[9px] font-black uppercase tracking-wide gap-1 px-2 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">
                <Check className="h-2.5 w-2.5" /> Ligado
              </Badge>
            )}
            {!blocked && connected && !st?.ligado && (
              <Badge variant="secondary" className="rounded-full text-[9px] font-black uppercase tracking-wide px-2">Desligado</Badge>
            )}
            {!blocked && hasError && (
              <Badge variant="secondary" className="rounded-full text-[9px] font-black uppercase tracking-wide gap-1 px-2 text-amber-600">
                <AlertTriangle className="h-2.5 w-2.5" /> Atenção
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
            {loadError
              ? "Não foi possível verificar o status da integração agora."
              : blocked
              ? "Disponível nos planos com Notion. Fale com o suporte para liberar no seu escritório."
              : connected
              ? `Processos e clientes sincronizando com o workspace ${st?.workspace_name || "do Notion"}.`
              : hasError
              ? st?.last_error || "A conexão com o Notion precisa de atenção. Reconecte."
              : "Leve processos e clientes do escritório para o Notion, nos dois sentidos."}
          </p>
          {connected && (
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              {st?.last_sync_at ? `Última sincronização: ${new Date(st.last_sync_at).toLocaleString("pt-BR")}` : "Primeira sincronização em andamento."}
              {st && st.pendentes > 0 ? ` · ${st.pendentes} na fila` : ""}
              {st?.last_error ? ` · ${st.last_error}` : ""}
            </p>
          )}
          {!canManage && st && !blocked && (
            <p className="text-[11px] text-muted-foreground/70 mt-1">Só o administrador do escritório pode alterar esta integração.</p>
          )}
        </div>
      </div>

      {(loading && !st) && (
        <Button variant="outline" size="sm" disabled className="rounded-xl font-bold w-full">
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      )}

      {loadError && !loading && (
        <Button variant="outline" size="sm" onClick={loadStatus} className="rounded-xl font-bold w-full">
          <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
        </Button>
      )}

      {st && !blocked && !connected && canManage && (
        <Button size="sm" onClick={connect} disabled={busy} className="rounded-xl font-bold w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : hasError ? "Reconectar" : "Conectar"}
        </Button>
      )}

      {st && !blocked && connected && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-black/5 dark:border-border px-3 py-2">
            <span className="text-xs font-bold">Sincronização {st.ligado ? "ligada" : "desligada"}</span>
            <Switch checked={st.ligado} onCheckedChange={toggle} disabled={busy || !canManage} aria-label="Ligar ou desligar a sincronização com o Notion" />
          </label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => syncNow(false)} disabled={busy || !st.ligado} className="rounded-xl font-bold flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5" /> Sincronizar</>}
            </Button>
            {canManage && (
              <Button variant="ghost" size="sm" onClick={disconnect} disabled={busy} className="rounded-xl font-bold text-destructive hover:text-destructive">
                Desconectar
              </Button>
            )}
          </div>
          {canManage && st.ligado && (
            <button type="button" onClick={() => syncNow(true)} disabled={busy} className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 self-start disabled:opacity-50">
              Reenviar tudo (preenche só campos vazios no Notion)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
