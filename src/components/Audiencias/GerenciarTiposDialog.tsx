import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X, RotateCcw, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAudienciaTipos } from "@/hooks/useAudienciaTipos";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GerenciarTiposDialog({ open, onOpenChange }: Props) {
  const { tipos, add, rename, remove, reset } = useAudienciaTipos();
  const { toast } = useToast();
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [editValor, setEditValor] = useState("");

  const handleAdd = () => {
    if (!novo.trim()) return;
    if (add(novo)) {
      setNovo("");
    } else {
      toast({ title: "Tipo já existe", description: "Esse tipo já está na lista.", variant: "destructive" });
    }
  };

  const startEdit = (t: string) => { setEditando(t); setEditValor(t); };
  const cancelEdit = () => { setEditando(null); setEditValor(""); };
  const confirmEdit = (original: string) => {
    if (rename(original, editValor)) {
      cancelEdit();
    } else {
      toast({ title: "Não foi possível renomear", description: "Nome inválido ou já existente.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><Tag className="h-5 w-5" /></div>
            Tipos de Audiência
          </DialogTitle>
          <DialogDescription>Adicione, edite ou remova os tipos usados ao cadastrar audiências.</DialogDescription>
        </DialogHeader>

        {/* Adicionar */}
        <div className="flex gap-2">
          <Input
            placeholder="Novo tipo (ex: Audiência de Custódia)"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            className="rounded-xl h-10"
          />
          <Button onClick={handleAdd} className="rounded-xl h-10 px-3 shrink-0 gap-1 font-bold">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {/* Lista */}
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {tipos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum tipo cadastrado.</p>
          )}
          {tipos.map((t) => (
            <div key={t} className="flex items-center gap-2 p-2 rounded-xl border border-black/5 dark:border-border bg-card/40">
              {editando === t ? (
                <>
                  <Input
                    value={editValor}
                    onChange={(e) => setEditValor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); confirmEdit(t); }
                      if (e.key === "Escape") cancelEdit();
                    }}
                    autoFocus
                    className="rounded-lg h-8 flex-1"
                  />
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-emerald-600" onClick={() => confirmEdit(t)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={cancelEdit}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-semibold pl-1 truncate">{t}</span>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => startEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-destructive" onClick={() => remove(t)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-xs text-muted-foreground" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
          </Button>
          <Button variant="outline" className="rounded-xl font-bold" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
