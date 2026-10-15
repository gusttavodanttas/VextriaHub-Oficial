import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useInvitations } from "@/hooks/useInvitations";
import { useOfficeTeams, type OfficeTeam } from "@/hooks/useOfficeTeams";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, Search, Clock, Send, Crown, KeyRound, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Módulos extraídos deste arquivo (desmonte do god-component) — comportamento idêntico
import { PermissionsDialog } from "@/components/Equipe/PermissionsDialog";
import { CreateMemberDialog } from "@/components/Equipe/CreateMemberDialog";
import { TeamDialog, TeamDetailDialog } from "@/components/Equipe/TeamDialogs";
import { InviteDialog, type ConviteRole } from "@/components/Equipe/InviteDialog";
import { RoleDialog, type MembroRole } from "@/components/Equipe/RoleDialog";
import { MembroCard } from "@/components/Equipe/MembroCard";
import { ConviteCard } from "@/components/Equipe/ConviteCard";
import { EquipeCard } from "@/components/Equipe/EquipeCard";
import { StatCard, EquipeErro, EquipeSkeleton, EquipeVazio } from "@/components/Equipe/EquipeEstados";
import { validarConvite, nomeDoMembro, type MembroEquipe } from "@/components/Equipe/membros";

// ─── main page ───────────────────────────────────────────────────────────────

export default function Equipe() {
  const navigate = useNavigate();
  const { user: me, office, isOfficeAdmin } = useAuth();
  const { canInviteUsers, canManageEquipe } = usePermissions();
  // Só admin/dono DO ESCRITÓRIO gerencia equipes (papel global de app não conta).
  // canManageTeams cobre a gestão de MEMBROS (função, remoção, permissões) e o
  // "Criar com senha" — isso continua exclusivo de admin (a Edge Function que
  // cria membro já reforça isso do lado do servidor). "Convidar por e-mail" e o
  // CRUD de equipes agora também abrem para quem o admin liberou via Permissões
  // (canInviteUsers/canManageEquipe), espelhando as policies RLS de
  // invitations/office_teams.
  const canManageTeams = isOfficeAdmin;
  const canInvite = isOfficeAdmin || canInviteUsers;
  const canManageTeamsRls = isOfficeAdmin || canManageEquipe;
  const { toast } = useToast();
  const { users, loading: usersLoading, error: usersError, removeUser, updateUser, refresh: refreshUsers } = useOfficeUsers();
  const { invitations, loading: invLoading, error: invError, createInvitation, resendInvitation, cancelInvitation, refresh: refreshInvitations, pendingInvitations } = useInvitations();
  const { teams, loading: teamsLoading, error: teamsError, refetch: refetchTeams, create: createTeam, update: updateTeam, remove: removeTeam } = useOfficeTeams();

  const [search, setSearch] = useState("");
  const [tab, setTab]       = useState("membros");

  // dialogs
  const [inviteOpen, setInviteOpen]         = useState(false);
  const [createOpen, setCreateOpen]         = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget]         = useState<{ id: string; name: string; role: string } | null>(null);
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

  // Devolve true para o diálogo fechar e limpar o formulário.
  const handleInvite = async (email: string, role: ConviteRole) => {
    const recusa = validarConvite(email, invitations, users);
    if (recusa) {
      toast({ ...recusa, variant: "destructive" });
      return false;
    }
    const result = await createInvitation({ email, role });
    if ("data" in result) {
      toast({ title: "Convite enviado", description: `Enviamos um e-mail para ${email} com o link de cadastro — ao se cadastrar com esse e-mail, a pessoa entra direto no escritório.` });
      return true;
    }
    toast({ title: "Erro ao registrar convite", description: result.error, variant: "destructive" });
    return false;
  };

  const openRoleEdit = (u: MembroEquipe) => {
    setRoleTarget({ id: u.id, name: nomeDoMembro(u), role: u.role });
    setRoleDialogOpen(true);
  };

  const handleRoleSave = async (newRole: MembroRole) => {
    if (!roleTarget) return;
    const result = await updateUser(roleTarget.id, { role: newRole });
    if (result) {
      toast({ title: "Função atualizada" });
      setRoleDialogOpen(false);
    } else {
      toast({ title: "Não foi possível atualizar a função", description: "Você não tem permissão para esta ação.", variant: "destructive" });
    }
  };

  const semPermissao = (title: string) =>
    ({ title, description: "Você não tem permissão para esta ação.", variant: "destructive" as const });

  const handleRemoveUser = async (u: MembroEquipe) => {
    const ok = await removeUser(u.id);
    toast(ok ? { title: "Membro removido" } : semPermissao("Não foi possível remover"));
  };

  const handleResend = async (id: string) => {
    const r = await resendInvitation(id);
    if (r) toast({ title: "Convite reenviado", description: "Enviamos o e-mail novamente." });
  };

  const handleCancelInvitation = async (id: string) => {
    const ok = await cancelInvitation(id);
    toast(ok ? { title: "Convite excluído" } : semPermissao("Não foi possível excluir"));
  };

  const handleRemoveTeam = async (team: OfficeTeam) => {
    const ok = await removeTeam(team.id);
    toast(ok ? { title: "Equipe excluída" } : semPermissao("Não foi possível excluir"));
  };

  const openNewTeam = () => { setEditingTeam(null); setTeamDialogOpen(true); };

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
          {(canInvite || canManageTeams) && (
            <div className="flex gap-2">
              {canInvite && (
                <Button onClick={() => setInviteOpen(true)} className="rounded-xl font-black gap-2">
                  <Send className="h-4 w-4" />Convidar por e-mail
                </Button>
              )}
              {canManageTeams && (
                <Button onClick={() => setCreateOpen(true)} variant="outline" className="rounded-xl font-bold gap-2">
                  <KeyRound className="h-4 w-4" />Criar com senha
                </Button>
              )}
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
            {usersError ? (
              <EquipeErro titulo="Não foi possível carregar os membros" mensagem={usersError} onRetry={refreshUsers} />
            ) : usersLoading ? (
              <EquipeSkeleton />
            ) : filteredUsers.length === 0 ? (
              <EquipeVazio Icon={Users} titulo="Nenhum membro encontrado">
                {canManageTeams && (
                  <Button onClick={() => setCreateOpen(true)} className="rounded-xl font-black gap-2 mt-1">
                    <Plus className="h-4 w-4" />Adicionar Membro
                  </Button>
                )}
              </EquipeVazio>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map(u => (
                  <MembroCard key={u.id} membro={u} isMe={u.user_id === me?.id} canManage={canManageTeams}
                    onPermissoes={(m) => setPermTarget({ userId: m.user_id, name: nomeDoMembro(m), role: m.role })}
                    onFuncao={openRoleEdit} onRemover={handleRemoveUser} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── convites ── */}
          <TabsContent value="convites" className="mt-4">
            {invError ? (
              <EquipeErro titulo="Não foi possível carregar os convites" mensagem={invError} onRetry={refreshInvitations} />
            ) : invLoading ? (
              <EquipeSkeleton />
            ) : filteredInv.length === 0 ? (
              <EquipeVazio Icon={Send} titulo="Nenhum convite registrado">
                <p className="text-sm text-muted-foreground">Use "Convidar por e-mail" para trazer alguém — a pessoa recebe o link e entra sozinha no escritório.</p>
              </EquipeVazio>
            ) : (
              <div className="space-y-2">
                {filteredInv.map(inv => (
                  <ConviteCard key={inv.id} inv={inv} onRenovar={(i) => handleResend(i.id)} onExcluir={(i) => handleCancelInvitation(i.id)} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── equipes ── */}
          <TabsContent value="equipes" className="mt-4">
            {canManageTeamsRls && (
              <div className="flex justify-end mb-3">
                <Button onClick={openNewTeam} className="rounded-xl font-black gap-2">
                  <Plus className="h-4 w-4" />Nova Equipe
                </Button>
              </div>
            )}
            {teamsError && (
              <div className="flex items-center gap-3 mb-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                <span className="flex-1">{teamsError}</span>
                <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => refetchTeams()}>Tentar novamente</Button>
              </div>
            )}
            {teamsLoading ? (
              <EquipeSkeleton />
            ) : teamsError && teams.length === 0 ? null : teams.length === 0 ? (
              <EquipeVazio Icon={FolderOpen} titulo="Nenhuma equipe criada">
                <p className="text-sm text-muted-foreground">
                  {canManageTeamsRls ? "Crie equipes para organizar os membros por área de atuação." : "Nenhuma equipe foi criada pelo administrador ainda."}
                </p>
                {canManageTeamsRls && (
                  <Button onClick={openNewTeam} className="rounded-xl font-black gap-2 mt-1">
                    <Plus className="h-4 w-4" />Criar primeira equipe
                  </Button>
                )}
              </EquipeVazio>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {teams.map(team => (
                  <EquipeCard key={team.id} team={team} canManage={canManageTeamsRls}
                    onAbrir={setDetailTeam}
                    onProdutividade={(t) => navigate(`/equipe/${t.id}`)}
                    onEditar={(t) => { setEditingTeam(t); setTeamDialogOpen(true); }}
                    onExcluir={handleRemoveTeam} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── invite dialog ─────────────────────────────────────────────── */}
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvite={handleInvite} />

      {/* ── create with password dialog ───────────────────────────────── */}
      {office?.id && (
        <CreateMemberDialog
          open={createOpen} onOpenChange={setCreateOpen}
          officeId={office.id} onSuccess={refreshUsers}
        />
      )}

      {/* ── role dialog ───────────────────────────────────────────────── */}
      <RoleDialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen} target={roleTarget} onSave={handleRoleSave} />

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
          const result = editingTeam
            ? await updateTeam(editingTeam.id, { name, color, description })
            : await createTeam(name, color, description);
          toast(result
            ? { title: editingTeam ? "Equipe atualizada" : "Equipe criada" }
            : semPermissao("Não foi possível salvar"));
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
