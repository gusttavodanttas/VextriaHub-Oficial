// Diálogo "Iniciar Timer" (atividade, categoria, cliente, vínculo, faturamento) —
// extraído de pages/Timesheet.tsx sem mudança de comportamento. O estado e os
// handlers vêm de useTimesheetTimer; aqui só a apresentação.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Timer, Play, UserCircle, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIMESHEET_CATEGORIAS, type TimesheetCategoria } from "@/types/timesheet";
import type { useTimesheetTimer } from "@/hooks/useTimesheetTimer";
import { NONE, CATEGORIA_CONFIG, REFERENCIA_CONFIG, CATEGORIA_TO_REF, REF_LIVRES } from "@/components/Timesheet/shared";

interface Props {
  timer: ReturnType<typeof useTimesheetTimer>;
  clientes: { id: string; nome: string }[];
  /** Valor/hora configurado para o cliente (ou o padrão do escritório). */
  rateParaCliente: (clienteId?: string | null) => number | null | undefined;
}

export function NovoTimerDialog({ timer, clientes, rateParaCliente }: Props) {
  const {
    dialogOpen, setDialogOpen, saving,
    descricao, setDescricao, categoria, clienteId, setClienteId,
    faturavel, setFaturavel, valorHora, setValorHora,
    refTipo, setRefTipo, refItems, setRefItems, refLoading, refError, refId, setRefId, setRefLabel,
    handleSetCategoria, resetDialog, handleStart,
  } = timer;

  return (
    <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetDialog(); }}>
    <DialogContent aria-describedby={undefined} className="sm:max-w-md rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 pt-5 pb-4 border-b border-black/5 dark:border-border shrink-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black text-base">
            <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center"><Timer className="h-3.5 w-3.5 text-primary" /></div>
            Iniciar Timer
          </DialogTitle>
        </DialogHeader>
      </div>

      <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-primary/15 text-primary text-[9px] font-black flex items-center justify-center">1</span> Atividade</Label>
          <Input placeholder="Ex: Elaboração de petição inicial..." value={descricao} onChange={e => setDescricao(e.target.value)} className="h-10 rounded-xl" onKeyDown={e => e.key === "Enter" && handleStart()} autoFocus />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-primary/15 text-primary text-[9px] font-black flex items-center justify-center">2</span> Categoria</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {TIMESHEET_CATEGORIAS.map(cat => {
              const cfg = CATEGORIA_CONFIG[cat]; const active = categoria === cat;
              return (
                <button key={cat} type="button" onClick={() => handleSetCategoria(cat)}
                  className={cn("flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all text-[8px] font-black uppercase tracking-wider", active ? cn("border-primary/40 shadow-sm", cfg.color) : "border-black/5 dark:border-border text-muted-foreground/60 hover:border-primary/20 hover:bg-black/[0.02]")}>
                  <cfg.Icon className="h-3.5 w-3.5" />{cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-primary/15 text-primary text-[9px] font-black flex items-center justify-center">3</span> Cliente / Lead <span className="text-muted-foreground/40 normal-case font-medium tracking-normal">— opcional</span></Label>
          <Select value={clienteId || NONE} onValueChange={v => { const id = v === NONE ? "" : v; setClienteId(id); const r = rateParaCliente(id); if (r != null) setValorHora(String(r)); setRefTipo(CATEGORIA_TO_REF[categoria as TimesheetCategoria] ?? ""); setRefItems([]); setRefId(""); setRefLabel(""); }}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={NONE}>Sem cliente</SelectItem>
              {clientes.map(c => <SelectItem key={c.id} value={c.id}><div className="flex items-center gap-2"><UserCircle className="h-3.5 w-3.5 text-muted-foreground" />{c.nome}</div></SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {categoria && (
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-primary/15 text-primary text-[9px] font-black flex items-center justify-center">4</span> {CATEGORIA_TO_REF[categoria as TimesheetCategoria] ? `Vincular ${REFERENCIA_CONFIG[CATEGORIA_TO_REF[categoria as TimesheetCategoria]!].label}` : "Vincular a"} <span className="text-muted-foreground/40 normal-case font-medium tracking-normal">— opcional</span></Label>
            {!CATEGORIA_TO_REF[categoria as TimesheetCategoria] && (
              <div className="flex gap-1.5">
                {REF_LIVRES.map(key => {
                  const cfg = REFERENCIA_CONFIG[key]; const active = refTipo === key;
                  return (
                    <button key={key} type="button" onClick={() => { setRefTipo(active ? "" : key); setRefId(""); setRefLabel(""); setRefItems([]); }}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all", active ? cn("border-transparent shadow-sm", cfg.color) : "border-black/8 dark:border-border text-muted-foreground/60 hover:border-primary/20")}>
                      <cfg.Icon className="h-3 w-3" />{cfg.label}
                    </button>
                  );
                })}
              </div>
            )}
            {refTipo && (
              refLoading ? <Skeleton className="h-10 rounded-xl" /> :
              refError ? (
                <p className="text-xs font-bold text-destructive py-2.5 px-3 rounded-xl bg-destructive/5 border border-destructive/20 text-center">{refError}</p>
              ) : refItems.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 py-2.5 px-3 rounded-xl bg-muted/10 border border-black/5 dark:border-border text-center">{clienteId ? "Nenhum item encontrado para este cliente" : "Nenhum item encontrado"}</p>
              ) : (
                <Select value={refId} onValueChange={v => { setRefId(v); setRefLabel(refItems.find(i => i.id === v)?.label ?? ""); }}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder={`Selecionar ${REFERENCIA_CONFIG[refTipo].label.toLowerCase()}...`} /></SelectTrigger>
                  <SelectContent>
                    {refItems.map(item => <SelectItem key={item.id} value={item.id}><div className="flex flex-col"><span className="text-xs font-semibold">{item.label}</span>{item.sublabel && <span className="text-[10px] text-muted-foreground">{item.sublabel}</span>}</div></SelectItem>)}
                  </SelectContent>
                </Select>
              )
            )}
          </div>
        )}

        {/* ⑤ Faturamento */}
        <div className="space-y-2 rounded-xl border border-black/5 dark:border-border bg-card/40 p-3">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Faturável</Label>
            <Switch checked={faturavel} onCheckedChange={setFaturavel} />
          </div>
          {faturavel && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">R$/hora</span>
              <Input type="number" min={0} step="0.01" value={valorHora} onChange={e => setValorHora(e.target.value)} placeholder="Ex: 350" className="h-9 rounded-lg text-sm" />
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 flex gap-2 justify-end border-t border-black/5 dark:border-border pt-3 shrink-0">
        <Button variant="ghost" onClick={() => { setDialogOpen(false); resetDialog(); }} className="rounded-xl">Cancelar</Button>
        <Button onClick={handleStart} disabled={!descricao || !categoria || saving} className="rounded-xl font-black shadow-premium px-6"><Play className="h-4 w-4 mr-2 fill-current" />{saving ? "Iniciando..." : "Iniciar Timer"}</Button>
      </div>
    </DialogContent>
  </Dialog>
  );
}
