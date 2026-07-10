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

// Módulos extraídos deste arquivo (desmonte do god-component) — comportamento idêntico
import {
  getInitials, avatarColor, fmtDate,
  ROLE_LABEL, ROLE_CLS, STATUS_CLS, STATUS_LABEL,
} from "@/components/Equipe/shared";
import { PermissionsDialog } from "@/components/Equipe/PermissionsDialog";
import { CreateMemberDialog } from "@/components/Equipe/CreateMemberDialog";
import { TeamDialog, TeamDetailDialog } from "@/components/Equipe/TeamDialogs";
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
          {canManageTeams && (
            <div className="flex gap-2">
              <Button onClick={() => setCreateOpen(true)} className="rounded-xl font-black gap-2">
                <KeyRound className="h-4 w-4" />Criar com senha
              </Button>
            </div>
          )}
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
                {canManageTeams && (
                  <Button onClick={() => setCreateOpen(true)} className="rounded-xl font-black gap-2 mt-1">
                    <Plus className="h-4 w-4" />Adicionar Membro
                  </Button>
                )}
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
                      {!isMe && canManageTeams && (
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
