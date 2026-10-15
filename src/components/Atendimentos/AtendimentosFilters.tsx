// Filtros da listagem de atendimentos (extraídos de pages/Atendimentos.tsx):
// busca, status, tipo, responsável e período (só na visão em lista).
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIPOS_FIXOS } from "./shared";

interface Props {
  busca: string; onBusca: (v: string) => void;
  filtroStatus: string; onFiltroStatus: (v: string) => void;
  filtroTipo: string; onFiltroTipo: (v: string) => void;
  filtroResp: string; onFiltroResp: (v: string) => void;
  filtroPeriodo: string; onFiltroPeriodo: (v: string) => void;
  /** Tipos extras do escritório (além dos fixos). */
  extras: string[];
  membros: { id: string; label: string }[];
  /** Período só se aplica à lista (a visão semanal navega pelas datas). */
  mostrarPeriodo: boolean;
}

export function AtendimentosFilters({
  busca, onBusca, filtroStatus, onFiltroStatus, filtroTipo, onFiltroTipo, filtroResp, onFiltroResp,
  filtroPeriodo, onFiltroPeriodo, extras, membros, mostrarPeriodo,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <Input value={busca} onChange={(e) => onBusca(e.target.value)}
          placeholder="Buscar por cliente, tipo ou observação..."
          className="pl-10 rounded-xl h-11 bg-card/60 border-black/8 dark:border-border" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Select value={filtroStatus} onValueChange={onFiltroStatus}>
          <SelectTrigger className="rounded-xl h-11 bg-card/60 border-black/8 dark:border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="agendado">Agendado</SelectItem>
            <SelectItem value="realizado">Realizado</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={onFiltroTipo}>
          <SelectTrigger className="rounded-xl h-11 bg-card/60 border-black/8 dark:border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS_FIXOS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
            {extras.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {membros.length > 0 && (
          <Select value={filtroResp} onValueChange={onFiltroResp}>
            <SelectTrigger className="rounded-xl h-11 bg-card/60 border-black/8 dark:border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos responsáveis</SelectItem>
              {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {mostrarPeriodo && (
          <Select value={filtroPeriodo} onValueChange={onFiltroPeriodo}>
            <SelectTrigger className="rounded-xl h-11 bg-card/60 border-black/8 dark:border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer período</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7dias">Próximos 7 dias</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="futuros">Futuros</SelectItem>
              <SelectItem value="passados">Passados</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
