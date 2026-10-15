// Diálogo "Lançar manualmente / Editar registro" — extraído de pages/Timesheet.tsx
// sem mudança de comportamento. O estado e o save vêm de useTimesheetManualEntry.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PenLine, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIMESHEET_CATEGORIAS } from "@/types/timesheet";
import type { useTimesheetManualEntry } from "@/hooks/useTimesheetManualEntry";
import { NONE, CATEGORIA_CONFIG } from "@/components/Timesheet/shared";

interface Props {
  manual: ReturnType<typeof useTimesheetManualEntry>;
  clientes: { id: string; nome: string }[];
  rateParaCliente: (clienteId?: string | null) => number | null | undefined;
}

export function ManualEntryDialog({ manual, clientes, rateParaCliente }: Props) {
  const {
    manualOpen, setManualOpen, editTarget,
    mDesc, setMDesc, mCat, setMCat, mCli, setMCli, mData, setMData,
    mInicio, setMInicio, mFim, setMFim, mFat, setMFat, mValor, setMValor, mObs, setMObs, mSaving,
    saveManual,
  } = manual;

  return (
    <Dialog open={manualOpen} onOpenChange={setManualOpen}>
    <DialogContent aria-describedby={undefined} className="sm:max-w-md rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 pt-5 pb-4 border-b border-black/5 dark:border-border shrink-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black text-base">
            <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center"><PenLine className="h-3.5 w-3.5 text-primary" /></div>
            {editTarget ? "Editar registro" : "Lançar manualmente"}
          </DialogTitle>
        </DialogHeader>
      </div>

      <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Atividade</Label>
          <Input value={mDesc} onChange={e => setMDesc(e.target.value)} placeholder="Descrição da atividade" className="h-10 rounded-xl" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Categoria</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {TIMESHEET_CATEGORIAS.map(cat => {
              const cfg = CATEGORIA_CONFIG[cat]; const active = mCat === cat;
              return (
                <button key={cat} type="button" onClick={() => setMCat(cat)}
                  className={cn("flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all text-[8px] font-black uppercase tracking-wider", active ? cn("border-primary/40 shadow-sm", cfg.color) : "border-black/5 dark:border-border text-muted-foreground/60 hover:border-primary/20")}>
                  <cfg.Icon className="h-3.5 w-3.5" />{cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Data</Label>
            <Input type="date" value={mData} onChange={e => setMData(e.target.value)} className="h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Início</Label>
            <Input type="time" value={mInicio} onChange={e => setMInicio(e.target.value)} className="h-10 rounded-xl text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Fim</Label>
            <Input type="time" value={mFim} onChange={e => setMFim(e.target.value)} className="h-10 rounded-xl text-sm" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Cliente <span className="text-muted-foreground/40 normal-case font-medium tracking-normal">— opcional</span></Label>
          <Select value={mCli || NONE} onValueChange={v => { const id = v === NONE ? "" : v; setMCli(id); const r = rateParaCliente(id); if (r != null) setMValor(String(r)); }}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Sem cliente" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={NONE}>Sem cliente</SelectItem>
              {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 rounded-xl border border-black/5 dark:border-border bg-card/40 p-3">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Faturável</Label>
            <Switch checked={mFat} onCheckedChange={setMFat} />
          </div>
          {mFat && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">R$/hora</span>
              <Input type="number" min={0} step="0.01" value={mValor} onChange={e => setMValor(e.target.value)} placeholder="Ex: 350" className="h-9 rounded-lg text-sm" />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Observações</Label>
          <Textarea value={mObs} onChange={e => setMObs(e.target.value)} rows={2} className="rounded-xl text-sm resize-none" placeholder="Opcional" />
        </div>
      </div>

      <div className="px-5 pb-5 flex gap-2 justify-end border-t border-black/5 dark:border-border pt-3 shrink-0">
        <Button variant="ghost" onClick={() => setManualOpen(false)} className="rounded-xl">Cancelar</Button>
        <Button onClick={saveManual} disabled={!mDesc.trim() || !mCat || mSaving} className="rounded-xl font-black shadow-premium px-6">{mSaving ? "Salvando..." : editTarget ? "Salvar" : "Lançar"}</Button>
      </div>
    </DialogContent>
  </Dialog>
  );
}
