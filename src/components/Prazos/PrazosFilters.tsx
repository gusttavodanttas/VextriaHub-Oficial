// Busca + filtros (prioridade, concluídos, responsável, cliente, titular) — extraídos de pages/Prazos.tsx.
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIORITY_CONFIG } from '@/components/Prazos/shared';
import type { useOfficeUsers } from '@/hooks/useOfficeUsers';

type Prioridade = 'all' | 'alta' | 'media' | 'baixa';
interface Props {
  search: string; setSearch: (v: string) => void;
  filterPriority: Prioridade; setFilterPriority: (p: Prioridade) => void;
  showConcluidos: boolean; onToggleConcluidos: () => void;
  filterResp: string; setFilterResp: (v: string) => void;
  filterCliente: string; setFilterCliente: (v: string) => void;
  filterTitular: string; setFilterTitular: (v: string) => void;
  officeUsers: ReturnType<typeof useOfficeUsers>['users'];
  membroMap: Record<string, string>;
  clienteOptions: { id: string; nome: string }[];
}

export function PrazosFilters({ search, setSearch, filterPriority, setFilterPriority, showConcluidos, onToggleConcluidos, filterResp, setFilterResp, filterCliente, setFilterCliente, filterTitular, setFilterTitular, officeUsers, membroMap, clienteOptions }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <Input
          placeholder="Buscar prazos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 h-10 rounded-xl bg-background border-border text-sm"
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {(['all', 'alta', 'media', 'baixa'] as const).map(p => (
          <button
            key={p}
            onClick={() => setFilterPriority(p)}
            className={cn(
              'h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border',
              filterPriority === p
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
            )}
          >
            {p === 'all' ? 'Todos' : PRIORITY_CONFIG[p].label}
          </button>
        ))}
        {/* Toggle concluídos */}
        <button
          onClick={onToggleConcluidos}
          className={cn(
            'h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5',
            showConcluidos
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
              : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
          )}
        >
          {showConcluidos ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          Concluídos
        </button>
      </div>
      {officeUsers.length > 0 && (
        <Select value={filterResp} onValueChange={setFilterResp}>
          <SelectTrigger className="h-10 rounded-xl w-full sm:w-44 bg-background border-border text-sm font-bold"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            <SelectItem value="__none__">Sem responsável</SelectItem>
            {officeUsers.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{membroMap[u.user_id]}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {clienteOptions.length > 0 && (
        <Select value={filterCliente} onValueChange={setFilterCliente}>
          <SelectTrigger className="h-10 rounded-xl w-full sm:w-44 bg-background border-border text-sm font-bold"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Todos clientes</SelectItem>
            {clienteOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Select value={filterTitular} onValueChange={setFilterTitular}>
        <SelectTrigger className="h-10 rounded-xl w-full sm:w-40 bg-background border-border text-sm font-bold"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os prazos</SelectItem>
          <SelectItem value="nosso">Nossos</SelectItem>
          <SelectItem value="contraria">Parte contrária</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
