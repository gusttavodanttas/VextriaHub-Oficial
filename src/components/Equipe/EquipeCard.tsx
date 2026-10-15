// Card de equipe (extraído de pages/Equipe.tsx): cor, nome, contagem de membros
// e atalhos de produtividade/editar/excluir.
import { Trash2, Pencil, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { OfficeTeam } from "@/hooks/useOfficeTeams";

interface Props {
  team: OfficeTeam;
  /** Admin do escritório ou quem recebeu canManageEquipe (espelha a RLS de office_teams). */
  canManage: boolean;
  onAbrir: (team: OfficeTeam) => void;
  onProdutividade: (team: OfficeTeam) => void;
  onEditar: (team: OfficeTeam) => void;
  onExcluir: (team: OfficeTeam) => void | Promise<void>;
}

export function EquipeCard({ team, canManage, onAbrir, onProdutividade, onEditar, onExcluir }: Props) {
  return (
    <div
      className="group bg-card border border-black/5 dark:border-border rounded-2xl shadow-premium hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-4 cursor-pointer"
      onClick={() => onAbrir(team)}>
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
            onClick={() => onProdutividade(team)}>
            <BarChart2 className="h-3.5 w-3.5" />
          </Button>
          {canManage && (
          <Button size="sm" variant="ghost" className="h-7 w-7 rounded-lg hover:bg-muted/60" title="Editar equipe"
            onClick={() => onEditar(team)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          )}
          {canManage && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" title="Excluir equipe" className="h-7 w-7 rounded-lg text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir equipe "{team.name}"?</AlertDialogTitle>
                <AlertDialogDescription>Os membros não serão removidos do escritório, apenas desta equipe. Processos, clientes e metas vinculados a esta equipe ficarão sem equipe (não são excluídos, só somem da visão por time).</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onExcluir(team)}
                  className="rounded-xl bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
