// Dialog de gestão dos grupos de prioridade das despesas (G1/G2/G3/Esperar por
// padrão, mas customizáveis por escritório) — mesmo padrão de
// GerenciarCategoriasDialog.tsx, adaptado pra pares {id, label} com reordenação.
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListOrdered, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { prioridadeBadgeClassName, type PrioridadeGrupo } from "./shared";

interface GerenciarPrioridadesProps {
  open: boolean;
  onClose: () => void;
  grupos: PrioridadeGrupo[];
  onSave: (grupos: PrioridadeGrupo[]) => void;
}

const GerenciarPrioridadesDialog: React.FC<GerenciarPrioridadesProps> = ({
  open, onClose, grupos, onSave,
}) => {
  const [lista, setLista] = useState<PrioridadeGrupo[]>([]);

  useEffect(() => {
    if (open) setLista(grupos.map((g) => ({ ...g })));
  }, [open, grupos]);

  const renomear = (id: string, label: string) =>
    setLista((prev) => prev.map((g) => (g.id === id ? { ...g, label } : g)));

  const remover = (id: string) =>
    setLista((prev) => prev.filter((g) => g.id !== id));

  const adicionar = () =>
    setLista((prev) => [...prev, { id: crypto.randomUUID(), label: "" }]);

  const mover = (index: number, delta: number) =>
    setLista((prev) => {
      const alvo = index + delta;
      if (alvo < 0 || alvo >= prev.length) return prev;
      const copia = [...prev];
      [copia[index], copia[alvo]] = [copia[alvo], copia[index]];
      return copia;
    });

  const salvar = () => {
    const limpo = lista.map((g) => ({ ...g, label: g.label.trim() })).filter((g) => g.label !== "");
    onSave(limpo);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md rounded-3xl border border-black/5 dark:border-border shadow-premium">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><ListOrdered className="h-5 w-5" /></div>
            Gerenciar Grupos de Prioridade
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-xs text-muted-foreground">
            Usados para classificar despesas por urgência de pagamento. A ordem abaixo define a ordem de exibição na aba Priorização.
          </p>

          <div className="space-y-2">
            {lista.length === 0 && (
              <p className="text-xs text-muted-foreground/60 py-2">Nenhum grupo configurado.</p>
            )}
            {lista.map((g, i) => (
              <div key={g.id} className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", prioridadeBadgeClassName(i).match(/bg-\S+/)?.[0])} />
                <Input
                  value={g.label}
                  onChange={(e) => renomear(g.id, e.target.value)}
                  placeholder="Nome do grupo..."
                  className="rounded-xl text-sm h-9"
                />
                <div className="flex flex-col shrink-0">
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0}
                    className="h-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === lista.length - 1}
                    className="h-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button type="button" onClick={() => remover(g.id)}
                  className="shrink-0 h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={adicionar} className="rounded-xl h-9 w-full text-xs font-black uppercase tracking-widest">
            <Plus className="h-4 w-4 mr-1.5" />Adicionar grupo
          </Button>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest">
              Cancelar
            </Button>
            <Button onClick={salvar} className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-premium">
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { GerenciarPrioridadesDialog };
