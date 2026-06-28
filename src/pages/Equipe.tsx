import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useInvitations } from "@/hooks/useInvitations";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useOfficeTeams, useTeamMembers, type OfficeTeam } from "@/hooks/useOfficeTeams";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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

// ─── helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function avatarColor(seed: string) {
  const colors = [
    "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "–";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return d; }
}
function genPassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#!";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", user: "Usuário" };
const ROLE_CLS: Record<string, string> = {
  admin: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  user:  "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
};
const STATUS_CLS: Record<string, string> = {
  pending:  "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  accepted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  expired:  "bg-slate-500/10 text-slate-500 border-slate-500/20",
};
const STATUS_LABEL: Record<string, string> = { pending: "Aguardando", accepted: "Aceito", expired: "Expirado" };

// ─── permission groups ────────────────────────────────────────────────────────

type PermItem = { key: string; label: string; defaultUser: boolean };
type PermGroup = { label: string; perms: PermItem[] };

const PERMISSION_GROUPS: PermGroup[] = [
  { label: "Clientes", perms: [
    { key: "canViewClients",   label: "Visualizar", defaultUser: true  },
    { key: "canCreateClients", label: "Criar",       defaultUser: true  },
    { key: "canEditClients",   label: "Editar",      defaultUser: true  },
    { key: "canDeleteClients", label: "Excluir",     defaultUser: false },
  ]},
  { label: "Processos", perms: [
    { key: "canViewProcesses",   label: "Visualizar", defaultUser: true  },
    { key: "canCreateProcesses", label: "Criar",       defaultUser: true  },
    { key: "canEditProcesses",   label: "Editar",      defaultUser: true  },
    { key: "canDeleteProcesses", label: "Excluir",     defaultUser: false },
  ]},
  { label: "Atendimentos", perms: [
    { key: "canViewAtendimentos",   label: "Visualizar", defaultUser: true  },
    { key: "canCreateAtendimentos", label: "Criar",       defaultUser: true  },
    { key: "canEditAtendimentos",   label: "Editar",      defaultUser: true  },
    { key: "canDeleteAtendimentos", label: "Excluir",     defaultUser: false },
  ]},
  { label: "Financeiro", perms: [
    { key: "canViewFinanceiro",   label: "Visualizar", defaultUser: true  },
    { key: "canManageFinanceiro", label: "Gerenciar",  defaultUser: false },
  ]},
  { label: "Agenda & Audiências", perms: [
    { key: "canViewAgenda",       label: "Ver agenda",          defaultUser: true },
    { key: "canManageAgenda",     label: "Gerenciar agenda",    defaultUser: true },
    { key: "canViewAudiencias",   label: "Ver audiências",      defaultUser: true },
    { key: "canManageAudiencias", label: "Gerenciar audiências",defaultUser: true },
  ]},
  { label: "Tarefas & Prazos", perms: [
    { key: "canViewTarefas",   label: "Ver tarefas",      defaultUser: true },
    { key: "canManageTarefas", label: "Gerenciar tarefas",defaultUser: true },
    { key: "canViewPrazos",    label: "Ver prazos",       defaultUser: true },
    { key: "canManagePrazos",  label: "Gerenciar prazos", defaultUser: true },
  ]},
  { label: "Consultivo", perms: [
    { key: "canViewConsultivo",   label: "Visualizar", defaultUser: true  },
    { key: "canManageConsultivo", label: "Gerenciar",  defaultUser: false },
  ]},
  { label: "Relatórios", perms: [
    { key: "canViewGraficos",          label: "Ver gráficos",        defaultUser: true  },
    { key: "canViewAdvancedAnalytics", label: "Analytics avançados", defaultUser: false },
  ]},
  { label: "Metas", perms: [
    { key: "canViewMetas",   label: "Visualizar", defaultUser: true  },
    { key: "canManageMetas", label: "Gerenciar",  defaultUser: false },
  ]},
  { label: "Equipe & Escritório", perms: [
    { key: "canViewEquipe",   label: "Ver equipe",       defaultUser: true  },
    { key: "canManageEquipe", label: "Gerenciar equipe", defaultUser: false },
    { key: "canInviteUsers",  label: "Convidar membros", defaultUser: false },
  ]},
];

// ─── PermissionsPanel (reusável nos dois dialogs) ────────────────────────────

function PermissionsPanel({
  role,
  overrides,
  onChange,
}: {
  role: "user" | "admin";
  overrides: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
}) {
  const effective = (key: string, defaultUser: boolean) =>
    key in overrides ? overrides[key] : (role === "admin" ? true : defaultUser);

  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">{group.label}</p>
          <div className="rounded-2xl border border-black/5 dark:border-border overflow-hidden divide-y divide-border">
            {group.perms.map(perm => {
              const value = effective(perm.key, perm.defaultUser);
              const customized = perm.key in overrides;
              return (
                <div key={perm.key} className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{perm.label}</span>
                    {customized && (
                      <Badge variant="outline" className="text-[9px] font-black px-1.5 py-0 rounded border-primary/30 text-primary bg-primary/5">custom</Badge>
                    )}
                  </div>
                  <Switch checked={value} onCheckedChange={v => onChange(perm.key, v)} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── PermissionsDialog (editar membro existente) ─────────────────────────────

function PermissionsDialog({ open, onOpenChange, targetUserId, targetName, targetRole }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  targetUserId: string; targetName: string; targetRole: string;
}) {
  const { overrides: raw, loading, setPermission, resetAll } = useUserPermissions(open ? targetUserId : null);
  const { toast } = useToast();

  const overrides: Record<string, boolean> = useMemo(() => {
    const map: Record<string, boolean> = {};
    raw.forEach(o => { map[o.permission_key] = o.granted; });
    return map;
  }, [raw]);

  const handleChange = (key: string, value: boolean) => setPermission(key, value);

  const handleReset = async () => {
    await resetAll();
    toast({ title: "Permissões redefinidas", description: `${targetName} voltou às permissões padrão da função.` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="font-black text-lg flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />Permissões — {targetName}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Função base: <strong>{ROLE_LABEL[targetRole] ?? targetRole}</strong>
                {raw.length > 0 && <span className="ml-2 text-primary font-semibold">· {raw.length} override{raw.length > 1 ? "s" : ""} ativos</span>}
              </p>
            </div>
            {raw.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs font-bold rounded-xl gap-1.5 shrink-0">
                <RotateCcw className="h-3.5 w-3.5" />Redefinir
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          ) : (
            <PermissionsPanel
              role={targetRole as "user" | "admin"}
              overrides={overrides}
              onChange={handleChange}
            />
          )}
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground flex-1">Alterações salvas automaticamente.</p>
          <Button onClick={() => onOpenChange(false)} className="rounded-xl font-black">Concluído</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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

// ─── TEAM_COLORS ─────────────────────────────────────────────────────────────

const TEAM_COLORS = [
  { value: "#3b82f6", label: "Azul" },
  { value: "#8b5cf6", label: "Violeta" },
  { value: "#10b981", label: "Verde" },
  { value: "#f59e0b", label: "Âmbar" },
  { value: "#ef4444", label: "Vermelho" },
  { value: "#06b6d4", label: "Ciano" },
  { value: "#f97316", label: "Laranja" },
  { value: "#ec4899", label: "Rosa" },
];

// ─── TeamDialog ───────────────────────────────────────────────────────────────

function TeamDialog({ open, onOpenChange, initial, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  initial?: { name: string; color: string; description: string };
  onSave: (name: string, color: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? TEAM_COLORS[0].value);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(initial?.name ?? ""); setColor(initial?.color ?? TEAM_COLORS[0].value); setDescription(initial?.description ?? ""); }
  }, [open, initial?.name, initial?.color, initial?.description]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim(), color, description.trim());
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
          <DialogTitle className="font-black text-lg">{initial ? "Editar Equipe" : "Nova Equipe"}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Nome *</Label>
            <Input placeholder="Ex: Cível, Previdenciário…" value={name} onChange={e => setName(e.target.value)}
              className="rounded-xl border-black/8 dark:border-border" autoFocus
              onKeyDown={e => e.key === "Enter" && handleSave()} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {TEAM_COLORS.map(c => (
                <button key={c.value} type="button" onClick={() => setColor(c.value)}
                  className={cn("h-7 w-7 rounded-lg border-2 transition-all", color === c.value ? "border-foreground scale-110" : "border-transparent")}
                  style={{ backgroundColor: c.value }} title={c.label} />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Descrição</Label>
            <Input placeholder="Opcional…" value={description} onChange={e => setDescription(e.target.value)}
              className="rounded-xl border-black/8 dark:border-border" />
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-black" disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} className="rounded-xl font-black flex-1" disabled={saving || !name.trim()}>
            {saving ? "Salvando…" : initial ? "Salvar" : "Criar Equipe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── TeamDetailDialog ─────────────────────────────────────────────────────────

function TeamDetailDialog({ open, onOpenChange, team, allUsers }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  team: OfficeTeam; allUsers: any[];
}) {
  const { members, loading, addMember, removeMember, setMemberRole } = useTeamMembers(open ? team.id : null);
  const { toast } = useToast();

  const memberIds = new Set(members.map(m => m.user_id));
  const availableToAdd = allUsers.filter(u => !memberIds.has(u.user_id));

  const coordinators = members.filter(m => m.role === "coordinator");
  const regularMembers = members.filter(m => m.role === "member");

  const toggleCoordinator = async (m: typeof members[0]) => {
    const newRole = m.role === "coordinator" ? "member" : "coordinator";
    await setMemberRole(m.user_id, newRole);
    toast({ title: newRole === "coordinator" ? "Coordenador definido" : "Coordenador removido" });
  };

  const renderMemberRow = (m: typeof members[0], showCoordBadge = false) => {
    const name = m.profile?.full_name || m.profile?.email || "Membro";
    const isCoord = m.role === "coordinator";
    return (
      <div key={m.id} className="group flex items-center gap-3 bg-muted/20 rounded-xl px-3 py-2.5">
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0", avatarColor(m.user_id))}>
          {getInitials(name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{name}</p>
          {isCoord && (
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider">Coordenador</p>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button size="sm" variant="ghost" onClick={() => toggleCoordinator(m)}
            title={isCoord ? "Remover coordenador" : "Tornar coordenador"}
            className={cn("h-7 w-7 rounded-lg transition-colors",
              isCoord ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20" : "text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-500/10")}>
            <Crown className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={async () => { await removeMember(m.user_id); toast({ title: "Removido da equipe" }); }}
            className="h-7 w-7 rounded-lg text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-500/10">
            <UserMinus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl shrink-0 flex items-center justify-center" style={{ backgroundColor: team.color + "33" }}>
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
            </div>
            <div>
              <DialogTitle className="font-black text-lg leading-none">{team.name}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {members.length} membro{members.length !== 1 ? "s" : ""}
                {coordinators.length > 0 && <span className="ml-2 text-amber-500 font-semibold">· {coordinators.length} coordenador{coordinators.length > 1 ? "es" : ""}</span>}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">Nenhum membro ainda. Adicione abaixo.</p>
          ) : (
            <>
              {coordinators.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/70 mb-2">Coordenadores</p>
                  <div className="space-y-1.5">{coordinators.map(m => renderMemberRow(m))}</div>
                </div>
              )}
              {regularMembers.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">
                    Membros ({regularMembers.length})
                  </p>
                  <div className="space-y-1.5">{regularMembers.map(m => renderMemberRow(m))}</div>
                </div>
              )}
            </>
          )}

          {availableToAdd.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">Adicionar à equipe</p>
              <div className="space-y-1.5">
                {availableToAdd.map(u => {
                  const name = u.profile?.full_name || u.profile?.email || "Membro";
                  return (
                    <div key={u.id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 border border-black/5 dark:border-border hover:bg-muted/20 transition-colors">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0", avatarColor(u.user_id))}>
                        {getInitials(name)}
                      </div>
                      <p className="text-sm font-bold flex-1 truncate">{name}</p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" onClick={async () => { await addMember(u.user_id, "coordinator"); toast({ title: "Adicionado como coordenador" }); }}
                          title="Adicionar como coordenador"
                          className="h-7 w-7 rounded-lg text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-500/10">
                          <Crown className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={async () => { await addMember(u.user_id); toast({ title: "Adicionado à equipe" }); }}
                          title="Adicionar como membro"
                          className="h-7 w-7 rounded-lg text-muted-foreground/40 hover:text-primary hover:bg-primary/10">
                          <UserPlus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-border shrink-0 bg-muted/20">
          <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1.5">
            <Crown className="h-3 w-3 text-amber-500" />
            Passe o mouse sobre um membro e clique na coroa para torná-lo coordenador.
          </p>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button onClick={() => onOpenChange(false)} className="rounded-xl font-black w-full">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({ label, value, Icon, color, bg }: {
  label: string; value: number | string; Icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-black/5 dark:border-border shadow-premium p-4 flex items-center gap-4">
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", bg)}>
        <Icon className={cn("h-5 w-5", color)} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{label}</p>
        <p className="text-2xl font-black tracking-tight leading-none">{value}</p>
      </div>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function Equipe() {
  const navigate = useNavigate();
  const { user: me, office, isOfficeAdmin } = useAuth();
  // Só admin/dono DO ESCRITÓRIO gerencia equipes (papel global de app não conta)
  const canManageTeams = isOfficeAdmin;
  const { toast } = useToast();
  const { users, loading: usersLoading, removeUser, updateUser, refresh: refreshUsers } = useOfficeUsers();
  const { invitations, loading: invLoading, createInvitation, resendInvitation, cancelInvitation, pendingInvitations } = useInvitations();
  const { teams, loading: teamsLoading, create: createTeam, update: updateTeam, remove: removeTeam } = useOfficeTeams();

  const [search, setSearch] = useState("");
  const [tab, setTab]       = useState("membros");

  // dialogs
  const [addMenuOpen, setAddMenuOpen]       = useState(false);
  const [inviteOpen, setInviteOpen]         = useState(false);
  const [createOpen, setCreateOpen]         = useState(false);
  const [inviteForm, setInviteForm]         = useState({ email: "", role: "user" as "user" | "admin" });
  const [sending, setSending]               = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget]         = useState<{ id: string; name: string; role: string } | null>(null);
  const [newRole, setNewRole]               = useState<"user" | "admin">("user");
  const [permTarget, setPermTarget]         = useState<{ userId: string; name: string; role: string } | null>(null);
  // teams
  const [teamDialogOpen, setTeamDialogOpen]   = useState(false);
  const [editingTeam, setEditingTeam]         = useState<OfficeTeam | null>(null);
  const [detailTeam, setDetailTeam]           = useState<OfficeTeam | null>(null);

  const totalMembros = users.length;
  const admins       = users.filter(u => u.role === "admin").length;
  const convitesPend = pendingInvitations.length;

  const filteredUsers = users.filter(u => {
    const name  = u.profile?.full_name || "";
    const email = u.profile?.email || "";
    return !search || name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
  });
  const filteredInv = invitations.filter(i => !search || i.email.toLowerCase().includes(search.toLowerCase()));

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) return;
    setSending(true);
    const result = await createInvitation({ email: inviteForm.email.trim(), role: inviteForm.role });
    setSending(false);
    if (result) {
      toast({ title: "Convite registrado", description: `Convite para ${inviteForm.email} criado. Compartilhe o link de acesso manualmente.` });
      setInviteOpen(false);
      setInviteForm({ email: "", role: "user" });
    } else {
      toast({ title: "Erro ao registrar convite", variant: "destructive" });
    }
  };

  const openRoleEdit = (u: typeof users[0]) => {
    setRoleTarget({ id: u.id, name: u.profile?.full_name || u.profile?.email || "Membro", role: u.role });
    setNewRole(u.role as "user" | "admin");
    setRoleDialogOpen(true);
  };

  const handleRoleSave = async () => {
    if (!roleTarget) return;
    await updateUser(roleTarget.id, { role: newRole });
    toast({ title: "Função atualizada" });
    setRoleDialogOpen(false);
  };

  return (
    <div className="flex-1 p-4 md:p-8 overflow-x-hidden entry-animate">
      <div className="max-w-5xl mx-auto w-full space-y-6">

        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Equipe</h1>
              <p className="text-sm text-muted-foreground">Membros e convites do escritório</p>
            </div>
          </div>

          {/* add menu */}
          <div className="flex gap-2">
            <Button onClick={() => setCreateOpen(true)} className="rounded-xl font-black gap-2">
              <KeyRound className="h-4 w-4" />Criar com senha
            </Button>
          </div>
        </div>

        {/* stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="Membros"         value={totalMembros} Icon={Users} color="text-primary"    bg="bg-primary/10" />
          <StatCard label="Administradores" value={admins}       Icon={Crown} color="text-violet-500" bg="bg-violet-500/10" />
          <StatCard label="Convites Pend."  value={convitesPend} Icon={Clock} color="text-amber-500"  bg="bg-amber-500/10" />
        </div>

        {/* search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 rounded-xl border-black/8 dark:border-border" />
        </div>

        {/* tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="rounded-xl bg-muted/50 p-1">
            <TabsTrigger value="membros" className="rounded-lg font-bold text-xs">
              Membros
              {totalMembros > 0 && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5 font-black">{totalMembros}</span>}
            </TabsTrigger>
            <TabsTrigger value="convites" className="rounded-lg font-bold text-xs">
              Convites
              {invitations.length > 0 && <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-black">{invitations.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="equipes" className="rounded-lg font-bold text-xs">
              Equipes
              {teams.length > 0 && <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-black">{teams.length}</span>}
            </TabsTrigger>
          </TabsList>

          {/* ── membros ── */}
          <TabsContent value="membros" className="mt-4">
            {usersLoading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="p-4 rounded-2xl bg-muted/40"><Users className="h-8 w-8 text-muted-foreground/40" /></div>
                <p className="font-bold">Nenhum membro encontrado</p>
                <Button onClick={() => setCreateOpen(true)} className="rounded-xl font-black gap-2 mt-1">
                  <Plus className="h-4 w-4" />Adicionar Membro
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map(u => {
                  const name      = u.profile?.full_name || u.profile?.email || "Membro";
                  const email     = u.profile?.email || "–";
                  const isMe      = u.user_id === me?.id;
                  const initials  = getInitials(name);
                  const avatarCls = avatarColor(u.user_id);
                  return (
                    <div key={u.id} className="group flex items-center gap-4 bg-card border border-black/5 dark:border-border rounded-2xl shadow-premium hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-4">
                      <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0 font-black text-sm", avatarCls)}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-sm tracking-tight truncate">{name}</p>
                          {isMe && <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">Você</span>}
                        </div>
                        <p className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3 shrink-0" />{email}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">Desde {fmtDate(u.joined_at)}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] font-black px-2 py-0.5 rounded-lg border shrink-0", ROLE_CLS[u.role] ?? ROLE_CLS.user)}>
                        {u.role === "admin" ? <Crown className="h-3 w-3 mr-1 inline" /> : <User className="h-3 w-3 mr-1 inline" />}
                        {ROLE_LABEL[u.role] ?? u.role}
                      </Badge>
                      {!isMe && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button size="sm" variant="ghost"
                            className="h-8 px-2.5 text-[10px] font-black rounded-xl hover:bg-primary/10 hover:text-primary"
                            onClick={() => setPermTarget({ userId: u.user_id, name, role: u.role })}>
                            <Settings2 className="h-3.5 w-3.5 mr-1" />Permissões
                          </Button>
                          <Button size="sm" variant="ghost"
                            className="h-8 px-2.5 text-[10px] font-black rounded-xl hover:bg-muted/60"
                            onClick={() => openRoleEdit(u)}>
                            <ShieldCheck className="h-3.5 w-3.5 mr-1" />Função
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost"
                                className="h-8 w-8 rounded-xl text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover {name}?</AlertDialogTitle>
                                <AlertDialogDescription>O membro perderá acesso ao escritório.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => { removeUser(u.id); toast({ title: "Membro removido" }); }}
                                  className="rounded-xl bg-destructive hover:bg-destructive/90">Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── convites ── */}
          <TabsContent value="convites" className="mt-4">
            {invLoading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
            ) : filteredInv.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="p-4 rounded-2xl bg-muted/40"><Send className="h-8 w-8 text-muted-foreground/40" /></div>
                <p className="font-bold">Nenhum convite registrado</p>
                <p className="text-sm text-muted-foreground">Use "Criar com senha" para adicionar membros.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredInv.map(inv => (
                  <div key={inv.id} className="group flex items-center gap-4 bg-card border border-black/5 dark:border-border rounded-2xl shadow-premium hover:shadow-lg transition-all duration-200 p-4">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bg-muted/40">
                      <Mail className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm tracking-tight truncate">{inv.email}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        Enviado {fmtDate(inv.created_at)} · Expira {fmtDate(inv.expires_at)}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Badge variant="outline" className={cn("text-[10px] font-black px-2 py-0.5 rounded-lg border", ROLE_CLS[inv.role] ?? ROLE_CLS.user)}>
                        {ROLE_LABEL[inv.role] ?? inv.role}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[10px] font-black px-2 py-0.5 rounded-lg border", STATUS_CLS[inv.status] ?? STATUS_CLS.expired)}>
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                    </div>
                    {inv.status === "pending" && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost"
                          className="h-8 px-2.5 text-[10px] font-black rounded-xl hover:bg-primary/10 hover:text-primary"
                          onClick={async () => { const r = await resendInvitation(inv.id); if (r) toast({ title: "Convite atualizado" }); }}>
                          <RefreshCw className="h-3 w-3 mr-1" />Renovar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 rounded-xl text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10">
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir convite?</AlertDialogTitle>
                              <AlertDialogDescription>O convite de {inv.email} será removido permanentemente.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={async () => { await cancelInvitation(inv.id); toast({ title: "Convite excluído" }); }}
                                className="rounded-xl bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                    {inv.status === "accepted" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── equipes ── */}
          <TabsContent value="equipes" className="mt-4">
            {canManageTeams && (
              <div className="flex justify-end mb-3">
                <Button onClick={() => { setEditingTeam(null); setTeamDialogOpen(true); }} className="rounded-xl font-black gap-2">
                  <Plus className="h-4 w-4" />Nova Equipe
                </Button>
              </div>
            )}
            {teamsLoading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
            ) : teams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="p-4 rounded-2xl bg-muted/40"><FolderOpen className="h-8 w-8 text-muted-foreground/40" /></div>
                <p className="font-bold">Nenhuma equipe criada</p>
                <p className="text-sm text-muted-foreground">
                  {canManageTeams ? "Crie equipes para organizar os membros por área de atuação." : "Nenhuma equipe foi criada pelo administrador ainda."}
                </p>
                {canManageTeams && (
                  <Button onClick={() => { setEditingTeam(null); setTeamDialogOpen(true); }} className="rounded-xl font-black gap-2 mt-1">
                    <Plus className="h-4 w-4" />Criar primeira equipe
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {teams.map(team => (
                  <div key={team.id}
                    className="group bg-card border border-black/5 dark:border-border rounded-2xl shadow-premium hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-4 cursor-pointer"
                    onClick={() => setDetailTeam(team)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center" style={{ backgroundColor: team.color + "22" }}>
                          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: team.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-sm tracking-tight truncate">{team.name}</p>
                          {team.description && <p className="text-xs text-muted-foreground/60 truncate">{team.description}</p>}
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{team.member_count ?? 0} membro{(team.member_count ?? 0) !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 rounded-lg hover:bg-primary/10 text-muted-foreground/50 hover:text-primary"
                          title="Ver produtividade"
                          onClick={() => navigate(`/equipe/${team.id}`)}>
                          <BarChart2 className="h-3.5 w-3.5" />
                        </Button>
                        {canManageTeams && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 rounded-lg hover:bg-muted/60"
                          onClick={() => { setEditingTeam(team); setTeamDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        )}
                        {canManageTeams && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 rounded-lg text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir equipe "{team.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>Os membros não serão removidos do escritório, apenas desta equipe.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => { removeTeam(team.id); toast({ title: "Equipe excluída" }); }}
                                className="rounded-xl bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── invite dialog ─────────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
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
            <Button variant="outline" onClick={() => setInviteOpen(false)} className="rounded-xl font-black" disabled={sending}>Cancelar</Button>
            <Button onClick={handleInvite} className="rounded-xl font-black flex-1" disabled={sending || !inviteForm.email.trim()}>
              {sending ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── create with password dialog ───────────────────────────────── */}
      {office?.id && (
        <CreateMemberDialog
          open={createOpen} onOpenChange={setCreateOpen}
          officeId={office.id} onSuccess={refreshUsers}
        />
      )}

      {/* ── role dialog ───────────────────────────────────────────────── */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-xs rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
            <DialogTitle className="font-black text-lg">Alterar Função</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-3">
            <p className="text-sm text-muted-foreground">Função de <strong className="text-foreground">{roleTarget?.name}</strong>:</p>
            <div className="grid grid-cols-2 gap-2">
              {(["user", "admin"] as const).map(role => (
                <button key={role} type="button" onClick={() => setNewRole(role)}
                  className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                    newRole === role ? "border-primary bg-primary/5 text-primary" : "border-black/8 dark:border-border hover:bg-muted/40")}>
                  {role === "admin" ? <Crown className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  <span className="text-xs font-black">{ROLE_LABEL[role]}</span>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border flex gap-2">
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)} className="rounded-xl font-black">Cancelar</Button>
            <Button onClick={handleRoleSave} className="rounded-xl font-black flex-1">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── permissions dialog ────────────────────────────────────────── */}
      {permTarget && (
        <PermissionsDialog
          open={!!permTarget} onOpenChange={v => { if (!v) setPermTarget(null); }}
          targetUserId={permTarget.userId} targetName={permTarget.name} targetRole={permTarget.role}
        />
      )}

      {/* ── team create/edit dialog ───────────────────────────────────── */}
      <TeamDialog
        open={teamDialogOpen} onOpenChange={setTeamDialogOpen}
        initial={editingTeam ? { name: editingTeam.name, color: editingTeam.color, description: editingTeam.description || "" } : undefined}
        onSave={async (name, color, description) => {
          if (editingTeam) {
            await updateTeam(editingTeam.id, { name, color, description });
            toast({ title: "Equipe atualizada" });
          } else {
            await createTeam(name, color, description);
            toast({ title: "Equipe criada" });
          }
          setEditingTeam(null);
        }}
      />

      {/* ── team detail dialog ───────────────────────────────────────── */}
      {detailTeam && (
        <TeamDetailDialog
          open={!!detailTeam} onOpenChange={v => { if (!v) setDetailTeam(null); }}
          team={detailTeam} allUsers={users}
        />
      )}
    </div>
  );
}
