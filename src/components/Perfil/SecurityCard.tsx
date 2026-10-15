// Segurança (alterar e-mail e senha) — extraído de pages/Perfil.tsx sem mudança de comportamento.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function SecurityCard() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const emailAtual = profile?.email || user?.email || "";

  const [novoEmail, setNovoEmail] = useState("");
  const [salvandoEmail, setSalvandoEmail] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail.trim());
  const emailDiferente = novoEmail.trim() && novoEmail.trim().toLowerCase() !== emailAtual.toLowerCase();
  const podeTrocarEmail = emailValido && emailDiferente && !salvandoEmail;

  const curta = novaSenha.length > 0 && novaSenha.length < 6;
  const diverge = confirmar.length > 0 && confirmar !== novaSenha;
  const podeSalvar = senhaAtual.length > 0 && novaSenha.length >= 6 && confirmar === novaSenha && !salvando;

  const alterarEmail = async () => {
    if (!podeTrocarEmail) return;
    setSalvandoEmail(true);
    const { error } = await supabase.auth.updateUser({ email: novoEmail.trim() });
    setSalvandoEmail(false);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao alterar e-mail", description: error.message });
      return;
    }
    toast({ title: "Confirme no seu e-mail", description: "Enviamos um link de confirmação para o novo endereço." });
    setNovoEmail("");
  };

  // A política "Require current password when updating" (GoTrue) exige o campo current_password
  // no corpo do request — que o updateUser do supabase-js NÃO envia. Então chamamos o endpoint
  // do GoTrue direto, mandando a senha atual + a nova. Server-enforced (uma sessão sequestrada
  // não sabe a senha atual) e sem depender de e-mail.
  const alterar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sua sessão expirou. Entre novamente e tente de novo.");
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ password: novaSenha, current_password: senhaAtual }),
      });
      if (!res.ok) {
        const body: Record<string, unknown> = await res.json().catch(() => ({}));
        const msg = String(body?.msg || body?.error_description || body?.error || body?.message || "");
        if (/current password|incorrect|invalid.*credential/i.test(msg)) {
          throw new Error("A senha atual está incorreta.");
        }
        throw new Error(msg || "Não foi possível alterar a senha.");
      }
      toast({ title: "Senha alterada", description: "Sua nova senha já está ativa." });
      setSenhaAtual(""); setNovaSenha(""); setConfirmar("");
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao alterar senha", description: e instanceof Error ? e.message : "Tente novamente." });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="glass-card p-8 rounded-[2.5rem] border-border bg-card/40 shadow-premium space-y-6">
      <h3 className="text-xl font-black flex items-center gap-3 text-foreground">
        <Lock className="h-6 w-6 text-primary" />
        Segurança
      </h3>

      {/* Trocar e-mail */}
      <div className="space-y-1.5 pb-6 border-b border-border/50">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Alterar e-mail de acesso</Label>
        <p className="text-[11px] text-muted-foreground -mt-0.5 mb-1">Atual: <span className="font-bold text-foreground/70">{emailAtual}</span></p>
        <Input
          type="email"
          value={novoEmail}
          onChange={(e) => setNovoEmail(e.target.value)}
          placeholder="novo@email.com"
          className={cn("h-12 rounded-2xl bg-background/50", novoEmail && !emailValido && "border-destructive focus-visible:ring-destructive")}
        />
        {novoEmail && !emailValido && <p className="text-[11px] font-bold text-destructive px-1">E-mail inválido.</p>}
        <Button onClick={alterarEmail} disabled={!podeTrocarEmail} variant="outline" className="w-full h-11 rounded-2xl font-black uppercase text-xs tracking-widest gap-2 mt-1">
          {salvandoEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {salvandoEmail ? "Enviando…" : "Alterar e-mail"}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Senha atual</Label>
          <Input
            type={mostrar ? "text" : "password"}
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            placeholder="Sua senha atual"
            autoComplete="current-password"
            className="h-12 rounded-2xl bg-background/50"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Nova senha</Label>
          <div className="relative">
            <Input
              type={mostrar ? "text" : "password"}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className={cn("h-12 rounded-2xl pr-11 bg-background/50", curta && "border-destructive focus-visible:ring-destructive")}
            />
            <button
              type="button"
              onClick={() => setMostrar((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
              aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
            >
              {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {curta && <p className="text-[11px] font-bold text-destructive px-1">Use ao menos 6 caracteres.</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Confirmar nova senha</Label>
          <Input
            type={mostrar ? "text" : "password"}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            placeholder="Repita a nova senha"
            className={cn("h-12 rounded-2xl bg-background/50", diverge && "border-destructive focus-visible:ring-destructive")}
          />
          {diverge && <p className="text-[11px] font-bold text-destructive px-1">As senhas não coincidem.</p>}
        </div>

        <Button onClick={alterar} disabled={!podeSalvar} className="w-full h-12 rounded-2xl font-black uppercase text-xs tracking-widest gap-2">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {salvando ? "Alterando…" : "Alterar Senha"}
        </Button>
      </div>
    </div>
  );
}
