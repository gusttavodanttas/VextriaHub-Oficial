import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useOpenItemFromSearch } from "@/hooks/useOpenItemFromSearch";
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
  Loader2,
  Phone,
  Video,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mail,
  MapPin,
  Settings2,
  X,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const NONE = "__none__";

const TIPOS_FIXOS = [
  { value: "consulta",         label: "Consulta",        Icon: MessageSquare },
  { value: "reuniao",          label: "Reunião",          Icon: Users },
  { value: "telefonema",       label: "Telefonema",       Icon: Phone },
  { value: "video",            label: "Vídeo",            Icon: Video },
  { value: "presencial",       label: "Presencial",       Icon: MapPin },
  { value: "email",            label: "E-mail",           Icon: Mail },
];

const TIPOS_ATENDIMENTO = TIPOS_FIXOS; // referência estática para o tipoInfo helper

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
  responsavel_id: string;
}

const toNull = (v: string | null | undefined) =>
  !v || v === NONE || v.trim() === "" ? null : v;

const defaultForm = (userId = ""): FormState => ({
  tipo_atendimento: NONE,
  data_atendimento: format(new Date(), "yyyy-MM-dd"),
  hora_atendimento: format(new Date(), "HH:mm"),
  observacoes: "",
  status: "agendado",
  cliente_id: NONE,
  processo_id: NONE,
  responsavel_id: userId,
});

const tipoInfo = (tipo: string, extras: string[] = []) => {
  const fixo = TIPOS_FIXOS.find((t) => t.value === tipo);
  if (fixo) return fixo;
  if (extras.includes(tipo)) return { value: tipo, label: tipo, Icon: FileText };
  return { value: tipo, label: tipo, Icon: FileText };
};

// ─── Hook tipos customizados ─────────────────────────────────────────────────

const useAtendimentoTipos = (officeId: string) => {
  const queryClient = useQueryClient();

  const { data: extras = [] } = useQuery<string[]>({
    queryKey: ["office-settings-at", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data } = await supabase.from("offices").select("settings").eq("id", officeId).single();
      return ((data?.settings as any)?.at_tipos_extras as string[]) ?? [];
    },
  });

  const save = useCallback(async (tipos: string[]) => {
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", officeId).single();
    const merged = { ...(cur?.settings as any ?? {}), at_tipos_extras: tipos };
    await supabase.from("offices").update({ settings: merged }).eq("id", officeId);
    queryClient.invalidateQueries({ queryKey: ["office-settings-at", officeId] });
  }, [officeId, queryClient]);

  return { extras, save };
};

// ─── Gerenciar Tipos Dialog ───────────────────────────────────────────────────

const GerenciarTiposDialog: React.FC<{
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
        .select("*, clientes(nome)")
        .eq("office_id", officeId!)
        .order("data_atendimento", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((i: any) => !i.deletado) as Atendimento[];
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

interface MembroOpt { id: string; label: string; }

const FormDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  initial: FormState;
  editId?: string;
  officeId: string;
  userId: string;
  extras: string[];
  membros?: MembroOpt[];
  onSave: (data: any) => void;
  onUpdate: (data: any) => void;
  loading: boolean;
}> = ({ open, onClose, initial, editId, officeId, userId, extras, membros = [], onSave, onUpdate, loading }) => {
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
      responsavel_id: form.responsavel_id || userId || null,
    };
    if (editId) onUpdate({ id: editId, ...payload });
    else onSave(payload);
  };

  const tipoSel = tipoInfo(form.tipo_atendimento);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm p-0 rounded-3xl border border-black/5 dark:border-border shadow-premium" style={{maxHeight:"88vh",overflowY:"auto"}}>
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
            <div className="grid grid-cols-2 gap-1.5">
              {TIPOS_FIXOS.map(({ value, label, Icon }) => (
                <button key={value} type="button"
                  onClick={() => set("tipo_atendimento", value)}
                  className={cn(
                    "flex items-center gap-2 py-2 px-3 rounded-xl border text-left transition-all text-[11px] font-black uppercase tracking-wide",
                    form.tipo_atendimento === value
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "border-black/8 dark:border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted/30"
                  )}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
              {extras.map((label) => (
                <button key={label} type="button"
                  onClick={() => set("tipo_atendimento", label)}
                  className={cn(
                    "flex items-center gap-2 py-2 px-3 rounded-xl border text-left transition-all text-[11px] font-black uppercase tracking-wide",
                    form.tipo_atendimento === label
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "border-black/8 dark:border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted/30"
                  )}>
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
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

          {/* Responsável */}
          {membros.length > 0 && (
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Responsável</Label>
              <Select value={form.responsavel_id} onValueChange={(v) => set("responsavel_id", v)}>
                <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                <SelectContent>
                  {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
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

      {/* Cliente */}
      {item.clientes?.nome && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3.5 w-3.5 text-primary/60" />
          <span className="font-semibold">{item.clientes.nome}</span>
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
  const { extras, save: saveExtras } = useAtendimentoTipos(officeId);
  const { users: officeUsers } = useOfficeUsers();
  const membros = useMemo(() => officeUsers.map(u => ({
    id: u.user_id,
    label: u.profile?.full_name || u.profile?.email || "Membro",
  })), [officeUsers]);
  const items = query.data ?? [];

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [tiposDialogOpen, setTiposDialogOpen] = useState(false);
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

  // Abre o atendimento específico vindo de ?openId= (ex.: painel da equipe)
  useOpenItemFromSearch("/atendimentos", !query.isLoading && items.length > 0, (openId) => {
    const it = items.find(x => String(x.id) === openId);
    if (it) openEdit(it);
  });

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
        responsavel_id: (editItem as any).responsavel_id ?? user?.id ?? "",
      }
    : defaultForm(user?.id ?? "");

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
        <div className="flex gap-2">
          <Button size="icon" variant="outline" onClick={() => setTiposDialogOpen(true)}
            className="h-11 w-11 rounded-xl" title="Gerenciar tipos de atendimento">
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button size="lg" onClick={openNew}
            className="rounded-xl h-11 px-6 font-black uppercase text-xs tracking-widest shadow-premium">
            <Plus className="mr-2 h-4 w-4" />Novo Atendimento
          </Button>
        </div>
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
            {TIPOS_FIXOS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
            {extras.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
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

      {/* Dialog form */}
      {dialogOpen && (
        <FormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          initial={formInitial}
          editId={editItem?.id}
          officeId={officeId}
          userId={user?.id ?? ""}
          extras={extras}
          membros={membros}
          onSave={handleSave}
          onUpdate={handleUpdate}
          loading={create.isPending || update.isPending}
        />
      )}

      {/* Dialog gerenciar tipos */}
      <GerenciarTiposDialog
        open={tiposDialogOpen}
        onClose={() => setTiposDialogOpen(false)}
        extras={extras}
        onSave={saveExtras}
      />
    </div>
  );
};

export default Atendimentos;
