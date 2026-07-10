// Linha de lançamento + estados vazios — extraídos de pages/Financeiro.tsx.
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
import { fmt, statusConfig, type FinanceiroItem } from "./shared";

// ─── Row ─────────────────────────────────────────────────────────────────────

const FinanceiroRow: React.FC<{
  item: FinanceiroItem;
  onMarkPago: (id: string) => void;
  onEdit: (item: FinanceiroItem) => void;
  onDelete: (id: string) => void;
  onCancelarGrupo: (grupoId: string) => void;
  loadingId: string | null;
}> = ({ item, onMarkPago, onEdit, onDelete, onCancelarGrupo, loadingId }) => {
  const isVencido = item.status === "vencido";
  const cfg = statusConfig[item.status] ?? statusConfig.cancelado;
  const isParcela = !!item.parcela_total;
  const isRecorrente = !!item.recorrencia && !isParcela;

  return (
    <div className={cn(
      "glass-card hover-lift p-5 rounded-2xl border bg-card/40 shadow-premium group flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all",
      isVencido ? "border-red-500/30" : "border-black/5 dark:border-border"
    )}>
      <div className={cn(
        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300",
        item.tipo === "receita"
          ? "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white"
          : "bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white"
      )}>
        {item.tipo === "receita" ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-black text-base tracking-tight truncate group-hover:text-primary transition-colors">
            {item.descricao}
          </p>
          {isParcela && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/20">
              <Layers className="h-3 w-3" />
              {item.parcela_numero}/{item.parcela_total}
            </span>
          )}
          {isRecorrente && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-500 text-[9px] font-black uppercase tracking-widest border border-violet-500/20">
              <Repeat className="h-3 w-3" />
              {item.recorrencia}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
          {item.clientes?.nome && <span>{item.clientes.nome}</span>}
          {item.categoria && item.clientes?.nome && <span className="opacity-40">·</span>}
          {item.categoria && <span>{item.categoria}</span>}
          <span className="opacity-40">·</span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-primary" />
            {format(parseISO(item.data_vencimento), "dd/MM/yyyy")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:ml-auto shrink-0">
        <p className={cn("text-xl font-black tracking-tighter", item.tipo === "receita" ? "text-emerald-500" : "text-orange-500")}>
          {item.tipo === "despesa" && "- "}{fmt(item.valor)}
        </p>

        <Badge className={cn("px-3 py-1 rounded-xl text-[9px] uppercase tracking-widest", cfg.className)}>
          {isVencido && <AlertCircle className="h-3 w-3 mr-1" />}
          {cfg.label}
        </Badge>

        <div className="flex gap-1">
          {item.status !== "pago" && item.status !== "cancelado" && (
            <Button size="icon" variant="ghost"
              className="h-8 w-8 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-500"
              onClick={() => onMarkPago(item.id)} disabled={loadingId === item.id} title="Marcar como pago">
              {loadingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            </Button>
          )}
          <Button size="icon" variant="ghost"
            className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary"
            onClick={() => onEdit(item)} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          {item.grupo_id && item.status === "pendente" && (
            <Button size="icon" variant="ghost"
              className="h-8 w-8 rounded-xl hover:bg-red-500/10 hover:text-red-500"
              onClick={() => onCancelarGrupo(item.grupo_id!)} title="Cancelar lançamentos futuros do grupo">
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost"
            className="h-8 w-8 rounded-xl hover:bg-red-500/10 hover:text-red-500"
            onClick={() => onDelete(item.id)} title="Excluir">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ label: string; onNew: () => void }> = ({ label, onNew }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
    <div className="h-16 w-16 rounded-3xl bg-muted/30 flex items-center justify-center">
      <DollarSign className="h-8 w-8 text-muted-foreground/40" />
    </div>
    <p className="text-lg font-black text-muted-foreground/60">{label}</p>
    <Button className="rounded-xl font-black uppercase text-[10px] tracking-widest shadow-premium" onClick={onNew}>
      <Plus className="h-4 w-4 mr-2" />Criar primeiro registro
    </Button>
  </div>
);

const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
  </div>
);

// ─── Hook de categorias (persiste em offices.settings no Supabase) ───────────

export { FinanceiroRow, EmptyState, LoadingSkeleton };
