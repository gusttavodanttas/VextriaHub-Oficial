import { Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Linhas do histórico que ainda não foram carregadas. */
  restantes: number;
  carregando: boolean;
  onClick: () => void;
  /** Substantivo no plural para a frase "N <rotulo> mais antigos ainda não carregados". */
  rotulo: string;
}

/** Rodapé das listas com histórico paginado (ver useHistoricoPaginado): mostra
 * quantos itens antigos ainda não vieram e o botão para trazê-los. Não renderiza
 * nada quando o histórico já está completo. */
export function CarregarMaisHistorico({ restantes, carregando, onClick, rotulo }: Props) {
  if (restantes <= 0) return null;
  return (
    <div className="flex flex-col items-center gap-2 py-4" data-testid="carregar-mais-historico">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
        {restantes} {rotulo} mais antigos ainda não carregados
      </p>
      <Button variant="outline" size="sm" onClick={onClick} disabled={carregando}
        className="rounded-xl font-black uppercase text-[10px] tracking-widest">
        {carregando ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <History className="h-3.5 w-3.5 mr-2" />}
        Carregar mais antigos
      </Button>
    </div>
  );
}
