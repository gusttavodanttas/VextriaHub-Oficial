// Barra de ações em lote (concluir, atribuir, excluir, limpar) — extraída de pages/Prazos.tsx.
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CheckCheck, User, Trash2, X } from 'lucide-react';
import type { useOfficeUsers } from '@/hooks/useOfficeUsers';

interface Props {
  count: number;
  selectedIds: () => string[];
  officeUsers: ReturnType<typeof useOfficeUsers>['users'];
  membroMap: Record<string, string>;
  onConcluir: (ids: string[]) => void;
  concluindo: boolean;
  onAtribuir: (ids: string[], responsavel_id: string) => void;
  atribuindo: boolean;
  onExcluir: () => void;
  excluindo: boolean;
  onLimpar: () => void;
}

export function PrazosBulkBar({ count, selectedIds, officeUsers, membroMap, onConcluir, concluindo, onAtribuir, atribuindo, onExcluir, excluindo, onLimpar }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-primary/[0.04] px-3 py-2">
      <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-1">
        {count} selecionado{count !== 1 ? 's' : ''}
      </span>
      <Button size="sm" variant="outline" disabled={concluindo}
        onClick={() => onConcluir(selectedIds())}
        className="h-8 rounded-lg gap-1.5 font-bold text-emerald-600">
        <CheckCheck className="h-3.5 w-3.5" /> Concluir
      </Button>
      {officeUsers.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={atribuindo}
              className="h-8 rounded-lg gap-1.5 font-bold">
              <User className="h-3.5 w-3.5" /> Atribuir
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-xl w-48 max-h-64 overflow-y-auto">
            {officeUsers.map((u) => (
              <DropdownMenuItem key={u.user_id} className="rounded-lg cursor-pointer"
                onClick={() => onAtribuir(selectedIds(), u.user_id)}>
                {membroMap[u.user_id]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button size="sm" variant="outline" disabled={excluindo}
        onClick={onExcluir}
        className="h-8 rounded-lg gap-1.5 font-bold text-red-600">
        <Trash2 className="h-3.5 w-3.5" /> Excluir
      </Button>
      <Button size="sm" variant="ghost" onClick={onLimpar} className="h-8 w-8 p-0 rounded-lg ml-auto" title="Limpar seleção">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
