// Exportar + sincronizar (diário/semanal/mensal) — extraído de pages/Publicacoes.tsx sem mudança de comportamento.
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { Download, RefreshCw, Clock, CalendarDays, CalendarRange, ChevronDown, FileSpreadsheet } from "lucide-react";

interface Props {
  totalFiltered: number;
  isSyncing: boolean;
  onExportCSV: () => void;
  onManualSync: (days: number) => void;
}

export function PublicationsToolbar({ totalFiltered, isSyncing, onExportCSV, onManualSync }: Props) {
  return (
    <div className="flex items-center justify-end gap-4 px-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-12 px-6 rounded-2xl border-border bg-card/50 hover:bg-card font-black text-xs uppercase tracking-widest text-primary gap-2 transition-all duration-300 shadow-md">
            <Download className="h-4 w-4" />
            Exportar
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl bg-card border-black/5 dark:border-border shadow-2xl">
          <DropdownMenuItem onClick={onExportCSV} className="rounded-xl py-3 cursor-pointer group flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs uppercase tracking-tight">CSV / Excel</span>
              <span className="text-[10px] text-muted-foreground/60 italic">{totalFiltered} publicações</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PermissionGuard permission="canManagePublicacoes">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            disabled={isSyncing}
            className="h-12 rounded-2xl px-6 font-black text-xs uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all duration-300 gap-2"
          >
            {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl bg-card border-black/5 dark:border-border shadow-2xl">
          <DropdownMenuLabel className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Período de Busca</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/50" />
          <DropdownMenuItem onClick={() => onManualSync(1)} className="rounded-xl py-3 cursor-pointer group flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs uppercase tracking-tight">Diário</span>
              <span className="text-[10px] text-muted-foreground/60">Últimas 24 horas</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onManualSync(7)} className="rounded-xl py-3 cursor-pointer group flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
              <CalendarDays className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs uppercase tracking-tight">Semanal</span>
              <span className="text-[10px] text-muted-foreground/60">Últimos 7 dias</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onManualSync(30)} className="rounded-xl py-3 cursor-pointer group flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors">
              <CalendarRange className="h-4 w-4 text-violet-500" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs uppercase tracking-tight">Mensal</span>
              <span className="text-[10px] text-muted-foreground/60">Últimos 30 dias</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </PermissionGuard>
    </div>
  );
}
