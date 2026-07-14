import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const OPCOES = [1, 2, 3, 5, 7, 15, 30];

/**
 * Seletor de antecedências do aviso POR ITEM, com MÚLTIPLOS marcos.
 * value: null = usa o padrão geral do usuário; [] = não avisar; [15,7] = avisar nesses dias antes.
 */
export function AvisoDiasSelect({ value, onChange }: {
  value: number[] | null | undefined;
  onChange: (v: number[] | null) => void;
}) {
  const usarPadrao = value == null;
  const dias = value || [];

  const toggle = (d: number) => {
    const set = new Set(dias);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    onChange(Array.from(set).sort((a, b) => a - b));
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <Switch checked={usarPadrao} onCheckedChange={(v) => onChange(v ? null : [])} />
        <span className="text-xs font-semibold text-muted-foreground">Usar padrão geral</span>
      </label>
      {!usarPadrao && (
        <div className="flex flex-wrap items-center gap-1.5">
          {OPCOES.map((d) => {
            const on = dias.includes(d);
            return (
              <button key={d} type="button" onClick={() => toggle(d)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all",
                  on ? "bg-primary text-primary-foreground border-primary" : "bg-card border-black/10 dark:border-border text-muted-foreground hover:border-primary/40"
                )}>
                {d}d
              </button>
            );
          })}
          {dias.length === 0 && <span className="text-[11px] text-muted-foreground/70 ml-1">Nenhum marcado = não avisar</span>}
        </div>
      )}
    </div>
  );
}

// Componente extra: permite escolher vários marcos (ex.: 15 e 7 dias) simultaneamente.
export const AvisoDiasMulti = AvisoDiasSelect;
