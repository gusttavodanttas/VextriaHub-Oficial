import { useNavigate } from "react-router-dom";
import { useMetas } from "@/hooks/useMetas";
import { Target, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetasWidget() {
  const navigate = useNavigate();
  const { metas, loading } = useMetas();
  const ativas = (metas || []).filter((m) => m.status !== "concluida").slice(0, 3);

  return (
    <div className="rounded-2xl border border-black/5 dark:border-border bg-card/40 p-4 space-y-3 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate("/metas")}>
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
          <Target className="h-3 w-3" /> Metas
        </p>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30" />
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : ativas.length === 0 ? (
        <p className="text-sm text-muted-foreground/60 font-medium py-3 text-center">Nenhuma meta ativa.</p>
      ) : (
        <div className="space-y-3">
          {ativas.map((m) => {
            const pct = m.valorMeta > 0 ? Math.min(100, Math.round((m.valorAtual / m.valorMeta) * 100)) : 0;
            return (
              <div key={m.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold truncate">{m.titulo}</p>
                  <span className={cn("text-[11px] font-black shrink-0", pct >= 100 ? "text-emerald-500" : "text-primary")}>{pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
