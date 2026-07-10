// Painel e dialog de permissões por membro — extraídos de pages/Equipe.tsx.
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
import { PERMISSION_GROUPS, ROLE_LABEL, type PermItem, type PermGroup } from "./shared";

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


export { PermissionsPanel, PermissionsDialog };
