// Índice de mistura patrimonial PJ/PF (extraído de pages/Financeiro.tsx).
// Não renderiza nada quando não há despesas — a página decide ocultar também
// durante o carregamento/erro.
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt } from "./shared";
import { mixingStatusFor, type Mixing } from "./calculos";

export function MixingIndexCard({ mixing }: { mixing: Mixing }) {
  if (mixing.total <= 0) return null;
  const mixingStatus = mixingStatusFor(mixing.index);
  return (
    <div className="glass-card p-6 rounded-3xl shadow-premium border border-black/5 dark:border-border bg-card/40 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Índice de Mistura Patrimonial (PJ x PF)</p>
          <Badge className={cn("px-2.5 py-0.5 rounded-lg text-[9px] uppercase tracking-widest border", mixingStatus.className)}>
            {mixingStatus.label}
          </Badge>
        </div>
        <span className="text-2xl font-black tracking-tighter">{mixing.index.toFixed(1)}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", mixingStatus.barClass)} style={{ width: `${Math.min(mixing.index, 100)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground flex items-start gap-2">
        {mixing.index >= 10 && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-orange-500" />}
        <span>{mixingStatus.text} <span className="font-bold text-foreground">{fmt(mixing.pf)}</span> de despesas pessoais registradas no caixa do escritório.</span>
      </p>
    </div>
  );
}
