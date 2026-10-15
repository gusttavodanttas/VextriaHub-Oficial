// Card de nível / pontos / sequência / meta semanal — extraído de pages/Tarefas.tsx.
import { Trophy, Flame, Target } from "lucide-react";
import type { Game } from "@/lib/tarefasGame";

export function GamificacaoCard({ game }: { game: Game }) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><Trophy className="h-5 w-5" /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Nível {game.nivel}</p>
            <p className="text-lg font-black leading-none">{game.pontos} <span className="text-xs font-bold text-muted-foreground">pts</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-xl bg-orange-500/10 text-orange-500">
          <Flame className="h-4 w-4" />
          <span className="text-sm font-black">{game.streak}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest">dia{game.streak === 1 ? "" : "s"} seguidos</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-1.5">
            <span className="text-muted-foreground/70 flex items-center gap-1.5"><Target className="h-3 w-3" /> Meta semanal</span>
            <span className="text-primary">{game.concluidasSemana} / {game.metaSemanal}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-black/5 dark:bg-muted/30 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500" style={{ width: `${game.progresso}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
