import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Plus, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  onCreate: (v: string) => void;
  placeholder?: string;
}

/** Select que também permite criar uma nova opção inline (persistida via onCreate). */
export function CreatableSelect({ value, onChange, options, onCreate, placeholder }: Props) {
  const [adding, setAdding] = useState(false);
  const [novo, setNovo] = useState("");

  const confirmar = () => {
    const v = novo.trim();
    if (v) {
      const existe = options.some((o) => o.toLowerCase() === v.toLowerCase());
      if (!existe) onCreate(v);
      onChange(existe ? options.find((o) => o.toLowerCase() === v.toLowerCase())! : v);
    }
    setNovo("");
    setAdding(false);
  };

  if (adding) {
    return (
      <div className="flex gap-1.5">
        <Input
          autoFocus
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); confirmar(); }
            if (e.key === "Escape") { setAdding(false); setNovo(""); }
          }}
          placeholder="Nova opção…"
          className="h-11 rounded-xl flex-1"
        />
        <Button type="button" size="icon" onClick={confirmar} disabled={!novo.trim()} className="h-11 w-11 rounded-xl shrink-0" aria-label="Confirmar">
          <Check className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="outline" onClick={() => { setAdding(false); setNovo(""); }} className="h-11 w-11 rounded-xl shrink-0" aria-label="Cancelar">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // "Outros" sempre por último
  const sorted = [
    ...options.filter((o) => o.toLowerCase() !== "outros"),
    ...options.filter((o) => o.toLowerCase() === "outros"),
  ];

  return (
    <div className="flex gap-1.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 rounded-xl font-medium flex-1"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {sorted.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button type="button" size="icon" variant="outline" onClick={() => setAdding(true)} className="h-11 w-11 rounded-xl shrink-0" aria-label="Adicionar nova opção">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
