// Filtros da listagem (extraídos de pages/Financeiro.tsx): busca, status,
// categoria e escopo PJ/PF.
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import type { EscopoType } from "./shared";

export type FiltroEscopo = "todos" | EscopoType;

interface Props {
  busca: string;
  onBusca: (v: string) => void;
  filtroStatus: string;
  onFiltroStatus: (v: string) => void;
  filtroCategoria: string;
  onFiltroCategoria: (v: string) => void;
  filtroEscopo: FiltroEscopo;
  onFiltroEscopo: (v: FiltroEscopo) => void;
  /** Categorias efetivamente usadas nos registros carregados. */
  categorias: string[];
}

export function FinanceiroFilters({
  busca, onBusca, filtroStatus, onFiltroStatus, filtroCategoria, onFiltroCategoria, filtroEscopo, onFiltroEscopo, categorias,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <Input placeholder="Buscar por descrição ou cliente..." value={busca} onChange={(e) => onBusca(e.target.value)} className="pl-9 rounded-xl" />
      </div>
      <Select value={filtroStatus} onValueChange={onFiltroStatus}>
        <SelectTrigger className="w-full sm:w-44 rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os status</SelectItem>
          <SelectItem value="pendente">Pendente</SelectItem>
          <SelectItem value="pago">Pago</SelectItem>
          <SelectItem value="parcial">Parcial</SelectItem>
          <SelectItem value="vencido">Vencido</SelectItem>
          <SelectItem value="cancelado">Cancelado</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filtroCategoria} onValueChange={onFiltroCategoria}>
        <SelectTrigger className="w-full sm:w-52 rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as categorias</SelectItem>
          {categorias.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filtroEscopo} onValueChange={(v) => onFiltroEscopo(v as FiltroEscopo)}>
        <SelectTrigger className="w-full sm:w-40 rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">PJ + PF</SelectItem>
          <SelectItem value="pj">Só Escritório</SelectItem>
          <SelectItem value="pf">Só Pessoal</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
