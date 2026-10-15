// Navegação de mês da página Financeiro (extraída de pages/Financeiro.tsx) —
// afeta os cards "do Mês" e as listas abaixo.
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  mesRef: Date;
  isMesAtual: boolean;
  onAnterior: () => void;
  onProximo: () => void;
  onHoje: () => void;
}

export function MesNavegacao({ mesRef, isMesAtual, onAnterior, onProximo, onHoje }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={onAnterior} title="Mês anterior" aria-label="Mês anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={onProximo} title="Próximo mês" aria-label="Próximo mês">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <p className="text-sm font-black tracking-tight capitalize w-40">{format(mesRef, "MMMM yyyy", { locale: ptBR })}</p>
      {!isMesAtual && (
        <Button variant="outline" className="h-9 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest" onClick={onHoje}>
          Hoje
        </Button>
      )}
    </div>
  );
}
