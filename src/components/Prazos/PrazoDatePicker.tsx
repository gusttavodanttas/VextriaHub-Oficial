import { useState } from "react";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toISO, fromISO } from "@/lib/prazoCalc";

// ─────────────────────────────────────────────
// DatePicker — input nativo + mini calendário (usado no diálogo de prazo)
// ─────────────────────────────────────────────
interface DatePickerProps {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  highlight?: boolean;
  placeholder?: string;
}
export function PrazoDatePicker({ value, onChange, required, highlight, placeholder }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? fromISO(value) : undefined;

  return (
    <div className="flex items-center gap-1">
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className={cn(
          "w-32 h-8 px-2 rounded-lg text-xs bg-background border text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all",
          highlight ? "border-emerald-500/40" : "border-border"
        )}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-lg border transition-all",
              "hover:bg-muted/60 hover:border-primary/30",
              open ? "border-primary/40 bg-primary/5" : "border-border",
              highlight && "border-emerald-500/30 bg-emerald-500/5"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={d => { if (d) { onChange(toISO(d)); setOpen(false); } }}
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
