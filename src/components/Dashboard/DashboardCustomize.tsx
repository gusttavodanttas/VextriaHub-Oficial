import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { DashPrefs } from "@/hooks/useDashboardPrefs";

const WIDGETS: { key: string; label: string; gated?: "metas" }[] = [
  { key: "produtividade", label: "Sua Produtividade" },
  { key: "financeiro", label: "Financeiro do Mês" },
  { key: "grafico", label: "Gráfico Receita x Despesa" },
  { key: "atividade", label: "Atividade Recente" },
  { key: "metas", label: "Metas", gated: "metas" },
];

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
  canViewMetas: boolean;
}

export function DashboardCustomize({ open, onClose, prefs, toggle, canViewMetas }: Props) {
  const Row = ({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border border-black/5 dark:border-border ${disabled ? "opacity-50" : ""}`}>
      <span className="text-sm font-bold">{label}{disabled && <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Premium</span>}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-[2rem] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">Personalizar painel</DialogTitle>
          <DialogDescription>Escolha o que aparece no seu dashboard.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Blocos</p>
            <div className="grid gap-2">
              {WIDGETS.map((w) => {
                const disabled = w.gated === "metas" && !canViewMetas;
                return (
                  <Row key={w.key} label={w.label} disabled={disabled}
                    checked={!disabled && !!prefs.widgets[w.key]}
                    onChange={(v) => toggle("widgets", w.key, v)} />
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Ações rápidas</p>
            <div className="grid gap-2">
              {ACTIONS.map((a) => (
                <Row key={a.key} label={a.label}
                  checked={!!prefs.actions[a.key]}
                  onChange={(v) => toggle("actions", a.key, v)} />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
