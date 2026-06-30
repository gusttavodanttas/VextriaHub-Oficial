import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PADRAO = "padrao";

// Seletor de antecedência do aviso POR ITEM.
// value: null = usa o padrão geral do usuário; 0 = não avisar; N = N dias antes.
export function AvisoDiasSelect({ value, onChange, className }: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  className?: string;
}) {
  const v = value == null ? PADRAO : String(value);
  return (
    <Select value={v} onValueChange={(s) => onChange(s === PADRAO ? null : Number(s))}>
      <SelectTrigger className={className || "rounded-xl"}><SelectValue /></SelectTrigger>
      <SelectContent className="rounded-xl">
        <SelectItem value={PADRAO}>Padrão (config. geral)</SelectItem>
        <SelectItem value="0">Não avisar</SelectItem>
        <SelectItem value="1">1 dia antes</SelectItem>
        <SelectItem value="2">2 dias antes</SelectItem>
        <SelectItem value="3">3 dias antes</SelectItem>
        <SelectItem value="5">5 dias antes</SelectItem>
        <SelectItem value="7">7 dias antes</SelectItem>
        <SelectItem value="15">15 dias antes</SelectItem>
        <SelectItem value="30">30 dias antes</SelectItem>
      </SelectContent>
    </Select>
  );
}
