import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, Link2, Unlink, MessageCircle } from "lucide-react";

// Seção "Vextria Zap" no dialog de editar escritório (super-admin). Liga o escritório
// a uma conta do Vextria Zap pelo e-mail (só para quem também assina o Zap). Com o
// vínculo ativo, leads qualificados no Zap passam a entrar no CRM do Hub.
export function OfficeZapLink({ officeId }: { officeId: string }) {
  const { toast } = useToast();
  const [link, setLink] = useState<{ zap_email: string; active: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [preview, setPreview] = useState<{ found: boolean; name?: string; active?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("zap-link", { body: { action: "status", office_id: officeId } });
    setLink(data?.link ?? null);
    setLoading(false);
  }, [officeId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const resolve = async () => {
    if (!email.trim()) return;
    setBusy(true); setPreview(null);
    const { data, error } = await supabase.functions.invoke("zap-link", { body: { action: "resolve", email } });
    setBusy(false);
    if (error || data?.error) { toast({ title: "Não foi possível consultar o Zap", variant: "destructive" }); return; }
    setPreview(data);
    if (!data?.found) toast({ title: "Nenhuma conta do Zap com esse e-mail", variant: "destructive" });
  };

  const doLink = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("zap-link", { body: { action: "link", office_id: officeId, email } });
    setBusy(false);
    if (error || data?.error) { toast({ title: "Falha ao vincular", description: data?.error, variant: "destructive" }); return; }
    toast({ title: "Escritório vinculado ao Vextria Zap", description: "Leads qualificados vão aparecer no CRM." });
    setEmail(""); setPreview(null); loadStatus();
  };

  const unlink = async () => {
    setBusy(true);
    await supabase.functions.invoke("zap-link", { body: { action: "unlink", office_id: officeId } });
    setBusy(false);
    toast({ title: "Vínculo removido" });
    setPreview(null); loadStatus();
  };

  return (
    <div className="rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-emerald-500" />
        <Label className="text-sm font-bold">Vextria Zap</Label>
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : link?.active ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            <Check className="h-3 w-3 inline text-emerald-500" /> Vinculado a <strong>{link.zap_email}</strong>. Leads qualificados entram no CRM.
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={unlink} disabled={busy} className="text-destructive shrink-0 rounded-xl">
            <Unlink className="h-3.5 w-3.5" /> Desvincular
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Ligue este escritório a uma conta do Vextria Zap (só para quem também assina o Zap). Leads qualificados no Zap passam a entrar no CRM.
          </p>
          <div className="flex gap-2">
            <Input type="email" placeholder="e-mail da conta no Zap" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 rounded-xl text-sm" />
            <Button type="button" variant="outline" size="sm" onClick={resolve} disabled={busy || !email.trim()} className="rounded-xl shrink-0">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </Button>
          </div>
          {preview?.found && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-2.5">
              <p className="text-xs">
                <strong>{preview.name}</strong>{" "}
                <span className={preview.active ? "text-emerald-600" : "text-amber-600"}>
                  · assinatura {preview.active ? "ativa" : "inativa/desconhecida"}
                </span>
              </p>
              <Button type="button" size="sm" onClick={doLink} disabled={busy} className="rounded-xl shrink-0">
                <Link2 className="h-3.5 w-3.5" /> Vincular
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
