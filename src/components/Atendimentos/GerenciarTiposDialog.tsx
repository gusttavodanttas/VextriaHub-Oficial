// Dialog de tipos personalizados de atendimento — extraído de pages/Atendimentos.tsx.
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings2, X, Plus } from "lucide-react";
import { TIPOS_FIXOS } from "./shared";

export const GerenciarTiposDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  extras: string[];
  onSave: (tipos: string[]) => void;
}> = ({ open, onClose, extras, onSave }) => {
  const [lista, setLista] = useState<string[]>([]);
  const [novo, setNovo] = useState("");

  useEffect(() => { if (open) { setLista([...extras]); setNovo(""); } }, [open, extras]);

  const add = () => {
    const v = novo.trim();
    if (v && !lista.includes(v) && !TIPOS_FIXOS.find(t => t.label.toLowerCase() === v.toLowerCase())) {
      setLista([...lista, v]);
      setNovo("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-xs p-0 rounded-3xl border border-black/5 dark:border-border shadow-premium overflow-hidden">
        <div className="px-5 pt-4 pb-3 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Settings2 className="h-4 w-4" />
              </div>
              <DialogTitle className="text-lg font-black tracking-tight">Tipos de Atendimento</DialogTitle>
            </div>
          </DialogHeader>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Fixos (read-only) */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Padrão (não editáveis)</p>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_FIXOS.map((t) => (
                <span key={t.value} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/40 text-muted-foreground text-[11px] font-bold">
                  <t.Icon className="h-3 w-3" />{t.label}
                </span>
              ))}
            </div>
          </div>

          {/* Customizados */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Personalizados</p>
            {lista.length === 0 && (
              <p className="text-xs text-muted-foreground/40 italic">Nenhum tipo personalizado.</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {lista.map((t) => (
                <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-bold border border-primary/20">
                  {t}
                  <button onClick={() => setLista(lista.filter(x => x !== t))} className="hover:text-red-500 transition-colors ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Novo tipo..." value={novo}
                onChange={(e) => setNovo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
                className="rounded-xl h-9 text-sm" />
              <Button size="sm" onClick={add} className="rounded-xl h-9 px-3"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl h-9 font-black uppercase text-[10px] tracking-widest">Cancelar</Button>
            <Button onClick={() => { onSave(lista); onClose(); }} className="flex-1 rounded-xl h-9 font-black uppercase text-[10px] tracking-widest shadow-premium">Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
