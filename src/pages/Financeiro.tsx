import React, { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  parseISO,
  isAfter,
  isBefore,
} from "date-fns";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusType = "pendente" | "pago" | "vencido" | "cancelado";
type TipoType = "receita" | "despesa";

interface FinanceiroItem {
  id: string;
  tipo: TipoType;
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: StatusType;
  categoria: string | null;
  cliente_id: string | null;
  processo_id: string | null;
  user_id: string;
  office_id: string;
  deletado: boolean;
  clientes?: { nome: string } | null;
}

interface ClienteOption {
  id: string;
  nome: string;
}

interface ProcessoOption {
  id: string;
  numero: string;
  titulo?: string | null;
}

interface FormState {
  tipo: TipoType;
  descricao: string;
  valor: string;
  data_vencimento: string;
  status: StatusType;
  categoria: string;
  cliente_id: string;
  processo_id: string;
}

const CATEGORIAS = [
  "Honorários",
  "Custas",
  "Diligências",
  "Despesas de Escritório",
  "Outros",
];

const NONE = "__none__";

const defaultForm = (tipo: TipoType = "receita"): FormState => ({
  tipo,
  descricao: "",
  valor: "",
  data_vencimento: format(new Date(), "yyyy-MM-dd"),
  status: "pendente",
  categoria: NONE,
  cliente_id: NONE,
  processo_id: NONE,
});

// ─── Hook ────────────────────────────────────────────────────────────────────

const useFinanceiro = (officeId: string | null | undefined) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["financeiro", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro")
        .select("*, clientes!cliente_id(nome)")
        .eq("office_id", officeId!)
        .eq("deletado", false)
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return (data ?? []) as FinanceiroItem[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["financeiro", officeId] });

  const create = useMutation({
    mutationFn: async (payload: Omit<FinanceiroItem, "id" | "deletado" | "clientes">) => {
      const { error } = await supabase.from("financeiro").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Registro criado com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<FinanceiroItem> & { id: string }) => {
      const { error } = await supabase.from("financeiro").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Registro atualizado!" });
    },
    onError: (e: Error) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro").update({ deletado: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Registro excluído!" });
    },
    onError: (e: Error) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  const markPago = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financeiro")
        .update({ status: "pago", data_pagamento: format(new Date(), "yyyy-MM-dd") })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Marcado como pago!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { query, create, update, remove, markPago };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  pago: { label: "Pago", className: "border-emerald-500/50 text-emerald-500 bg-emerald-500/10 font-bold" },
  pendente: { label: "Pendente", className: "border-yellow-500/50 text-yellow-500 bg-yellow-500/10 font-bold" },
  vencido: { label: "Vencido", className: "border-red-500/50 text-red-500 bg-red-500/10 font-bold" },
  cancelado: { label: "Cancelado", className: "border-muted/30 text-muted-foreground bg-muted/10 font-bold" },
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Form Dialog ─────────────────────────────────────────────────────────────

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  initial: FormState;
  editId?: string;
  officeId: string;
  userId: string;
  onSave: (data: Omit<FinanceiroItem, "id" | "deletado" | "clientes">) => void;
  onUpdate: (data: Partial<FinanceiroItem> & { id: string }) => void;
  loading: boolean;
}

const FormDialog: React.FC<FormDialogProps> = ({
  open,
  onClose,
  initial,
  editId,
  officeId,
  userId,
  onSave,
  onUpdate,
  loading,
}) => {
  const [form, setForm] = useState<FormState>(initial);

  useEffect(() => {
    setForm(initial);
  }, [open]);

  const { data: clientes = [] } = useQuery<ClienteOption[]>({
    queryKey: ["clientes-select", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .eq("office_id", officeId)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ClienteOption[];
    },
  });

  const { data: processos = [] } = useQuery<ProcessoOption[]>({
    queryKey: ["processos-select", officeId, form.cliente_id],
    enabled: !!officeId && !!form.cliente_id && form.cliente_id !== NONE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero_processo, titulo")
        .eq("office_id", officeId)
        .eq("cliente_id", form.cliente_id);
      if (error) throw error;
      return (data ?? []).map((p: any) => ({ id: p.id, numero: p.numero_processo, titulo: p.titulo })) as ProcessoOption[];
    },
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = (v: string) => (v === NONE || v === "" ? null : v);
    const payload = {
      tipo: form.tipo,
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      data_vencimento: form.data_vencimento,
      data_pagamento: form.status === "pago" ? format(new Date(), "yyyy-MM-dd") : null,
      status: form.status,
      categoria: n(form.categoria),
      cliente_id: n(form.cliente_id),
      processo_id: n(form.processo_id),
      user_id: userId,
      office_id: officeId,
    };

    if (editId) {
      onUpdate({ id: editId, ...payload });
    } else {
      onSave(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg rounded-3xl border border-black/5 dark:border-border shadow-premium">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">
            {editId ? "Editar Registro" : form.tipo === "receita" ? "Nova Receita" : "Nova Despesa"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Tipo
              </Label>
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v as TipoType)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Descrição *
              </Label>
              <Input
                required
                value={form.descricao}
                onChange={(e) => set("descricao", e.target.value)}
                className="rounded-xl"
                placeholder="Ex: Honorários processo 001"
              />
            </div>

            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Valor (R$) *
              </Label>
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.valor}
                onChange={(e) => set("valor", e.target.value)}
                className="rounded-xl"
                placeholder="0,00"
              />
            </div>

            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Vencimento *
              </Label>
              <Input
                required
                type="date"
                value={form.data_vencimento}
                onChange={(e) => set("data_vencimento", e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Status
              </Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as StatusType)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Categoria
              </Label>
              <Select value={form.categoria} onValueChange={(v) => set("categoria", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Cliente
              </Label>
              <Select value={form.cliente_id} onValueChange={(v) => { set("cliente_id", v); set("processo_id", NONE); }}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.cliente_id && (
              <div className="col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  Processo
                </Label>
                <Select value={form.processo_id} onValueChange={(v) => set("processo_id", v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecionar processo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {processos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.numero}{p.titulo ? ` — ${p.titulo}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-premium">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (editId ? "Salvar" : "Criar")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  item: FinanceiroItem;
  onMarkPago: (id: string) => void;
  onEdit: (item: FinanceiroItem) => void;
  onDelete: (id: string) => void;
  loadingId: string | null;
}

const FinanceiroRow: React.FC<RowProps> = ({ item, onMarkPago, onEdit, onDelete, loadingId }) => {
  const isVencido = item.status === "vencido";
  const clienteNome = item.clientes?.nome;
  const cfg = statusConfig[item.status] ?? statusConfig.cancelado;

  return (
    <div
      className={cn(
        "glass-card hover-lift p-5 rounded-2xl border bg-card/40 shadow-premium group flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all",
        isVencido ? "border-red-500/30" : "border-black/5 dark:border-border"
      )}
    >
      <div className={cn(
        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300",
        item.tipo === "receita"
          ? "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white"
          : "bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white"
      )}>
        {item.tipo === "receita" ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-black text-base tracking-tight truncate group-hover:text-primary transition-colors">
          {item.descricao}
        </p>
        <div className="flex flex-wrap gap-2 mt-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
          {clienteNome && <span>{clienteNome}</span>}
          {item.categoria && (
            <>
              {clienteNome && <span className="opacity-40">·</span>}
              <span>{item.categoria}</span>
            </>
          )}
          <span className="opacity-40">·</span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-primary" />
            {format(parseISO(item.data_vencimento), "dd/MM/yyyy")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:ml-auto shrink-0">
        <p className={cn(
          "text-xl font-black tracking-tighter",
          item.tipo === "receita" ? "text-emerald-500" : "text-orange-500"
        )}>
          {item.tipo === "despesa" && "- "}{fmt(item.valor)}
        </p>

        <Badge className={cn("px-3 py-1 rounded-xl text-[9px] uppercase tracking-widest", cfg.className)}>
          {isVencido && <AlertCircle className="h-3 w-3 mr-1" />}
          {cfg.label}
        </Badge>

        <div className="flex gap-1">
          {item.status !== "pago" && item.status !== "cancelado" && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-500"
              onClick={() => onMarkPago(item.id)}
              disabled={loadingId === item.id}
              title="Marcar como pago"
            >
              {loadingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary"
            onClick={() => onEdit(item)}
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-xl hover:bg-red-500/10 hover:text-red-500"
            onClick={() => onDelete(item.id)}
            title="Excluir"
          >
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
    <Button
      className="rounded-xl font-black uppercase text-[10px] tracking-widest shadow-premium"
      onClick={onNew}
    >
      <Plus className="h-4 w-4 mr-2" />
      Criar primeiro registro
    </Button>
  </div>
);

// ─── Skeleton ────────────────────────────────────────────────────────────────

const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4].map((i) => (
      <Skeleton key={i} className="h-20 w-full rounded-2xl" />
    ))}
  </div>
);

// ─── Page ────────────────────────────────────────────────────────────────────

const Financeiro = () => {
  const { user, office } = useAuth();
  const officeId = office?.id ?? user?.office_id;

  const { query, create, update, remove, markPago } = useFinanceiro(officeId);
  const items = query.data ?? [];

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<FinanceiroItem | null>(null);
  const [defaultTipo, setDefaultTipo] = useState<TipoType>("receita");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Stats
  const hoje = new Date();
  const mesStart = startOfMonth(hoje);
  const mesEnd = endOfMonth(hoje);

  const stats = useMemo(() => {
    const receitaMes = items
      .filter((i) => i.tipo === "receita" && !isBefore(parseISO(i.data_vencimento), mesStart) && !isAfter(parseISO(i.data_vencimento), mesEnd))
      .reduce((acc, i) => acc + i.valor, 0);

    const aReceber = items
      .filter((i) => i.tipo === "receita" && (i.status === "pendente" || i.status === "vencido"))
      .reduce((acc, i) => acc + i.valor, 0);

    const aPagar = items
      .filter((i) => i.tipo === "despesa" && (i.status === "pendente" || i.status === "vencido"))
      .reduce((acc, i) => acc + i.valor, 0);

    const receitasPagasMes = items
      .filter((i) => i.tipo === "receita" && i.status === "pago" && i.data_pagamento &&
        !isBefore(parseISO(i.data_pagamento), mesStart) && !isAfter(parseISO(i.data_pagamento), mesEnd))
      .reduce((acc, i) => acc + i.valor, 0);

    const despesasPagasMes = items
      .filter((i) => i.tipo === "despesa" && i.status === "pago" && i.data_pagamento &&
        !isBefore(parseISO(i.data_pagamento), mesStart) && !isAfter(parseISO(i.data_pagamento), mesEnd))
      .reduce((acc, i) => acc + i.valor, 0);

    return { receitaMes, aReceber, aPagar, saldo: receitasPagasMes - despesasPagasMes };
  }, [items]);

  // Categorias disponíveis
  const categorias = useMemo(() => {
    const cats = new Set(items.map((i) => i.categoria).filter(Boolean) as string[]);
    return Array.from(cats);
  }, [items]);

  // Filter
  const filtered = useMemo(() => {
    return items.filter((i) => {
      const q = busca.toLowerCase();
      const matchBusca =
        !busca ||
        i.descricao.toLowerCase().includes(q) ||
        (i.clientes?.nome?.toLowerCase().includes(q) ?? false);
      const matchStatus = filtroStatus === "todos" || i.status === filtroStatus;
      const matchCat = filtroCategoria === "todas" || i.categoria === filtroCategoria;
      return matchBusca && matchStatus && matchCat;
    });
  }, [items, busca, filtroStatus, filtroCategoria]);

  const receber = filtered.filter((i) => i.tipo === "receita");
  const pagar = filtered.filter((i) => i.tipo === "despesa");

  const openNew = (tipo: TipoType) => {
    setEditItem(null);
    setDefaultTipo(tipo);
    setDialogOpen(true);
  };

  const openEdit = (item: FinanceiroItem) => {
    setEditItem(item);
    setDefaultTipo(item.tipo);
    setDialogOpen(true);
  };

  const handleSave = (data: Omit<FinanceiroItem, "id" | "deletado" | "clientes">) => {
    create.mutate(data, { onSuccess: () => setDialogOpen(false) });
  };

  const handleUpdate = (data: Partial<FinanceiroItem> & { id: string }) => {
    update.mutate(data, { onSuccess: () => setDialogOpen(false) });
  };

  const handleMarkPago = (id: string) => {
    setLoadingId(id);
    markPago.mutate(id, { onSettled: () => setLoadingId(null) });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Confirmar exclusão?")) return;
    remove.mutate(id);
  };

  const formInitial = editItem
    ? {
        tipo: editItem.tipo,
        descricao: editItem.descricao,
        valor: String(editItem.valor),
        data_vencimento: editItem.data_vencimento,
        status: editItem.status,
        categoria: editItem.categoria ?? NONE,
        cliente_id: editItem.cliente_id ?? NONE,
        processo_id: editItem.processo_id ?? NONE,
      }
    : defaultForm(defaultTipo);

  return (
    <PermissionGuard permission="canViewFinanceiro" showDeniedMessage>
      <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-12 overflow-x-hidden entry-animate">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <DollarSign className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">
                Gestão Financeira
              </h1>
            </div>
            <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl">
              Visualize o fluxo de caixa, honorários e a saúde financeira do seu escritório.
            </p>
          </div>

          <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl border border-black/5 dark:border-border bg-black/[0.02] dark:bg-muted/30 shadow-premium">
            <Button
              size="lg"
              variant="outline"
              className="rounded-xl h-12 px-6 font-black uppercase text-xs tracking-widest"
              onClick={() => openNew("despesa")}
            >
              <TrendingDown className="mr-2 h-4 w-4 text-orange-500" />
              Nova Despesa
            </Button>
            <Button
              size="lg"
              className="rounded-xl h-12 px-8 font-black uppercase text-xs tracking-widest bg-primary hover:bg-primary/90 shadow-premium"
              onClick={() => openNew("receita")}
            >
              <Plus className="mr-2 h-5 w-5" />
              Nova Receita
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Receita do Mês", value: fmt(stats.receitaMes), icon: TrendingUp, color: "emerald" },
            { label: "A Receber", value: fmt(stats.aReceber), icon: CreditCard, color: "primary" },
            { label: "A Pagar", value: fmt(stats.aPagar), icon: TrendingDown, color: "orange" },
            { label: "Saldo Líquido", value: fmt(stats.saldo), icon: DollarSign, color: "primary" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass-card p-6 rounded-3xl shadow-premium border border-black/5 dark:border-border bg-card/40 hover-lift group">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
                <div className={cn("p-2 rounded-xl", color === "emerald" ? "bg-emerald-500/10" : color === "orange" ? "bg-orange-500/10" : "bg-primary/10")}>
                  <Icon className={cn("h-5 w-5", color === "emerald" ? "text-emerald-500" : color === "orange" ? "text-orange-500" : "text-primary")} />
                </div>
              </div>
              <p className={cn("text-3xl font-black tracking-tighter", color === "primary" && label === "Saldo Líquido" ? "text-primary" : "text-foreground")}>
                {query.isLoading ? <Skeleton className="h-8 w-32" /> : value}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              placeholder="Buscar por descrição ou cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-44 rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-full sm:w-52 rounded-xl">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="todos" className="w-full space-y-8">
          <div className="glass-card p-2 rounded-3xl inline-flex h-auto border border-black/5 dark:border-border bg-black/[0.02] dark:bg-muted/30 shadow-inner">
            <TabsList className="bg-transparent h-auto p-0 gap-1">
              {[
                { value: "receber", label: "A Receber" },
                { value: "pagar", label: "A Pagar" },
                { value: "todos", label: "Todos" },
              ].map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="rounded-2xl px-8 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-foreground data-[state=active]:shadow-lg transition-all"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {[
            { value: "receber", data: receber, emptyLabel: "Nenhuma receita encontrada", tipo: "receita" as TipoType },
            { value: "pagar", data: pagar, emptyLabel: "Nenhuma despesa encontrada", tipo: "despesa" as TipoType },
            { value: "todos", data: filtered, emptyLabel: "Nenhum registro encontrado", tipo: "receita" as TipoType },
          ].map(({ value, data, emptyLabel, tipo }) => (
            <TabsContent key={value} value={value} className="space-y-4 entry-animate">
              {query.isLoading ? (
                <LoadingSkeleton />
              ) : data.length === 0 ? (
                <EmptyState label={emptyLabel} onNew={() => openNew(tipo)} />
              ) : (
                data.map((item) => (
                  <FinanceiroRow
                    key={item.id}
                    item={item}
                    onMarkPago={handleMarkPago}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    loadingId={loadingId}
                  />
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Dialog */}
        {dialogOpen && (
          <FormDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            initial={formInitial}
            editId={editItem?.id}
            officeId={officeId ?? ""}
            userId={user?.id ?? ""}
            onSave={handleSave}
            onUpdate={handleUpdate}
            loading={create.isPending || update.isPending}
          />
        )}
      </div>
    </PermissionGuard>
  );
};

export default Financeiro;
