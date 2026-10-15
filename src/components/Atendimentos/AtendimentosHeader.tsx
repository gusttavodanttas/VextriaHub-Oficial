// Cabeçalho da página de Atendimentos (extraído de pages/Atendimentos.tsx):
// título, alternância lista/semana, gerenciar tipos e novo atendimento.
import { MessageSquare, Plus, Settings2, CalendarDays, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";

export type VisaoAtendimentos = "lista" | "semana";

interface Props {
  view: VisaoAtendimentos;
  onView: (v: VisaoAtendimentos) => void;
  /** Os tipos extras gravam em offices.settings (só admin do escritório). */
  canManageOfficeSettings: boolean;
  onGerenciarTipos: () => void;
  onNovo: () => void;
}

export function AtendimentosHeader({ view, onView, canManageOfficeSettings, onGerenciarTipos, onNovo }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <MessageSquare className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Atendimentos</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Registre e acompanhe todos os atendimentos do escritório.
          </p>
        </div>
      </div>
      <div className="flex gap-2 w-full sm:w-auto">
        {/* Alternar visão */}
        <div className="flex items-center rounded-xl border border-black/8 dark:border-border bg-card/60 p-0.5 shrink-0">
          <Button size="icon" variant={view === "lista" ? "secondary" : "ghost"}
            onClick={() => onView("lista")} className="h-10 w-10 rounded-lg" title="Visão em lista" aria-label="Visão em lista">
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button size="icon" variant={view === "semana" ? "secondary" : "ghost"}
            onClick={() => onView("semana")} className="h-10 w-10 rounded-lg" title="Visão semanal" aria-label="Visão semanal">
            <CalendarDays className="h-4 w-4" />
          </Button>
        </div>
        {canManageOfficeSettings && (
          <Button size="icon" variant="outline" onClick={onGerenciarTipos}
            className="h-11 w-11 rounded-xl shrink-0" title="Gerenciar tipos de atendimento" aria-label="Gerenciar tipos de atendimento">
            <Settings2 className="h-4 w-4" />
          </Button>
        )}
        <PermissionGuard permission="canCreateAtendimentos">
          <Button size="lg" onClick={onNovo}
            className="flex-1 sm:flex-none rounded-xl h-11 px-3 sm:px-6 font-black uppercase text-xs tracking-widest shadow-premium">
            <Plus className="mr-1.5 sm:mr-2 h-4 w-4" /><span className="sm:hidden">Novo</span><span className="hidden sm:inline">Novo Atendimento</span>
          </Button>
        </PermissionGuard>
      </div>
    </div>
  );
}
