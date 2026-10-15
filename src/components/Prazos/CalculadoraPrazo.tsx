import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Newspaper, Zap, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TipoAto } from "@/lib/tiposAtoPrazo";
import { PrazoDatePicker } from "./PrazoDatePicker";

interface Props {
  tipos: TipoAto[];
  tipoAto: string;
  dobro: boolean;
  calculoAplicado: boolean;
  dataPublicacao: string;
  onDataPublicacao: (v: string) => void;
  onTipoChange: (v: string) => void;
  onDobroChange: (v: boolean) => void;
  onGerenciarTipos: () => void;
}

/** Bloco "Calculadora automática" do diálogo de prazo: publicação, tipo de ato e prazo em dobro. O cálculo fica no diálogo. */
export function CalculadoraPrazo({
  tipos, tipoAto, dobro, calculoAplicado, dataPublicacao, onDataPublicacao, onTipoChange, onDobroChange, onGerenciarTipos,
}: Props) {
  const atoSelecionado = tipos.find(t => t.value === tipoAto);
  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-violet-500" />
          <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">Calculadora automática</p>
        </div>
        <button type="button" onClick={onGerenciarTipos}
          className="text-[10px] text-violet-500 hover:text-violet-700 font-bold underline underline-offset-2 transition-colors flex items-center gap-1">
          <Pencil className="h-2.5 w-2.5" /> Gerenciar tipos
        </button>
      </div>

      {/* Data da publicação com calendário */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80 leading-none mb-0.5 flex items-center gap-1">
            <Newspaper className="h-3 w-3 text-sky-500" /> Data da Publicação
          </p>
          <p className="text-[10px] text-muted-foreground/60 leading-none">Intimação = pub. + 1 dia útil (CPC 231)</p>
        </div>
        <PrazoDatePicker value={dataPublicacao} onChange={onDataPublicacao} />
      </div>

      {/* Tipo de ato */}
      <div className="flex gap-2">
        <Select value={tipoAto} onValueChange={onTipoChange} disabled={!dataPublicacao}>
          <SelectTrigger className={cn("flex-1 rounded-xl h-10 text-sm", !dataPublicacao && "opacity-50")}>
            <SelectValue placeholder={dataPublicacao ? "Selecionar tipo de ato..." : "Informe a data de publicação primeiro"} />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {tipos.map(t => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
                <span className="text-muted-foreground ml-1 text-[10px]">
                  ({t.diasUteis}d {t.corridos ? 'corridos' : 'úteis'})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Prazo em dobro */}
      <label className="flex items-center gap-2 px-2 py-2 rounded-lg border border-violet-500/20 bg-violet-500/5 cursor-pointer select-none">
        <input type="checkbox" checked={dobro} onChange={e => onDobroChange(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-violet-500" />
        <span className="text-[11px] font-bold text-foreground/80">
          Prazo em dobro <span className="text-muted-foreground/60 font-normal">(litisconsortes / Fazenda / MP / Defensoria)</span>
        </span>
      </label>

      {/* Confirmação do cálculo */}
      {calculoAplicado && atoSelecionado && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Zap className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-emerald-600 font-bold leading-relaxed">
            Calculado: {dobro ? atoSelecionado.diasUteis * 2 : atoSelecionado.diasUteis}d {atoSelecionado.corridos ? 'corridos' : 'úteis'}{dobro ? ' (em dobro)' : ''} a partir da intimação.
            Prazo interno com {atoSelecionado.margem}d de antecedência.
            Ajuste manualmente se necessário.
          </p>
        </div>
      )}
    </div>
  );
}
