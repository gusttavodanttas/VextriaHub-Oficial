// Busca + filtros (status, prioridade, responsável, cliente) — extraídos de pages/Tarefas.tsx.
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface Opt { id: string; label: string }
interface Props {
  view: "lista" | "kanban";
  search: string; setSearch: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void;
  prioridadeFilter: string; setPrioridadeFilter: (v: string) => void;
  respFilter: string; setRespFilter: (v: string) => void;
  clienteFilter: string; setClienteFilter: (v: string) => void;
  membros: Opt[];
  clientes: Opt[];
}

export function TarefasFilters({ view, search, setSearch, statusFilter, setStatusFilter, prioridadeFilter, setPrioridadeFilter, respFilter, setRespFilter, clienteFilter, setClienteFilter, membros, clientes }: Props) {
  return (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <Input placeholder="Buscar por título, cliente ou descrição..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-10 h-11 rounded-xl bg-card/40 border-black/5 dark:border-border" />
      </div>
      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
        {view === "lista" && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-32 h-11 rounded-xl bg-card/40 border-black/5 dark:border-border font-bold"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="pendentes">Pendentes</SelectItem>
              <SelectItem value="concluidas">Concluídas</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
          <SelectTrigger className="w-full md:w-32 h-11 rounded-xl bg-card/40 border-black/5 dark:border-border font-bold"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="todas">Toda prioridade</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        {membros.length > 0 && (
          <Select value={respFilter} onValueChange={setRespFilter}>
            <SelectTrigger className="w-full md:w-40 h-11 rounded-xl bg-card/40 border-black/5 dark:border-border font-bold"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="todos">Todos responsáveis</SelectItem>
              {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={clienteFilter} onValueChange={setClienteFilter}>
          <SelectTrigger className="w-full md:w-44 h-11 rounded-xl bg-card/40 border-black/5 dark:border-border font-bold"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl max-h-72">
            <SelectItem value="todos">Todos clientes</SelectItem>
            {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
