// Card de estatística clicável (filtra a lista) — extraído de pages/Tarefas.tsx.
import { cn } from "@/lib/utils";

export function StatCard({ icon: Icon, label, value, color, bg, active, onClick }: { icon: React.ElementType; label: string; value: number; color: string; bg: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-4 rounded-2xl border bg-card/40 text-left transition-all hover:shadow-md hover:border-black/10 dark:hover:border-white/15",
        active ? "border-primary/50 ring-2 ring-primary/15 bg-primary/[0.03]" : "border-black/5 dark:border-border"
      )}>
      <div className={cn("p-2.5 rounded-xl shrink-0", bg)}><Icon className={cn("h-5 w-5", color)} /></div>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none">{value}</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mt-1">{label}</p>
      </div>
    </button>
  );
}
