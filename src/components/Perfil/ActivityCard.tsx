// Atividade recente do usuário — extraído de pages/Perfil.tsx sem mudança de comportamento.
import { useNavigate } from "react-router-dom";
import { Activity, Loader2, ChevronRight } from "lucide-react";
import { useMyActivity } from "@/hooks/useMyActivity";
import { cn } from "@/lib/utils";

export function ActivityCard() {
  const navigate = useNavigate();
  const { items, loading, isError, refetch } = useMyActivity(8);
  const dotColor: Record<string, string> = {
    Processo: "bg-blue-500",
    Tarefa: "bg-emerald-500",
    Atendimento: "bg-amber-500",
  };
  return (
    <div className="glass-card p-6 md:p-8 rounded-[2.5rem] border-border bg-card/40 shadow-premium space-y-4">
      <h3 className="text-xl font-black flex items-center gap-3 text-foreground">
        <Activity className="h-6 w-6 text-primary" />
        Atividade Recente
      </h3>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary/40" /></div>
      ) : isError ? (
        // Antes o erro caía em "Nenhuma atividade ainda."
        <div className="text-center py-8 space-y-2">
          <p className="text-sm font-bold text-destructive">Não foi possível carregar sua atividade.</p>
          <button type="button" onClick={refetch} className="text-xs font-bold underline">Tentar novamente</button>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground font-medium">Nenhuma atividade ainda.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Seus processos, tarefas e atendimentos aparecem aqui.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => navigate(it.link)}
              className="group w-full flex items-center gap-3 p-3 rounded-2xl border border-transparent hover:border-primary/20 hover:bg-primary/[0.03] transition-all text-left"
            >
              <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", dotColor[it.tipo])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{it.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-black uppercase tracking-wide">{it.tipo}</span>
                  {" · "}
                  {new Date(it.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
