// Paginação da lista de publicações — extraída de pages/Publicacoes.tsx sem mudança de comportamento.
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props { page: number; totalPages: number; total: number; loading: boolean; onPage: (page: number) => void }

export function PublicationsPagination({ page, totalPages, total, loading, onPage }: Props) {
  if (totalPages <= 1) return null;
  return (
      <div className="flex items-center justify-between gap-3 pt-5 mt-1 border-t border-black/5 dark:border-border">
        <p className="text-xs font-semibold text-muted-foreground">
          Página {page} de {totalPages} · {total} publicaç{total === 1 ? 'ão' : 'ões'}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 rounded-lg text-xs font-bold gap-1"
            disabled={page <= 1 || loading}
            onClick={() => onPage(Math.max(1, page - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 rounded-lg text-xs font-bold gap-1"
            disabled={page >= totalPages || loading}
            onClick={() => onPage(Math.min(totalPages, page + 1))}
          >
            Próxima <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
  );
}
