// Estados de erro e de lista vazia da página de Atendimentos (extraídos de
// pages/Atendimentos.tsx).
import { AlertTriangle, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AtendimentosErro({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="h-16 w-16 rounded-3xl bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-destructive/60" />
      </div>
      <div>
        <p className="text-lg font-black text-muted-foreground/60">Não foi possível carregar os atendimentos</p>
        <p className="text-sm text-muted-foreground/40 mt-1">
          {error instanceof Error ? error.message : "Tente novamente em instantes."}
        </p>
      </div>
      <Button onClick={onRetry} variant="outline" className="rounded-xl font-black uppercase text-[10px] tracking-widest mt-2">
        Tentar novamente
      </Button>
    </div>
  );
}

interface VazioProps {
  /** Há busca ou filtro de status/tipo ativo — muda o texto e esconde o atalho. */
  filtrando: boolean;
  /** Só oferece "registrar o primeiro" quando não há histórico por carregar. */
  semHistorico: boolean;
  onNovo: () => void;
  /** Rodapé "carregar mais antigos" (histórico paginado). */
  children?: React.ReactNode;
}

export function AtendimentosVazio({ filtrando, semHistorico, onNovo, children }: VazioProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="h-16 w-16 rounded-3xl bg-muted/30 flex items-center justify-center">
        <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
      </div>
      <div>
        <p className="text-lg font-black text-muted-foreground/60">
          {filtrando ? "Nenhum atendimento encontrado" : "Nenhum atendimento registrado"}
        </p>
        <p className="text-sm text-muted-foreground/40 mt-1">
          {filtrando ? "Tente ajustar os filtros." : "Clique em Novo Atendimento para começar."}
        </p>
      </div>
      {!filtrando && semHistorico && (
        <Button onClick={onNovo} className="rounded-xl font-black uppercase text-[10px] tracking-widest shadow-premium mt-2">
          <Plus className="h-4 w-4 mr-2" />Registrar primeiro atendimento
        </Button>
      )}
      {children}
    </div>
  );
}
