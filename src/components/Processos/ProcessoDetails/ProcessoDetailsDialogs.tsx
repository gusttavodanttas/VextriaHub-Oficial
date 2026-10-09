import React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, History, RotateCw, Sparkles } from 'lucide-react';
import type { ResumoProcesso } from '@/hooks/useAiAdvisor';
import type { Movimentacoes } from './helpers';

// Diálogos secundários do drawer: confirmação de andamentos vindos da fonte
// (DataJud/PJe) e o resumo do processo gerado pelo Conselheiro IA.

export function AndamentosConfirmDialog({ mov }: { mov: Movimentacoes }) {
  const { andamentoConfirm, setAndamentoConfirm, confirmAndamentos, syncing } = mov;
  return (
    <Dialog open={!!andamentoConfirm} onOpenChange={(o) => { if (!o) setAndamentoConfirm(null); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-lg rounded-[2rem]">
        <DialogTitle className="flex items-center gap-2 text-lg font-black">
          <span className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><History className="h-4 w-4" /></span>
          {andamentoConfirm?.novos.length} novo(s) andamento(s) encontrado(s)
        </DialogTitle>
        <p className="text-xs text-muted-foreground -mt-1">Revise antes de adicionar ao histórico do processo.</p>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pt-1">
          {andamentoConfirm?.novos.map((a, i: number) => (
            <div key={i} className="p-3 rounded-xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01]">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                {a.data ? new Date(a.data).toLocaleDateString('pt-BR') : '—'}
              </p>
              <p className="text-sm font-medium leading-snug mt-0.5">{a.descricao || a.resumo || 'Movimentação'}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Button onClick={confirmAndamentos} disabled={syncing} className="flex-1 rounded-xl font-bold">
            {syncing ? <RotateCw className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Adicionar {andamentoConfirm?.novos.length} andamento(s)
          </Button>
          <Button variant="outline" onClick={() => setAndamentoConfirm(null)} className="rounded-xl">Agora não</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ResumoIADialog({ open, onOpenChange, loading, resumo }: {
  open: boolean; onOpenChange: (o: boolean) => void; loading: boolean; resumo: ResumoProcesso | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-lg rounded-[2rem]">
        <DialogTitle className="flex items-center gap-2 text-lg font-black">
          <span className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Sparkles className="h-4 w-4" /></span>
          Resumo do processo (IA)
        </DialogTitle>
        {loading ? (
          <div className="py-12 flex flex-col items-center gap-3 opacity-60">
            <RotateCw className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs font-black uppercase tracking-widest">Analisando andamentos…</p>
          </div>
        ) : resumo ? (
          <div className="space-y-4 pt-1">
            {resumo.resumo && <p className="text-sm leading-relaxed text-foreground/90">{resumo.resumo}</p>}
            {resumo.situacao_atual && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/15">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Situação atual</p>
                <p className="text-sm font-semibold">{resumo.situacao_atual}</p>
              </div>
            )}
            {resumo.proximos_passos && resumo.proximos_passos.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Próximos passos</p>
                <ul className="space-y-1.5">
                  {resumo.proximos_passos.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="h-5 w-5 rounded-lg bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/50 pt-1">Gerado por IA a partir dos andamentos. Revise antes de agir — a IA pode errar.</p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
