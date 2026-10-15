// Aviso de série de recorrência acabando (estender +4 / dispensar) — extraído de pages/Tarefas.tsx.
import { Button } from "@/components/ui/button";
import { Repeat, Plus, X } from "lucide-react";
import { recorrenciaLabel } from "@/lib/recorrencia";

export interface SerieAcabando { grupo: string; titulo: string; regra: string; restantes: number }

export function SerieAcabandoAviso({ serie: s, extending, onExtend, onDismiss }: { serie: SerieAcabando; extending: boolean; onExtend: () => void; onDismiss: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06]">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0"><Repeat className="h-4 w-4" /></div>
        <p className="text-sm font-semibold min-w-0">
          A recorrência <span className="font-black">"{s.titulo}"</span> ({recorrenciaLabel(s.regra)}) está acabando —{" "}
          {s.restantes === 0
            ? "esta é a última ocorrência."
            : <>gerará apenas mais <span className="font-black text-amber-600 dark:text-amber-400">{s.restantes}</span>.</>}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={onExtend} disabled={extending}
          className="rounded-xl h-9 gap-1.5 font-bold bg-amber-500 hover:bg-amber-600 text-white">
          <Plus className="h-3.5 w-3.5" /> Estender +4
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}
          className="rounded-xl h-9 gap-1.5 font-bold text-muted-foreground">
          <X className="h-3.5 w-3.5" /> Dispensar
        </Button>
      </div>
    </div>
  );
}
