// Coluna "Performance Hub" (pontuação, tarefas, processos, clientes) — extraída de pages/Perfil.tsx.
import { Award } from "lucide-react";
import type { useMyStats } from "@/hooks/useMyStats";

export function PerformanceHub({ myStats }: { myStats: ReturnType<typeof useMyStats> }) {
  return (
    <div className="glass-card p-8 rounded-[2.5rem] border-border bg-card/40 shadow-premium space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black flex items-center gap-3 text-foreground">
          <Award className="h-6 w-6 text-primary" />
          Performance Hub
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-all text-center shadow-inner">
          <p className="text-4xl font-black text-primary mb-1">{myStats.loading ? "…" : myStats.isError ? "—" : myStats.pontos}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Pontuação Meritocrática</p>
        </div>

        <div className="p-6 rounded-3xl bg-background/50 border border-border hover:bg-card transition-all text-center shadow-inner">
          <p className="text-4xl font-black mb-1 text-foreground">{myStats.loading ? "…" : myStats.isError ? "—" : myStats.tarefasConcluidas}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Tarefas Concluídas</p>
        </div>
      </div>

      {myStats.isError && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <span>Não foi possível carregar suas estatísticas.</span>
          <button type="button" onClick={myStats.refetch} className="font-bold underline shrink-0">Tentar novamente</button>
        </div>
      )}
      <div className="space-y-4 pt-4 border-t border-border/50">
        <div className="flex justify-between items-center px-2">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Processos Ativos</span>
          <span className="text-lg font-black text-foreground">{myStats.loading ? "…" : myStats.isError ? "—" : myStats.processosAtivos}</span>
        </div>
        <div className="flex justify-between items-center px-2">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Processos Finalizados</span>
          <span className="text-lg font-black text-foreground">{myStats.loading ? "…" : myStats.isError ? "—" : myStats.processosFinalizados}</span>
        </div>
        <div className="flex justify-between items-center px-2">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Clientes Cadastrados</span>
          <span className="text-lg font-black text-foreground">{myStats.loading ? "…" : myStats.isError ? "—" : myStats.clientesAtendidos}</span>
        </div>
      </div>
    </div>
  );
}
