// Diálogo "Registrar Convite" (extraído de pages/Equipe.tsx). O formulário vive
// aqui; a validação e o envio ficam com a página (onInvite devolve true para
// fechar e limpar o formulário).
import { useState } from "react";
import { Send, Crown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "./shared";

export type ConviteRole = "user" | "admin";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (email: string, role: ConviteRole) => Promise<boolean>;
}

export function InviteDialog({ open, onOpenChange, onInvite }: Props) {
  const [inviteForm, setInviteForm] = useState({ email: "", role: "user" as ConviteRole });
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    const email = inviteForm.email.trim();
    if (!email) return;
    setSending(true);
    const ok = await onInvite(email, inviteForm.role);
    setSending(false);
    if (ok) {
      onOpenChange(false);
      setInviteForm({ email: "", role: "user" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
          <DialogTitle className="font-black text-lg flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />Registrar Convite
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Registra o e-mail. O membro deverá criar a senha no primeiro acesso.</p>
        </DialogHeader>
        <div className="px-6 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">E-mail *</Label>
            <Input type="email" placeholder="nome@escritorio.com.br"
              value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleInvite()}
              className="rounded-xl border-black/8 dark:border-border" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Função</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["user", "admin"] as const).map(role => (
                <button key={role} type="button" onClick={() => setInviteForm(f => ({ ...f, role }))}
                  className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                    inviteForm.role === role ? "border-primary bg-primary/5 text-primary" : "border-black/8 dark:border-border hover:bg-muted/40")}>
                  {role === "admin" ? <Crown className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  <span className="text-xs font-black">{ROLE_LABEL[role]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-black" disabled={sending}>Cancelar</Button>
          <Button onClick={handleInvite} className="rounded-xl font-black flex-1" disabled={sending || !inviteForm.email.trim()}>
            {sending ? "Registrando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
