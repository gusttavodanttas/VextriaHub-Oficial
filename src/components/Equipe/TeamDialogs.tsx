// Dialogs de times (criar/editar e detalhe com membros) — extraídos de pages/Equipe.tsx.
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
import { getInitials, avatarColor, fmtDate } from "./shared";

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

export { TeamDialog, TeamDetailDialog };
