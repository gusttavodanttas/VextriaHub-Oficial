import { useState } from "react";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useInvitations } from "@/hooks/useInvitations";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Users, Plus, Search, Mail, Clock, ShieldCheck, User,
  Trash2, Send, RefreshCw, XCircle, CheckCircle2, Crown,
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

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  user:  "Usuário",
};
const ROLE_CLS: Record<string, string> = {
  admin: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  user:  "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
};

const STATUS_CLS: Record<string, string> = {
  pending:  "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  accepted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  expired:  "bg-slate-500/10 text-slate-500 border-slate-500/20",
};
const STATUS_LABEL: Record<string, string> = {
  pending:  "Pendente",
  accepted: "Aceito",
  expired:  "Expirado",
};

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({ label, value, Icon, color, bg }: {
  label: string; value: number | string;
  Icon: React.ElementType; color: string; bg: string;
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
  const { user: me } = useAuth();
  const { toast } = useToast();
  const {
    users, loading: usersLoading, removeUser, updateUser, refresh: refreshUsers,
  } = useOfficeUsers();
  const {
    invitations, loading: invLoading, createInvitation,
    resendInvitation, cancelInvitation, pendingInvitations,
  } = useInvitations();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("membros");

  // invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "user" as "user" | "admin" });
  const [sending, setSending] = useState(false);

  // role edit dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<{ id: string; name: string; role: string } | null>(null);
  const [newRole, setNewRole] = useState<"user" | "admin">("user");

  const totalMembros  = users.length;
  const admins        = users.filter(u => u.role === "admin").length;
  const convitesPend  = pendingInvitations.length;

  const filteredUsers = users.filter(u => {
    const name  = u.profile?.full_name || "";
    const email = u.profile?.email || "";
    return !search || name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
  });

  const filteredInv = invitations.filter(i =>
    !search || i.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) return;
    setSending(true);
    try {
      const result = await createInvitation({ email: inviteForm.email.trim(), role: inviteForm.role });
      if (result) {
        toast({ title: "Convite enviado", description: `Convite enviado para ${inviteForm.email}` });
        setInviteOpen(false);
        setInviteForm({ email: "", role: "user" });
      } else {
        toast({ title: "Erro ao enviar convite", variant: "destructive" });
      }
    } finally {
      setSending(false);
    }
  };

  const handleResend = async (id: string, email: string) => {
    const result = await resendInvitation(id);
    if (result) toast({ title: "Convite reenviado", description: `Reenviado para ${email}` });
  };

  const handleCancel = async (id: string) => {
    await cancelInvitation(id);
    toast({ title: "Convite cancelado" });
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

  const handleRemove = async (id: string) => {
    await removeUser(id);
    toast({ title: "Membro removido da equipe" });
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
          <Button onClick={() => setInviteOpen(true)} className="rounded-xl font-black gap-2">
            <Plus className="h-4 w-4" />Convidar Membro
          </Button>
        </div>

        {/* stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="Membros"          value={totalMembros} Icon={Users}        color="text-primary"     bg="bg-primary/10" />
          <StatCard label="Administradores"  value={admins}       Icon={Crown}        color="text-violet-500"  bg="bg-violet-500/10" />
          <StatCard label="Convites Pend."   value={convitesPend} Icon={Clock}        color="text-amber-500"   bg="bg-amber-500/10" />
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
              Membros {totalMembros > 0 && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5 font-black">{totalMembros}</span>}
            </TabsTrigger>
            <TabsTrigger value="convites" className="rounded-lg font-bold text-xs">
              Convites {invitations.length > 0 && <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-black">{invitations.length}</span>}
            </TabsTrigger>
          </TabsList>

          {/* ── membros ── */}
          <TabsContent value="membros" className="mt-4">
            {usersLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="p-4 rounded-2xl bg-muted/40">
                  <Users className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="font-bold">Nenhum membro encontrado</p>
                <p className="text-sm text-muted-foreground">Convide alguém para começar.</p>
                <Button onClick={() => setInviteOpen(true)} className="rounded-xl font-black gap-2 mt-1">
                  <Plus className="h-4 w-4" />Convidar Membro
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map(u => {
                  const name     = u.profile?.full_name || u.profile?.email || "Membro";
                  const email    = u.profile?.email || "–";
                  const isMe     = u.user_id === me?.id;
                  const initials = getInitials(name);
                  const avatarCls = avatarColor(u.user_id);
                  return (
                    <div key={u.id} className="group flex items-center gap-4 bg-card border border-black/5 dark:border-border rounded-2xl shadow-premium hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-4">
                      {/* avatar */}
                      <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0 font-black text-sm", avatarCls)}>
                        {initials}
                      </div>

                      {/* info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-sm tracking-tight truncate">{name}</p>
                          {isMe && <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">Você</span>}
                        </div>
                        <p className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3 shrink-0" />{email}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                          Desde {fmtDate(u.joined_at)}
                        </p>
                      </div>

                      {/* role badge */}
                      <Badge variant="outline" className={cn("text-[10px] font-black px-2 py-0.5 rounded-lg border shrink-0", ROLE_CLS[u.role] ?? ROLE_CLS.user)}>
                        {u.role === "admin" ? <Crown className="h-3 w-3 mr-1 inline" /> : <User className="h-3 w-3 mr-1 inline" />}
                        {ROLE_LABEL[u.role] ?? u.role}
                      </Badge>

                      {/* actions */}
                      {!isMe && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button size="sm" variant="ghost"
                            className="h-8 px-2.5 text-[10px] font-black rounded-xl hover:bg-primary/10 hover:text-primary"
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
                                <AlertDialogDescription>
                                  O membro perderá acesso ao escritório. Esta ação pode ser revertida convidando-o novamente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemove(u.id)}
                                  className="rounded-xl bg-destructive hover:bg-destructive/90">
                                  Remover
                                </AlertDialogAction>
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
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
              </div>
            ) : filteredInv.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="p-4 rounded-2xl bg-muted/40">
                  <Send className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="font-bold">Nenhum convite encontrado</p>
                <p className="text-sm text-muted-foreground">Convide alguém para que apareça aqui.</p>
                <Button onClick={() => setInviteOpen(true)} className="rounded-xl font-black gap-2 mt-1">
                  <Plus className="h-4 w-4" />Convidar Membro
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredInv.map(inv => {
                  const stCls  = STATUS_CLS[inv.status]  ?? STATUS_CLS.expired;
                  const stLbl  = STATUS_LABEL[inv.status] ?? inv.status;
                  const roleCls = ROLE_CLS[inv.role] ?? ROLE_CLS.user;
                  const isExpired = inv.status === "expired" || new Date(inv.expires_at) < new Date();
                  return (
                    <div key={inv.id} className="group flex items-center gap-4 bg-card border border-black/5 dark:border-border rounded-2xl shadow-premium hover:shadow-lg transition-all duration-200 p-4">
                      {/* avatar placeholder */}
                      <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bg-muted/40")}>
                        <Mail className="h-5 w-5 text-muted-foreground/50" />
                      </div>

                      {/* info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm tracking-tight truncate">{inv.email}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                          Enviado em {fmtDate(inv.created_at)} · Expira {fmtDate(inv.expires_at)}
                        </p>
                      </div>

                      {/* badges */}
                      <div className="flex gap-1.5 shrink-0">
                        <Badge variant="outline" className={cn("text-[10px] font-black px-2 py-0.5 rounded-lg border", roleCls)}>
                          {ROLE_LABEL[inv.role] ?? inv.role}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px] font-black px-2 py-0.5 rounded-lg border", stCls)}>
                          {stLbl}
                        </Badge>
                      </div>

                      {/* actions */}
                      {inv.status === "pending" && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button size="sm" variant="ghost"
                            className="h-8 px-2.5 text-[10px] font-black rounded-xl hover:bg-primary/10 hover:text-primary"
                            onClick={() => handleResend(inv.id, inv.email)}>
                            <RefreshCw className="h-3 w-3 mr-1" />Reenviar
                          </Button>
                          <Button size="sm" variant="ghost"
                            className="h-8 px-2.5 text-[10px] font-black rounded-xl text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10"
                            onClick={() => handleCancel(inv.id)}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      {inv.status === "accepted" && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── invite dialog ──────────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
            <DialogTitle className="font-black text-lg flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Convidar Membro
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">E-mail *</Label>
              <Input
                type="email"
                placeholder="nome@escritorio.com.br"
                value={inviteForm.email}
                onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleInvite()}
                className="rounded-xl border-black/8 dark:border-border"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Função</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["user", "admin"] as const).map(role => (
                  <button key={role} type="button"
                    onClick={() => setInviteForm(f => ({ ...f, role }))}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                      inviteForm.role === role
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-black/8 dark:border-border hover:bg-muted/40"
                    )}>
                    {role === "admin" ? <Crown className="h-5 w-5" /> : <User className="h-5 w-5" />}
                    <span className="text-xs font-black">{ROLE_LABEL[role]}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight text-center">
                      {role === "admin" ? "Acesso total ao escritório" : "Acesso padrão ao sistema"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border flex gap-2">
            <Button variant="outline" onClick={() => setInviteOpen(false)} className="rounded-xl font-black" disabled={sending}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} className="rounded-xl font-black flex-1"
              disabled={sending || !inviteForm.email.trim()}>
              {sending ? "Enviando..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── role dialog ────────────────────────────────────────────────── */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-xs rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
            <DialogTitle className="font-black text-lg">Alterar Função</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Função de <strong className="text-foreground">{roleTarget?.name}</strong>:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["user", "admin"] as const).map(role => (
                <button key={role} type="button"
                  onClick={() => setNewRole(role)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                    newRole === role
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-black/8 dark:border-border hover:bg-muted/40"
                  )}>
                  {role === "admin" ? <Crown className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  <span className="text-xs font-black">{ROLE_LABEL[role]}</span>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border flex gap-2">
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)} className="rounded-xl font-black">
              Cancelar
            </Button>
            <Button onClick={handleRoleSave} className="rounded-xl font-black flex-1">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
