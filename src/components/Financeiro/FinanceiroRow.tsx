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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import {
  fmt, statusConfig, escopoConfig, NONE, prioridadeBadgeClassName,
  valorPago, saldoRestante, type FinanceiroItem, type PrioridadeGrupo,
} from "./shared";

// ─── Registrar pagamento (total ou parcial) ────────────────────────────────────

const RegistrarPagamentoPopover: React.FC<{
  item: FinanceiroItem;
  onConfirm: (valor: number) => void;
  loading: boolean;
  children: React.ReactNode;
}> = ({ item, onConfirm, loading, children }) => {
  const [open, setOpen] = useState(false);
  const [valorStr, setValorStr] = useState("");
  const restante = saldoRestante(item);
  const isReceita = item.tipo === "receita";

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (o) setValorStr(String(restante));
  };

  const handleConfirm = () => {
    const v = parseFloat(valorStr.replace(",", "."));
    if (!v || v <= 0) return;
    onConfirm(Math.min(v, restante));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 rounded-2xl p-4 space-y-3" align="end">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {isReceita ? "Registrar recebimento" : "Registrar pagamento"}
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">Saldo restante: {fmt(restante)}</p>
        </div>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">R$</span>
          <Input type="number" min="0.01" max={restante} step="0.01" value={valorStr} autoFocus
            onChange={(e) => setValorStr(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleConfirm())}
            className="rounded-xl h-10 pl-9 text-sm font-bold tabular-nums" />
        </div>
        <Button size="sm" onClick={handleConfirm} disabled={loading}
          className="w-full rounded-xl h-9 font-black uppercase text-[10px] tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar"}
        </Button>
      </PopoverContent>
    </Popover>
  );
};

// ─── Row ─────────────────────────────────────────────────────────────────────

const FinanceiroRow: React.FC<{
  item: FinanceiroItem;
  onRegistrarPagamento: (item: FinanceiroItem, valor: number) => void;
  onEdit: (item: FinanceiroItem) => void;
  onDelete: (id: string) => void;
  onCancelarGrupo: (grupoId: string) => void;
  onPrioridadeChange: (id: string, prioridade: string | null) => void;
  gruposPrioridade: PrioridadeGrupo[];
  loadingId: string | null;
}> = ({ item, onRegistrarPagamento, onEdit, onDelete, onCancelarGrupo, onPrioridadeChange, gruposPrioridade, loadingId }) => {
  const isVencido = item.status === "vencido";
  const cfg = statusConfig[item.status] ?? statusConfig.cancelado;
  const isParcela = !!item.parcela_total;
  const isRecorrente = !!item.recorrencia && !isParcela;
  const escopoCfg = escopoConfig[item.escopo] ?? escopoConfig.pj;
  const prioridadeIndex = gruposPrioridade.findIndex((g) => g.id === item.prioridade);
  const prioridadeGrupo = prioridadeIndex >= 0 ? gruposPrioridade[prioridadeIndex] : undefined;
  const isParcial = item.status === "parcial";

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
          <Badge className={cn("px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-widest", escopoCfg.className)}>
            {escopoCfg.label}
          </Badge>
          {prioridadeGrupo && (
            <Badge className={cn("px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-widest", prioridadeBadgeClassName(prioridadeIndex))}>
              {prioridadeGrupo.label}
            </Badge>
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
          {isParcial && (
            <>
              <span className="opacity-40">·</span>
              <span className="text-sky-500">{fmt(valorPago(item))} de {fmt(item.valor)} pago</span>
            </>
          )}
        </div>
      </div>

      {item.tipo === "despesa" && (
        <Select value={item.prioridade ?? NONE} onValueChange={(v) => onPrioridadeChange(item.id, v === NONE ? null : v)}>
          <SelectTrigger className="w-[132px] h-8 rounded-lg text-[10px] shrink-0"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Não classificada</SelectItem>
            {gruposPrioridade.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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
            <RegistrarPagamentoPopover item={item} loading={loadingId === item.id}
              onConfirm={(valor) => onRegistrarPagamento(item, valor)}>
              <Button size="icon" variant="ghost"
                className="h-8 w-8 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-500"
                disabled={loadingId === item.id} title={item.tipo === "receita" ? "Registrar recebimento" : "Registrar pagamento"}
                aria-label={item.tipo === "receita" ? "Registrar recebimento" : "Registrar pagamento"}>
                {loadingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              </Button>
            </RegistrarPagamentoPopover>
          )}
          <Button size="icon" variant="ghost"
            className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary"
            onClick={() => onEdit(item)} title="Editar" aria-label="Editar lançamento">
            <Pencil className="h-4 w-4" />
          </Button>
          {item.grupo_id && item.status === "pendente" && (
            <Button size="icon" variant="ghost"
              className="h-8 w-8 rounded-xl hover:bg-red-500/10 hover:text-red-500"
              onClick={() => onCancelarGrupo(item.grupo_id!)} title="Cancelar lançamentos futuros do grupo" aria-label="Cancelar lançamentos futuros do grupo">
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost"
            className="h-8 w-8 rounded-xl hover:bg-red-500/10 hover:text-red-500"
            onClick={() => onDelete(item.id)} title="Excluir" aria-label="Excluir lançamento">
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

export { FinanceiroRow, EmptyState, LoadingSkeleton, RegistrarPagamentoPopover };
