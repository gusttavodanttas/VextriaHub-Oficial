import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";
import { DashPrefs, BLOCK_LABELS } from "@/hooks/useDashboardPrefs";

const ACTIONS: { key: string; label: string }[] = [
  { key: "processo", label: "Novo Processo" },
  { key: "prazo", label: "Novo Prazo" },
  { key: "agendar", label: "Agendar" },
  { key: "cliente", label: "Novo Cliente" },
  { key: "timesheet", label: "Timesheet" },
  { key: "atendimento", label: "Atendimento" },
  { key: "audiencia", label: "Audiência" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  prefs: DashPrefs;
  toggle: (group: "widgets" | "actions", k: string, v: boolean) => void;
  move: (k: string, dir: -1 | 1) => void;
  canViewMetas: boolean;
}

export function DashboardCustomize({ open, onClose, prefs, toggle, move, canViewMetas }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-[2rem] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">Personalizar painel</DialogTitle>
          <DialogDescription>Ative, esconda e reordene os blocos do seu dashboard.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Blocos com ordem */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Blocos (arraste a ordem com as setas)</p>
            <div className="grid gap-2">
              {prefs.order.map((k, idx) => {
                const disabled = k === "metas" && !canViewMetas;
                const checked = !disabled && !!prefs.widgets[k];
                return (
                  <div key={k} className={`flex items-center gap-2 p-2.5 rounded-xl border border-black/5 dark:border-border ${disabled ? "opacity-50" : ""}`}>
                    <div className="flex flex-col">
                      <button type="button" onClick={() => move(k, -1)} disabled={idx === 0}
                        className="h-4 w-5 flex items-center justify-center text-muted-foreground/50 hover:text-foreground disabled:opacity-20" aria-label="Mover para cima">
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => move(k, 1)} disabled={idx === prefs.order.length - 1}
                        className="h-4 w-5 flex items-center justify-center text-muted-foreground/50 hover:text-foreground disabled:opacity-20" aria-label="Mover para baixo">
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="flex-1 text-sm font-bold">
                      {BLOCK_LABELS[k] || k}
                      {disabled && <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Premium</span>}
                    </span>
                    <Switch checked={checked} onCheckedChange={(v) => toggle("widgets", k, v)} disabled={disabled} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Ações rápidas (abrem em modal)</p>
            <div className="grid gap-2">
              {ACTIONS.map((a) => (
                <div key={a.key} className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-black/5 dark:border-border">
                  <span className="text-sm font-bold">{a.label}</span>
                  <Switch checked={!!prefs.actions[a.key]} onCheckedChange={(v) => toggle("actions", a.key, v)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
