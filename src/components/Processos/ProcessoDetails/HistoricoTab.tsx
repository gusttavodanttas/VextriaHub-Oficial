import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, History, Plus, RotateCw, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddForm, EmptySub } from './shared';
import { fmtDate, type Movimentacoes } from './helpers';

interface Props {
  mov: Movimentacoes;
  loadingSub: boolean;
  canWrite: boolean;
  isMine: boolean;
  hasIAModule: boolean;
  resumoIALoading: boolean;
  onResumirIA: () => void;
  showAddAndamento: boolean;
  setShowAddAndamento: (v: boolean) => void;
  addLoading: boolean;
  onAddAndamento: (e: React.FormEvent<HTMLFormElement>) => void;
}

/** Aba "Histórico": cronologia de andamentos, andamento manual, sync com a fonte e resumo por IA. */
export function HistoricoTab({
  mov, loadingSub, canWrite, isMine, hasIAModule, resumoIALoading, onResumirIA,
  showAddAndamento, setShowAddAndamento, addLoading, onAddAndamento,
}: Props) {
  const { movements, loadingMovements, syncing, syncFromOrigin, canDeleteMovement, confirmDelMov, setConfirmDelMov, delMovLoading, handleDeleteMovement } = mov;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">
          {syncing ? 'Sincronizando…' : `${movements.length} movimentação(ões)`}
        </p>
        <div className="flex items-center gap-3">
          {canWrite && (
            <Button variant="outline" size="sm" onClick={() => setShowAddAndamento(true)} className="h-7 rounded-xl text-[10px] gap-1 px-3 font-black uppercase tracking-widest">
              <Plus className="h-3 w-3" /> Andamento Manual
            </Button>
          )}
          {isMine && hasIAModule && (
            <Button variant="outline" size="sm" onClick={onResumirIA} disabled={resumoIALoading} className="h-7 rounded-xl text-[10px] gap-1 px-3 font-black uppercase tracking-widest border-primary/30 text-primary hover:bg-primary/5">
              {resumoIALoading ? <RotateCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Resumir com IA
            </Button>
          )}
          {isMine && (
            <button onClick={() => syncFromOrigin()} disabled={syncing} className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-black text-primary/70 hover:text-primary disabled:opacity-30 transition-colors">
              <RotateCw className={cn("h-3 w-3", syncing && "animate-spin")} />
              {syncing ? 'Atualizando' : 'Atualizar'}
            </button>
          )}
        </div>
      </div>

      {showAddAndamento && (
        <AddForm loading={addLoading} onSubmit={onAddAndamento} onCancel={() => setShowAddAndamento(false)}>
          <Input name="descricao" placeholder="Descrição do andamento" required className="h-9 rounded-xl text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <Input name="data" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="h-9 rounded-xl text-sm" />
            <select name="tipo" className="h-9 rounded-xl text-sm border border-border bg-background px-3">
              <option value="despacho">Despacho</option>
              <option value="decisão">Decisão</option>
              <option value="sentença">Sentença</option>
              <option value="petição">Petição</option>
              <option value="audiência">Audiência</option>
              <option value="juntada">Juntada</option>
              <option value="distribuição">Distribuição</option>
              <option value="outro">Outro</option>
            </select>
          </div>
        </AddForm>
      )}
      {loadingMovements && movements.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-40">
          <Clock className="h-10 w-10 animate-pulse text-primary" />
          <p className="text-[10px] font-black uppercase tracking-widest">Consultando cronologia...</p>
        </div>
      ) : movements.length > 0 ? (
        <div className="relative pl-6 space-y-8 border-l-2 border-border ml-2 pt-2 pb-10">
          {movements.map((m) => (
            <div key={m.id} className="relative group">
              <div className="absolute -left-[29px] top-1 h-3.5 w-3.5 rounded-full bg-background border-2 border-primary/40 ring-4 ring-primary/5" />
              <div className="space-y-1.5 pl-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-black text-primary/80 bg-primary/5 px-2.5 py-0.5 rounded-lg">{fmtDate(m.data)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40 font-bold">{m.tipo || 'Andamento'}</span>
                    {canDeleteMovement && (confirmDelMov === m.id ? (
                      <span className="flex items-center gap-1">
                        <button onClick={() => handleDeleteMovement(m.id)} disabled={delMovLoading}
                          className="text-[9px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 disabled:opacity-40">
                          {delMovLoading ? '...' : 'Excluir'}
                        </button>
                        <span className="text-muted-foreground/30">/</span>
                        <button onClick={() => setConfirmDelMov(null)} disabled={delMovLoading}
                          className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDelMov(m.id)} title="Excluir andamento"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-rose-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground/85 leading-relaxed">{m.texto}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptySub icon={History} label="movimentação" loading={loadingSub} />
      )}
    </div>
  );
}
