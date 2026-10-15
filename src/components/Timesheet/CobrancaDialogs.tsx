// Diálogos de confirmação do timesheet (gerar cobrança, estornar, finalizar timer
// com observação) — extraídos de pages/Timesheet.tsx sem mudança de comportamento.
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Receipt, DollarSign, Square, Loader2 } from "lucide-react";
import { formatBRL, formatSeconds } from "@/components/Timesheet/shared";

export function GerarCobrancaDialog({ cobrarOpen, setCobrarOpen, cobrando, totalValor, pendentes, gerarCobranca }: {
  cobrarOpen: boolean; setCobrarOpen: (o: boolean) => void; cobrando: boolean;
  totalValor: number; pendentes: number; gerarCobranca: () => Promise<void>;
}) {
  return (
  <Dialog open={cobrarOpen} onOpenChange={(o) => { if (!o && !cobrando) setCobrarOpen(false); }}>
    <DialogContent aria-describedby={undefined} className="sm:max-w-sm rounded-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-black text-base">
          <div className="h-7 w-7 rounded-lg bg-amber-500/15 flex items-center justify-center"><Receipt className="h-3.5 w-3.5 text-amber-600" /></div>
          Gerar cobrança no Financeiro
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3 pt-1">
        <p className="text-sm text-muted-foreground">
          Serão criadas receitas pendentes no Financeiro (categoria <strong>Honorários</strong>), uma por cliente, totalizando{" "}
          <strong className="text-amber-600">{formatBRL(totalValor)}</strong> ({pendentes} registro{pendentes !== 1 ? "s" : ""}). Os registros são marcados como <strong>faturados</strong>.
        </p>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" onClick={() => setCobrarOpen(false)} disabled={cobrando} className="rounded-xl">Cancelar</Button>
          <Button onClick={gerarCobranca} disabled={cobrando} className="rounded-xl font-black px-5 bg-amber-500 hover:bg-amber-600 text-white">
            {cobrando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DollarSign className="h-4 w-4 mr-2" />}Gerar
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
  );
}

export function EstornoDialog({ estornoId, setEstornoId, estornarCobranca }: {
  estornoId: string | null; setEstornoId: (id: string | null) => void; estornarCobranca: (id: string) => Promise<unknown>;
}) {
  return (
  <Dialog open={!!estornoId} onOpenChange={(o) => { if (!o) setEstornoId(null); }}>
    <DialogContent aria-describedby={undefined} className="sm:max-w-sm rounded-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-black text-base">
          <div className="h-7 w-7 rounded-lg bg-rose-500/15 flex items-center justify-center"><Receipt className="h-3.5 w-3.5 text-rose-600" /></div>
          Estornar cobrança
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3 pt-1">
        <p className="text-sm text-muted-foreground">
          A receita gerada no Financeiro será <strong>removida</strong> e os registros de timesheet ligados a ela voltam a ficar <strong>não faturados</strong>. Deseja continuar?
        </p>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" onClick={() => setEstornoId(null)} className="rounded-xl">Cancelar</Button>
          <Button variant="destructive" onClick={async () => { const id = estornoId!; setEstornoId(null); await estornarCobranca(id); }} className="rounded-xl font-black px-5">
            Estornar
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
  );
}

export function FinalizarTimerDialog({ finalizeId, setFinalizeId, finalizeObs, setFinalizeObs, elapsedTime, stopTimer }: {
  finalizeId: string | null; setFinalizeId: (id: string | null) => void;
  finalizeObs: string; setFinalizeObs: (v: string) => void; elapsedTime: number;
  stopTimer: (id: string, obs?: string) => Promise<unknown>;
}) {
  return (
  <Dialog open={!!finalizeId} onOpenChange={(o) => { if (!o) setFinalizeId(null); }}>
    <DialogContent aria-describedby={undefined} className="sm:max-w-sm rounded-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-black text-base">
          <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center"><Square className="h-3.5 w-3.5 text-primary fill-current" /></div>
          Finalizar timer
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3 pt-1">
        <div className="text-center text-2xl font-black tabular-nums">{formatSeconds(elapsedTime)}</div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Observação <span className="text-muted-foreground/40 normal-case font-medium tracking-normal">— opcional</span></Label>
          <Textarea value={finalizeObs} onChange={e => setFinalizeObs(e.target.value)} rows={2} className="rounded-xl text-sm resize-none" placeholder="O que foi feito?" />
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" onClick={() => setFinalizeId(null)} className="rounded-xl">Cancelar</Button>
          <Button variant="destructive" onClick={async () => { const id = finalizeId!; setFinalizeId(null); await stopTimer(id, finalizeObs.trim() || undefined); }} className="rounded-xl font-black px-5">
            <Square className="h-4 w-4 mr-2 fill-current" />Finalizar
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
  );
}
