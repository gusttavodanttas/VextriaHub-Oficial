// Dialog de categorias do Financeiro — extraído de pages/Financeiro.tsx.
import React, { useState, useMemo, useEffect, useCallback, useDeferredValue } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  CheckCircle2,
  Pencil,
  Trash2,
  Plus,
  Search,
  AlertCircle,
  Calendar,
  Loader2,
  Settings2,
  X,
  Repeat,
  Layers,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  parseISO,
  isAfter,
  isBefore,
  addMonths,
  addWeeks,
} from "date-fns";
import { cn } from "@/lib/utils";

// ─── Gerenciar Categorias Dialog ──────────────────────────────────────────────

interface GerenciarCategoriasProps {
  open: boolean;
  onClose: () => void;
  categoriasReceita: string[];
  categoriasDespesa: string[];
  onSave: (receita: string[], despesa: string[]) => void;
}

const GerenciarCategoriasDialog: React.FC<GerenciarCategoriasProps> = ({
  open, onClose, categoriasReceita, categoriasDespesa, onSave,
}) => {
  const [receita, setReceita] = useState<string[]>([]);
  const [despesa, setDespesa] = useState<string[]>([]);
  const [novaReceita, setNovaReceita] = useState("");
  const [novaDespesa, setNovaDespesa] = useState("");

  useEffect(() => {
    if (open) {
      setReceita([...categoriasReceita]);
      setDespesa([...categoriasDespesa]);
      setNovaReceita("");
      setNovaDespesa("");
    }
  }, [open, categoriasReceita, categoriasDespesa]);

  const addReceita = () => {
    const v = novaReceita.trim();
    if (v && !receita.includes(v)) { setReceita([...receita, v]); setNovaReceita(""); }
  };
  const addDespesa = () => {
    const v = novaDespesa.trim();
    if (v && !despesa.includes(v)) { setDespesa([...despesa, v]); setNovaDespesa(""); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md rounded-3xl border border-black/5 dark:border-border shadow-premium">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><Settings2 className="h-5 w-5" /></div>
            Gerenciar Categorias
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Receitas */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Categorias de Receita</p>
            <div className="flex flex-wrap gap-2">
              {receita.map((c) => (
                <span key={c} className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
                  {c}
                  <button onClick={() => setReceita(receita.filter((x) => x !== c))} className="hover:text-red-500 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nova categoria..."
                value={novaReceita}
                onChange={(e) => setNovaReceita(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addReceita())}
                className="rounded-xl text-sm h-9"
              />
              <Button size="sm" onClick={addReceita} className="rounded-xl h-9 px-3">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Despesas */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Categorias de Despesa</p>
            <div className="flex flex-wrap gap-2">
              {despesa.map((c) => (
                <span key={c} className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold border border-orange-500/20">
                  {c}
                  <button onClick={() => setDespesa(despesa.filter((x) => x !== c))} className="hover:text-red-500 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nova categoria..."
                value={novaDespesa}
                onChange={(e) => setNovaDespesa(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDespesa())}
                className="rounded-xl text-sm h-9"
              />
              <Button size="sm" onClick={addDespesa} className="rounded-xl h-9 px-3">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest">
              Cancelar
            </Button>
            <Button onClick={() => { onSave(receita, despesa); onClose(); }} className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-premium">
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { GerenciarCategoriasDialog };
