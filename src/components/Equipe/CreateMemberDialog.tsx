// Criação de membro com senha provisória e permissões — extraído de pages/Equipe.tsx.
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useInvitations } from "@/hooks/useInvitations";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useOfficeTeams, useTeamMembers, type OfficeTeam } from "@/hooks/useOfficeTeams";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PERMISSION_GROUPS } from "./shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Users, Plus, Search, Mail, Clock, ShieldCheck, User,
  Trash2, Send, RefreshCw, XCircle, CheckCircle2, Crown,
  Settings2, RotateCcw, KeyRound, Eye, EyeOff, Copy, ChevronRight, ChevronLeft,
  FolderOpen, Pencil, UserPlus, UserMinus, BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { genPassword, getInitials, avatarColor, ROLE_LABEL } from "./shared";
import { PermissionsPanel } from "./PermissionsDialog";

// ─── CreateMemberDialog (senha provisória + permissões) ──────────────────────

function CreateMemberDialog({ open, onOpenChange, officeId, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  officeId: string; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ name: "", email: "", password: genPassword(), role: "user" as "user" | "admin" });
  const [showPass, setShowPass] = useState(false);
  const [permOverrides, setPermOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setStep(1); setForm({ name: "", email: "", password: genPassword(), role: "user" });
    setShowPass(false); setPermOverrides({}); setSaving(false); setDone(false);
  };

  const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const handlePermChange = (key: string, value: boolean) => {
    setPermOverrides(prev => ({ ...prev, [key]: value }));
  };

  const handleCreate = async () => {
    if (!form.email.trim() || !form.password) return;
    setSaving(true);

    // build permissions array — only overrides that differ from role default
    const permissions: { key: string; granted: boolean }[] = [];
    PERMISSION_GROUPS.forEach(g => g.perms.forEach(p => {
      const roleDefault = form.role === "admin" ? true : p.defaultUser;
      const override = permOverrides[p.key];
      if (override !== undefined && override !== roleDefault) {
        permissions.push({ key: p.key, granted: override });
      }
    }));

    const { data, error } = await supabase.functions.invoke("create-team-member", {
      body: { full_name: form.name.trim(), email: form.email.trim(), password: form.password, office_id: officeId, role: form.role, permissions },
    });

    setSaving(false);

    if (error || data?.error) {
      toast({ title: "Erro ao criar membro", description: data?.error || String(error), variant: "destructive" });
      return;
    }

    setDone(true);
    onSuccess();
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(form.password);
    toast({ title: "Senha copiada!" });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle className="font-black text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {done ? "Membro criado!" : "Criar com Senha Provisória"}
          </DialogTitle>
          {!done && (
            <div className="flex gap-1 mt-2">
              {([1, 2] as const).map(s => (
                <div key={s} className={cn("h-1 flex-1 rounded-full transition-colors", step >= s ? "bg-primary" : "bg-muted")} />
              ))}
            </div>
          )}
        </DialogHeader>

        {done ? (
          <div className="overflow-y-auto flex-1 px-6 py-6 flex flex-col items-center gap-4 text-center">
            <div className="p-3 rounded-2xl bg-emerald-500/10">
              <CheckCircle2 className="h-9 w-9 text-emerald-500" />
            </div>
            <div>
              <p className="font-black text-lg">Acesso criado com sucesso!</p>
              <p className="text-sm text-muted-foreground mt-1">Compartilhe as credenciais abaixo com o novo membro.</p>
            </div>
            <div className="w-full rounded-2xl border border-black/5 dark:border-border bg-muted/30 p-3 space-y-2 text-left">
              {form.name && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Nome</p>
                  <p className="font-bold text-sm">{form.name}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">E-mail</p>
                <p className="font-bold text-sm">{form.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Senha provisória</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono font-bold text-sm flex-1">{form.password}</p>
                  <Button size="sm" variant="ghost" onClick={copyPassword} className="h-7 w-7 rounded-lg">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Função</p>
                <p className="font-bold text-sm">{ROLE_LABEL[form.role]}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Oriente o membro a alterar a senha no primeiro acesso.</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 px-6 py-5">
            {step === 1 && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Nome completo</Label>
                  <Input placeholder="João da Silva"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="rounded-xl border-black/8 dark:border-border" autoFocus />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">E-mail *</Label>
                  <Input type="email" placeholder="nome@escritorio.com.br"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="rounded-xl border-black/8 dark:border-border" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Senha provisória *</Label>
                    <button onClick={() => setForm(f => ({ ...f, password: genPassword() }))}
                      className="text-[10px] text-primary font-bold hover:underline">Gerar nova</button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPass ? "text" : "password"}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      className="rounded-xl border-black/8 dark:border-border font-mono pr-20"
                    />
                    <div className="absolute right-1 top-1 flex gap-0.5">
                      <Button size="sm" variant="ghost" onClick={() => setShowPass(s => !s)} className="h-7 w-7 rounded-lg">
                        {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={copyPassword} className="h-7 w-7 rounded-lg">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Compartilhe com o membro. Ele poderá alterar no primeiro acesso.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Função</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["user", "admin"] as const).map(role => (
                      <button key={role} type="button" onClick={() => setForm(f => ({ ...f, role }))}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                          form.role === role ? "border-primary bg-primary/5 text-primary" : "border-black/8 dark:border-border hover:bg-muted/40"
                        )}>
                        {role === "admin" ? <Crown className="h-5 w-5" /> : <User className="h-5 w-5" />}
                        <span className="text-xs font-black">{ROLE_LABEL[role]}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight text-center">
                          {role === "admin" ? "Acesso total ao escritório" : "Acesso padrão — personalize abaixo"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Personalize o acesso de <strong className="text-foreground">{form.name || form.email || "novo membro"}</strong>. Ajustes marcados como <span className="text-primary font-semibold">custom</span> substituem o padrão da função.
                </p>
                <PermissionsPanel role={form.role} overrides={permOverrides} onChange={handlePermChange} />
              </div>
            )}
          </div>
        )}

        {!done && (
          <DialogFooter className="px-6 py-4 border-t border-border shrink-0 flex gap-2">
            {step === 2 && (
              <Button variant="ghost" onClick={() => setStep(1)} className="rounded-xl font-black gap-1.5 mr-auto">
                <ChevronLeft className="h-4 w-4" />Voltar
              </Button>
            )}
            <Button variant="outline" onClick={() => handleClose(false)} className="rounded-xl font-black" disabled={saving}>
              Cancelar
            </Button>
            {step === 1 ? (
              <Button onClick={() => setStep(2)} className="rounded-xl font-black gap-1.5"
                disabled={!form.email.trim() || !form.password}>
                Permissões<ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleCreate} className="rounded-xl font-black" disabled={saving}>
                {saving ? "Criando..." : "Criar Acesso"}
              </Button>
            )}
          </DialogFooter>
        )}

        {done && (
          <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
            <Button onClick={() => handleClose(false)} className="rounded-xl font-black w-full">Fechar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { CreateMemberDialog };
