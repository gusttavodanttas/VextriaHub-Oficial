import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  MessageSquare,
  Plus,
  Search,
  Pencil,
  Trash2,
  Clock,
  User,
  FileText,
  Calendar,
  Loader2,
  Phone,
  Video,
  Users,
  Gavel,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const NONE = "__none__";

const TIPOS_ATENDIMENTO = [
  { value: "consulta",       label: "Consulta",         Icon: MessageSquare },
  { value: "reuniao",        label: "Reunião",           Icon: Users },
  { value: "audiencia",      label: "Audiência",         Icon: Gavel },
  { value: "telefonema",     label: "Telefonema",        Icon: Phone },
  { value: "videoconferencia", label: "Videoconferência", Icon: Video },
  { value: "outro",          label: "Outro",             Icon: FileText },
];

const STATUS_CONFIG = {
  agendado:  { label: "Agendado",  className: "border-blue-500/50 text-blue-500 bg-blue-500/10",     Icon: Clock },
  realizado: { label: "Realizado", className: "border-emerald-500/50 text-emerald-500 bg-emerald-500/10", Icon: CheckCircle2 },
  cancelado: { label: "Cancelado", className: "border-red-500/50 text-red-500 bg-red-500/10",         Icon: XCircle },
  pendente:  { label: "Pendente",  className: "border-yellow-500/50 text-yellow-500 bg-yellow-500/10", Icon: AlertCircle },
} as const;

type StatusType = keyof typeof STATUS_CONFIG;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Atendimento {
  id: string;
  tipo_atendimento: string;
  data_atendimento: string;
  observacoes: string | null;
  status: StatusType;
  cliente_id: string | null;
  processo_id: string | null;
  user_id: string;
  office_id: string;
  deletado: boolean;
  clientes?: { nome: string } | null;
  processos?: { titulo: string; numero_processo: string } | null;
}

interface ClienteOpt { id: string; nome: string; }
interface ProcessoOpt { id: string; titulo: string; numero: string; }

interface FormState {
  tipo_atendimento: string;
  data_atendimento: string;
  hora_atendimento: string;
  observacoes: string;
  status: StatusType;
  cliente_id: string;
  processo_id: string;
}

const toNull = (v: string | null | undefined) =>
  !v || v === NONE || v.trim() === "" ? null : v;

const defaultForm = (): FormState => ({
  tipo_atendimento: NONE,
  data_atendimento: format(new Date(), "yyyy-MM-dd"),
  hora_atendimento: format(new Date(), "HH:mm"),
  observacoes: "",
  status: "agendado",
  cliente_id: NONE,
  processo_id: NONE,
});

const tipoInfo = (tipo: string) =>
  TIPOS_ATENDIMENTO.find((t) => t.value === tipo) ?? TIPOS_ATENDIMENTO[TIPOS_ATENDIMENTO.length - 1];

// ─── Hook ────────────────────────────────────────────────────────────────────

const useAtendimentos = (officeId: string | null | undefined) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["atendimentos", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos")
        .select("*, clientes!cliente_id(nome), processos!processo_id(titulo, numero_processo)")
        .eq("office_id", officeId!)
        .eq("deletado", false)
        .order("data_atendimento", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Atendimento[];
    },
  });

  const invalidate = useCallback(() =>
    queryClient.invalidateQueries({ queryKey: ["atendimentos", officeId] }),
    [queryClient, officeId]
  );

  const create = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from("atendimentos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Atendimento registrado!" }); },
    onError: (e: Error) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const { error } = await supabase.from("atendimentos").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Atendimento atualizado!" }); },
    onError: (e: Error) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("atendimentos").update({ deletado: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Atendimento excluído!" }); },
    onError: (e: Error) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  const markRealizado = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("atendimentos").update({ status: "realizado" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Marcado como realizado!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { query, create, update, remove, markRealizado };
};

// ─── Form Dialog ─────────────────────────────────────────────────────────────

const FormDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  initial: FormState;
  editId?: string;
  officeId: string;
  userId: string;
  onSave: (data: any) => void;
  onUpdate: (data: any) => void;
  loading: boolean;
}> = ({ open, onClose, initial, editId, officeId, userId, onSave, onUpdate, loading }) => {
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  useEffect(() => { if (open) setForm(initial); }, [open]);

  const { data: clientes = [] } = useQuery<ClienteOpt[]>({
    queryKey: ["clientes-at", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome")
        .eq("office_id", officeId).eq("deletado", false).order("nome");
      return (data ?? []) as ClienteOpt[];
    },
  });

  const clienteSelecionado = form.cliente_id !== NONE && !!form.cliente_id;

  const { data: processos = [] } = useQuery<ProcessoOpt[]>({
    queryKey: ["processos-at", officeId, form.cliente_id],
    enabled: !!officeId && clienteSelecionado,
    queryFn: async () => {
      const { data } = await supabase.from("processos")
        .select("id, numero_processo, titulo")
        .eq("office_id", officeId)
        .eq("cliente_id", form.cliente_id)
        .eq("deletado", false);
      return (data ?? []).map((p: any) => ({
        id: p.id,
        titulo: p.titulo || p.numero_processo || p.id,
        numero: p.numero_processo || "",
      }));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const datetime = `${form.data_atendimento}T${form.hora_atendimento}:00`;
    const payload = {
      tipo_atendimento: toNull(form.tipo_atendimento),
      data_atendimento: datetime,
      observacoes: form.observacoes.trim() || null,
      status: form.status,
      cliente_id: toNull(form.cliente_id),
      processo_id: toNull(form.processo_id),
      user_id: userId,
      office_id: officeId,
      deletado: false,
    };
    if (editId) onUpdate({ id: editId, ...payload });
    else onSave(payload);
  };

  const tipoSel = tipoInfo(form.tipo_atendimento);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm p-0 rounded-3xl border border-black/5 dark:border-border shadow-premium" style={{maxHeight:"88vh",overflowY:"auto"}}>
        <div className="px-5 pt-4 pb-3 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                <MessageSquare className="h-4 w-4" />
              </div>
              <DialogTitle className="text-lg font-black tracking-tight">
                {editId ? "Editar Atendimento" : "Novo Atendimento"}
              </DialogTitle>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo *</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {TIPOS_ATENDIMENTO.map(({ value, label, Icon }) => (
                <button key={value} type="button"
                  onClick={() => set("tipo_atendimento", value)}
                  className={cn(
                    "flex items-center gap-1.5 py-2 px-2 rounded-xl border text-left transition-all text-[10px] font-black uppercase tracking-wide",
                    form.tipo_atendimento === value
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "border-black/8 dark:border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted/30"
                  )}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Data + Hora + Status em linha */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data *</Label>
              <Input required type="date" value={form.data_atendimento}
                onChange={(e) => set("data_atendimento", e.target.value)}
                className="rounded-xl h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hora *</Label>
              <Input required type="time" value={form.hora_atendimento}
                onChange={(e) => set("hora_atendimento", e.target.value)}
                className="rounded-xl h-9 text-sm" />
            </div>
          </div>

          {/* Status + Cliente em linha */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as StatusType)}>
                <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agendado">Agendado</SelectItem>
                  <SelectItem value="realizado">Realizado</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</Label>
              <Select value={form.cliente_id} onValueChange={(v) => { set("cliente_id", v); set("processo_id", NONE); }}>
                <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Processo */}
          {clienteSelecionado && (
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Processo</Label>
              <Select value={form.processo_id} onValueChange={(v) => set("processo_id", v)}>
                <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {processos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.titulo}{p.numero && p.numero !== p.titulo ? ` — ${p.numero}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)}
              className="rounded-xl text-sm resize-none" rows={2}
              placeholder="Detalhes do atendimento..." />
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}
              className="flex-1 rounded-xl h-9 font-black uppercase text-[10px] tracking-widest">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || form.tipo_atendimento === NONE}
              className="flex-1 rounded-xl h-9 font-black uppercase text-[10px] tracking-widest shadow-premium">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? "Salvar" : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ─── Card ────────────────────────────────────────────────────────────────────

const AtendimentoCard: React.FC<{
  item: Atendimento;
  onEdit: (item: Atendimento) => void;
  onDelete: (id: string) => void;
  onMarkRealizado: (id: string) => void;
  loadingId: string | null;
}> = ({ item, onEdit, onDelete, onMarkRealizado, loadingId }) => {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pendente;
  const { Icon: StatusIcon } = cfg;
  const { label: tipoLabel, Icon: TipoIcon } = tipoInfo(item.tipo_atendimento);
  const dataAt = parseISO(item.data_atendimento);

  return (
    <div className="glass-card hover-lift rounded-2xl border border-black/5 dark:border-border bg-card/40 shadow-premium p-5 flex flex-col gap-3 group transition-all">
      {/* Topo: tipo + status + ações */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-all duration-300">
            <TipoIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="font-black text-sm tracking-tight group-hover:text-primary transition-colors">{tipoLabel}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {format(dataAt, "dd 'de' MMM 'de' yyyy", { locale: ptBR })} · {format(dataAt, "HH:mm")}
            </p>
          </div>
        </div>
        <Badge className={cn("px-2.5 py-1 rounded-xl text-[9px] uppercase tracking-widest font-black flex items-center gap-1 shrink-0", cfg.className)}>
          <StatusIcon className="h-3 w-3" />
          {cfg.label}
        </Badge>
      </div>

      {/* Cliente + Processo */}
      {(item.clientes?.nome || item.processos) && (
        <div className="flex flex-col gap-1">
          {item.clientes?.nome && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5 text-primary/60" />
              <span className="font-semibold">{item.clientes.nome}</span>
            </div>
          )}
          {item.processos && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 text-primary/60" />
              <span className="truncate">{item.processos.titulo || item.processos.numero_processo}</span>
            </div>
          )}
        </div>
      )}

      {/* Observações */}
      {item.observacoes && (
        <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2 border-l-2 border-primary/20 pl-3">
          {item.observacoes}
        </p>
      )}

      {/* Rodapé: tempo relativo + ações */}
      <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-border/50">
        <span className="text-[10px] text-muted-foreground/50 font-medium">
          {formatDistanceToNow(dataAt, { locale: ptBR, addSuffix: true })}
        </span>
        <div className="flex gap-1">
          {item.status === "agendado" && (
            <Button size="icon" variant="ghost"
              className="h-7 w-7 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500"
              onClick={() => onMarkRealizado(item.id)} disabled={loadingId === item.id}
              title="Marcar como realizado">
              {loadingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Button size="icon" variant="ghost"
            className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary"
            onClick={() => onEdit(item)} title="Editar">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost"
            className="h-7 w-7 rounded-lg hover:bg-red-500/10 hover:text-red-500"
            onClick={() => onDelete(item.id)} title="Excluir">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: number | string; Icon: React.FC<any>; color: string }> = ({ label, value, Icon, color }) => (
  <div className="glass-card rounded-2xl border border-black/5 dark:border-border bg-card/40 shadow-premium p-5 flex items-center gap-4">
    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", color)}>
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className="text-2xl font-black tracking-tight">{value}</p>
    </div>
  </div>
);

// ─── Page ────────────────────────────────────────────────────────────────────

const Atendimentos = () => {
  const { user, office } = useAuth();
  const officeId = office?.id ?? user?.office_id ?? "";

  const { query, create, update, remove, markRealizado } = useAtendimentos(officeId);
  const items = query.data ?? [];

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Atendimento | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Stats
  const stats = useMemo(() => ({
    total: items.length,
    agendados: items.filter((i) => i.status === "agendado").length,
    realizados: items.filter((i) => i.status === "realizado").length,
    cancelados: items.filter((i) => i.status === "cancelado").length,
  }), [items]);

  const filtered = useMemo(() => items.filter((i) => {
    const q = busca.toLowerCase();
    const matchBusca = !busca
      || i.tipo_atendimento.toLowerCase().includes(q)
      || (i.clientes?.nome?.toLowerCase().includes(q) ?? false)
      || (i.observacoes?.toLowerCase().includes(q) ?? false);
    const matchStatus = filtroStatus === "todos" || i.status === filtroStatus;
    const matchTipo = filtroTipo === "todos" || i.tipo_atendimento === filtroTipo;
    return matchBusca && matchStatus && matchTipo;
  }), [items, busca, filtroStatus, filtroTipo]);

  const openNew = () => { setEditItem(null); setDialogOpen(true); };
  const openEdit = (item: Atendimento) => { setEditItem(item); setDialogOpen(true); };

  const handleSave = (data: any) => {
    create.mutate(data, { onSuccess: () => setDialogOpen(false) });
  };

  const handleUpdate = (data: any) => {
    update.mutate(data, { onSuccess: () => setDialogOpen(false) });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Confirmar exclusão?")) return;
    remove.mutate(id);
  };

  const handleMarkRealizado = (id: string) => {
    setLoadingId(id);
    markRealizado.mutate(id, { onSettled: () => setLoadingId(null) });
  };

  const formInitial: FormState = editItem
    ? {
        tipo_atendimento: editItem.tipo_atendimento || NONE,
        data_atendimento: format(parseISO(editItem.data_atendimento), "yyyy-MM-dd"),
        hora_atendimento: format(parseISO(editItem.data_atendimento), "HH:mm"),
        observacoes: editItem.observacoes ?? "",
        status: editItem.status,
        cliente_id: editItem.cliente_id ?? NONE,
        processo_id: editItem.processo_id ?? NONE,
      }
    : defaultForm();

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 overflow-x-hidden entry-animate">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Atendimentos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Registre e acompanhe todos os atendimentos do escritório.
            </p>
          </div>
        </div>
        <Button size="lg" onClick={openNew}
          className="rounded-xl h-11 px-6 font-black uppercase text-xs tracking-widest shadow-premium">
          <Plus className="mr-2 h-4 w-4" />Novo Atendimento
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} Icon={MessageSquare} color="bg-primary/10 text-primary" />
        <StatCard label="Agendados" value={stats.agendados} Icon={Clock} color="bg-blue-500/10 text-blue-500" />
        <StatCard label="Realizados" value={stats.realizados} Icon={CheckCircle2} color="bg-emerald-500/10 text-emerald-500" />
        <StatCard label="Cancelados" value={stats.cancelados} Icon={XCircle} color="bg-red-500/10 text-red-500" />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, tipo ou observação..."
            className="pl-10 rounded-xl h-11 bg-card/60 border-black/8 dark:border-border" />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full sm:w-44 rounded-xl h-11 bg-card/60 border-black/8 dark:border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="agendado">Agendado</SelectItem>
            <SelectItem value="realizado">Realizado</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-full sm:w-48 rounded-xl h-11 bg-card/60 border-black/8 dark:border-border text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS_ATENDIMENTO.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contagem */}
      {!query.isLoading && (
        <p className="text-xs text-muted-foreground/60 font-bold uppercase tracking-widest -mt-4">
          {filtered.length} atendimento{filtered.length !== 1 ? "s" : ""}
          {(filtroStatus !== "todos" || filtroTipo !== "todos" || busca) ? " encontrado" + (filtered.length !== 1 ? "s" : "") : ""}
        </p>
      )}

      {/* Grid */}
      {query.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="h-16 w-16 rounded-3xl bg-muted/30 flex items-center justify-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <div>
            <p className="text-lg font-black text-muted-foreground/60">
              {busca || filtroStatus !== "todos" || filtroTipo !== "todos"
                ? "Nenhum atendimento encontrado"
                : "Nenhum atendimento registrado"}
            </p>
            <p className="text-sm text-muted-foreground/40 mt-1">
              {busca || filtroStatus !== "todos" || filtroTipo !== "todos"
                ? "Tente ajustar os filtros."
                : "Clique em Novo Atendimento para começar."}
            </p>
          </div>
          {!busca && filtroStatus === "todos" && filtroTipo === "todos" && (
            <Button onClick={openNew} className="rounded-xl font-black uppercase text-[10px] tracking-widest shadow-premium mt-2">
              <Plus className="h-4 w-4 mr-2" />Registrar primeiro atendimento
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <AtendimentoCard key={item.id} item={item}
              onEdit={openEdit} onDelete={handleDelete}
              onMarkRealizado={handleMarkRealizado} loadingId={loadingId} />
          ))}
        </div>
      )}

      {/* Dialog */}
      {dialogOpen && (
        <FormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          initial={formInitial}
          editId={editItem?.id}
          officeId={officeId}
          userId={user?.id ?? ""}
          onSave={handleSave}
          onUpdate={handleUpdate}
          loading={create.isPending || update.isPending}
        />
      )}
    </div>
  );
};

export default Atendimentos;
