import React, { useState, useMemo, useEffect, useCallback, useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RECORRENCIAS, continueOccurrences, type RecRule } from "@/lib/recorrencia";
import { safeParseISO, fmtSafe } from "@/lib/dates";
import { normalizeAtendimentoStatus } from "@/lib/status";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useOpenItemFromSearch } from "@/hooks/useOpenItemFromSearch";
import { useTarefas } from "@/hooks/useTarefas";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ClientSelect } from "@/components/Clientes/ClientSelect";
import { AvisoDiasSelect } from "@/components/Notifications/AvisoDiasSelect";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
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
  RotateCcw,
  CalendarPlus,
  ListTodo,
  PhoneCall,
  ArrowRight,
  Repeat,
  CalendarDays,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow, addDays, startOfWeek, isSameDay } from "date-fns";
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

// Parse/format seguros centralizados em @/lib/dates (data inválida nunca derruba o render)

// Proximidade de atendimentos futuros agendados/pendentes
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const diasAteData = (data: Date) =>
  Math.round((startOfDay(data).getTime() - startOfDay(new Date()).getTime()) / 86400000);

const proximidadeBadge = (item: { data_atendimento: string; status: StatusType }) => {
  if (item.status !== "agendado" && item.status !== "pendente") return null;
  const dias = diasAteData(parseISO(item.data_atendimento));
  if (dias < 0 || dias > 7) return null;
  if (dias === 0) return { label: "Hoje", className: "border-red-500/50 text-red-500 bg-red-500/10" };
  if (dias === 1) return { label: "Amanhã", className: "border-orange-500/50 text-orange-500 bg-orange-500/10" };
  return { label: `Em ${dias} dias`, className: "border-amber-500/50 text-amber-600 bg-amber-500/10" };
};

// Agrupamento temporal dos cards
const ORDEM_GRUPOS = ["hoje", "semana", "futuros", "passados"] as const;
type GrupoKey = (typeof ORDEM_GRUPOS)[number];
const LABEL_GRUPOS: Record<GrupoKey, string> = {
  hoje: "Hoje", semana: "Esta semana", futuros: "Próximos", passados: "Passados",
};
const grupoDe = (item: { data_atendimento: string }): GrupoKey => {
  const d = diasAteData(parseISO(item.data_atendimento));
  if (d < 0) return "passados";
  if (d === 0) return "hoje";
  if (d <= 7) return "semana";
  return "futuros";
};

// Sobreposição de horários (conflito de agenda do mesmo responsável)
const DURACAO_PADRAO_MIN = 30;
const haConflito = (
  startMs: number, durMin: number,
  it: { data_atendimento: string; duracao?: number | null },
) => {
  const end = startMs + (durMin > 0 ? durMin : DURACAO_PADRAO_MIN) * 60000;
  const s2 = parseISO(it.data_atendimento).getTime();
  const d2 = it.duracao && it.duracao > 0 ? it.duracao : DURACAO_PADRAO_MIN;
  const e2 = s2 + d2 * 60000;
  return startMs < e2 && s2 < end;
};

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
  duracao?: number | null;
  avisos_dias?: number[] | null;
  resultado?: string | null;
  responsavel_id?: string | null;
  recorrencia_grupo?: string | null;
  recorrencia_regra?: string | null;
  recorrencia_restantes?: number | null;
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
  duracao: string;
  avisos_dias: number[] | null;
  resultado: string;
  recorrencia: string;
  ocorrencias: string;
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
  duracao: "",
  avisos_dias: null,
  resultado: "",
  recorrencia: "nenhuma",
  ocorrencias: "4",
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
    mutationFn: async (item: Atendimento) => {
      const { error } = await supabase.from("atendimentos").update({ status: "realizado" }).eq("id", item.id);
      if (error) throw error;

      // Recorrência encadeada: ao concluir, gera a PRÓXIMA ocorrência (best-effort)
      const rule = item.recorrencia_regra as RecRule | null;
      const restantes = item.recorrencia_restantes ?? 0;
      if (rule && restantes > 0 && item.data_atendimento) {
        const base = parseISO(item.data_atendimento);
        const next = continueOccurrences(base, rule, 1)[0];
        const row: any = {
          tipo_atendimento: item.tipo_atendimento,
          data_atendimento: format(next, "yyyy-MM-dd'T'HH:mm:ss"),
          observacoes: item.observacoes ?? null,
          status: "agendado",
          cliente_id: item.cliente_id ?? null,
          processo_id: item.processo_id ?? null,
          user_id: item.user_id,
          office_id: item.office_id,
          deletado: false,
          responsavel_id: item.responsavel_id ?? null,
          duracao: item.duracao ?? null,
          recorrencia_grupo: item.recorrencia_grupo ?? null,
          recorrencia_regra: rule,
          recorrencia_restantes: restantes - 1,
          ...(Array.isArray(item.avisos_dias) ? { avisos_dias: item.avisos_dias } : {}),
        };
        await supabase.from("atendimentos").insert(row);
      }
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
  existing?: Atendimento[];
  onSave: (data: any) => void;
  onUpdate: (data: any) => void;
  loading: boolean;
}> = ({ open, onClose, initial, editId, officeId, userId, extras, membros = [], existing = [], onSave, onUpdate, loading }) => {
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  useEffect(() => { if (open) setForm(initial); }, [open]);

  // Ao editar, se não há cliente mas há processo vinculado, puxa o cliente do processo
  useEffect(() => {
    if (!open || !editId) return;
    const semCliente = initial.cliente_id === NONE || !initial.cliente_id;
    const temProcesso = initial.processo_id !== NONE && !!initial.processo_id;
    if (!semCliente || !temProcesso) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("processos").select("cliente_id").eq("id", initial.processo_id).maybeSingle();
      if (!cancelled && data?.cliente_id) setForm((prev) => ({ ...prev, cliente_id: data.cliente_id as string }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

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

  // Conflito de horário: mesmo responsável, status ativo, janelas sobrepostas
  const conflitos = useMemo(() => {
    if (form.status !== "agendado" && form.status !== "pendente") return [];
    if (!form.data_atendimento || !form.hora_atendimento) return [];
    const startMs = new Date(`${form.data_atendimento}T${form.hora_atendimento}:00`).getTime();
    if (Number.isNaN(startMs)) return [];
    const dur = form.duracao ? Number(form.duracao) : 0;
    const resp = form.responsavel_id;
    return existing.filter((it) => {
      if (editId && it.id === editId) return false;
      if (it.status !== "agendado" && it.status !== "pendente") return false;
      const itResp = (it as any).responsavel_id;
      if (resp && itResp && itResp !== resp) return false;
      return haConflito(startMs, dur, it);
    });
  }, [existing, form.data_atendimento, form.hora_atendimento, form.duracao, form.responsavel_id, form.status, editId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const datetime = `${form.data_atendimento}T${form.hora_atendimento}:00`;
    const recorrente = !editId && form.recorrencia !== "nenhuma";
    const payload: any = {
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
      duracao: form.duracao ? Number(form.duracao) : null,
      ...((form.avisos_dias != null || editId) ? { avisos_dias: form.avisos_dias } : {}),
      ...((form.resultado.trim() || (editId && form.status === "realizado")) ? { resultado: form.resultado.trim() || null } : {}),
    };
    if (recorrente) {
      const n = Math.max(1, Math.min(52, parseInt(form.ocorrencias) || 1));
      payload.recorrencia_grupo = (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      payload.recorrencia_regra = form.recorrencia;
      payload.recorrencia_restantes = n - 1;
    }
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

          {/* Aviso de conflito de horário */}
          {conflitos.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-500 font-semibold leading-snug">
                Conflito de horário com {conflitos.length} atendimento{conflitos.length > 1 ? "s" : ""}:{" "}
                {conflitos.slice(0, 2).map((c) =>
                  `${c.clientes?.nome || tipoInfo(c.tipo_atendimento).label} (${fmtSafe(c.data_atendimento, "HH:mm")})`
                ).join(", ")}{conflitos.length > 2 ? "…" : ""}
              </p>
            </div>
          )}

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
              <ClientSelect
                value={form.cliente_id === NONE ? "" : form.cliente_id}
                onValueChange={(id) => { set("cliente_id", id); set("processo_id", NONE); }}
                placeholder="Selecionar cliente"
              />
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

          {/* Duração + Avisar */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Duração (min)</Label>
              <Input type="number" min={0} value={form.duracao}
                onChange={(e) => set("duracao", e.target.value)}
                placeholder="Ex: 60" className="rounded-xl h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avisar</Label>
              <AvisoDiasSelect value={form.avisos_dias} onChange={(v) => set("avisos_dias", v)} />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)}
              className="rounded-xl text-sm resize-none" rows={2}
              placeholder="Detalhes do atendimento..." />
          </div>

          {/* Resultado (somente quando realizado) */}
          {form.status === "realizado" && (
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resultado / desfecho</Label>
              <Textarea value={form.resultado} onChange={(e) => set("resultado", e.target.value)}
                className="rounded-xl text-sm resize-none" rows={2}
                placeholder="O que ficou decidido?" />
            </div>
          )}

          {/* Recorrência (somente em novo atendimento) */}
          {!editId && (
            <div className="rounded-2xl border border-black/5 dark:border-border bg-card/40 p-3 space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                <Repeat className="h-3.5 w-3.5" /> Recorrência
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={form.recorrencia} onValueChange={(v) => set("recorrencia", v)}>
                  <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECORRENCIAS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.recorrencia !== "nenhuma" && (
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={52} value={form.ocorrencias}
                      onChange={(e) => set("ocorrencias", e.target.value)}
                      className="rounded-xl h-9 text-sm" />
                    <span className="text-[11px] text-muted-foreground font-semibold whitespace-nowrap">vezes</span>
                  </div>
                )}
              </div>
              {form.recorrencia !== "nenhuma" && (
                <p className="text-[11px] text-muted-foreground/70">
                  Cria o 1º atendimento; ao concluí-lo, o próximo é gerado automaticamente (até {Math.max(1, Math.min(52, parseInt(form.ocorrencias) || 1))} ocorrências).
                </p>
              )}
            </div>
          )}

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

// ─── Follow-up Dialog (após concluir) ─────────────────────────────────────────

const FollowUpDialog: React.FC<{
  item: Atendimento | null;
  onClose: () => void;
  onAgendarProximo: (item: Atendimento) => void;
}> = ({ item, onClose, onAgendarProximo }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { create: createTarefa } = useTarefas();

  const [modo, setModo] = useState<null | "tarefa" | "contato">(null);
  const [resultado, setResultado] = useState("");
  const [tarefaTitulo, setTarefaTitulo] = useState("");
  const [tarefaData, setTarefaData] = useState("");
  const [contatoData, setContatoData] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setModo(null);
      setResultado(item.resultado ?? "");
      setTarefaTitulo(`Follow-up — ${item.clientes?.nome || tipoInfo(item.tipo_atendimento).label}`);
      setTarefaData(format(addDays(new Date(), 3), "yyyy-MM-dd"));
      setContatoData(format(addDays(new Date(), 30), "yyyy-MM-dd"));
    }
  }, [item]);

  if (!item) return null;

  // Salva o desfecho no atendimento (best-effort) se houve mudança
  const persistResultado = async () => {
    const val = resultado.trim();
    if (val === (item.resultado ?? "").trim()) return;
    await supabase.from("atendimentos").update({ resultado: val || null }).eq("id", item.id);
    queryClient.invalidateQueries({ queryKey: ["atendimentos"] });
  };

  const fechar = async () => { await persistResultado(); onClose(); };
  const irProximo = async () => { await persistResultado(); onAgendarProximo(item); };

  const salvarTarefa = async () => {
    if (!tarefaTitulo.trim()) return;
    setSaving(true);
    await persistResultado();
    createTarefa.mutate(
      {
        titulo: tarefaTitulo.trim(),
        descricao: null,
        data_vencimento: tarefaData || null,
        prioridade: "media",
        cliente_id: item.cliente_id ?? null,
        processo_id: item.processo_id ?? null,
        atendimento_id: item.id,
        responsavel_id: item.responsavel_id ?? user?.id ?? null,
      },
      { onSuccess: () => { setSaving(false); onClose(); }, onError: () => setSaving(false) }
    );
  };

  const salvarContato = async () => {
    if (!item.cliente_id || !contatoData) return;
    setSaving(true);
    await persistResultado();
    const { error } = await supabase.from("clientes")
      .update({ proximo_contato: contatoData }).eq("id", item.cliente_id);
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar contato", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Próximo contato definido!" });
    onClose();
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm p-0 rounded-3xl border border-black/5 dark:border-border shadow-premium overflow-hidden" style={{maxHeight:"88vh",overflowY:"auto"}}>
        <div className="px-5 pt-4 pb-3 bg-gradient-to-br from-emerald-500/10 via-emerald-500/4 to-transparent">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <DialogTitle className="text-lg font-black tracking-tight">Atendimento concluído</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-xs text-muted-foreground/70 mt-1.5 ml-0.5">
            {item.clientes?.nome ? `${item.clientes.nome} · ` : ""}Quer já encaminhar o próximo passo?
          </p>
        </div>

        <div className="px-5 pb-5 pt-3 space-y-2">
          {/* Resultado / desfecho */}
          <div className="space-y-1 pb-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resultado / desfecho (opcional)</Label>
            <Textarea value={resultado} onChange={(e) => setResultado(e.target.value)}
              rows={2} className="rounded-xl text-sm resize-none"
              placeholder="O que ficou decidido neste atendimento?" />
          </div>

          {/* Próximo atendimento */}
          <button onClick={irProximo}
            className="w-full flex items-center gap-3 rounded-xl border border-black/8 dark:border-border px-3 py-2.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-all group">
            <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><CalendarPlus className="h-4 w-4" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold">Agendar próximo atendimento</span>
              <span className="block text-[11px] text-muted-foreground/60">Mesmo cliente, daqui a 7 dias</span>
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </button>

          {/* Criar tarefa */}
          {modo !== "tarefa" ? (
            <button onClick={() => setModo("tarefa")}
              className="w-full flex items-center gap-3 rounded-xl border border-black/8 dark:border-border px-3 py-2.5 text-left hover:border-purple-500/40 hover:bg-purple-500/5 transition-all">
              <span className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0"><ListTodo className="h-4 w-4" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold">Criar tarefa de follow-up</span>
                <span className="block text-[11px] text-muted-foreground/60">Lembrete vinculado a este atendimento</span>
              </span>
            </button>
          ) : (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 px-3 py-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-purple-600">
                <ListTodo className="h-3.5 w-3.5" /> Nova tarefa
              </div>
              <Input value={tarefaTitulo} onChange={(e) => setTarefaTitulo(e.target.value)}
                placeholder="Título da tarefa" className="rounded-lg h-9 text-sm" />
              <Input type="date" value={tarefaData} onChange={(e) => setTarefaData(e.target.value)}
                className="rounded-lg h-9 text-sm" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setModo(null)} className="flex-1 rounded-lg h-8 text-[10px] font-black uppercase tracking-widest">Voltar</Button>
                <Button size="sm" onClick={salvarTarefa} disabled={saving || !tarefaTitulo.trim()} className="flex-1 rounded-lg h-8 text-[10px] font-black uppercase tracking-widest">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Criar tarefa"}
                </Button>
              </div>
            </div>
          )}

          {/* Próximo contato (CRM) */}
          {item.cliente_id && (modo !== "contato" ? (
            <button onClick={() => setModo("contato")}
              className="w-full flex items-center gap-3 rounded-xl border border-black/8 dark:border-border px-3 py-2.5 text-left hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
              <span className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"><PhoneCall className="h-4 w-4" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold">Definir próximo contato</span>
                <span className="block text-[11px] text-muted-foreground/60">Agenda de relacionamento (CRM)</span>
              </span>
            </button>
          ) : (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-3 py-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-blue-600">
                <PhoneCall className="h-3.5 w-3.5" /> Próximo contato
              </div>
              <Input type="date" value={contatoData} onChange={(e) => setContatoData(e.target.value)}
                className="rounded-lg h-9 text-sm" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setModo(null)} className="flex-1 rounded-lg h-8 text-[10px] font-black uppercase tracking-widest">Voltar</Button>
                <Button size="sm" onClick={salvarContato} disabled={saving || !contatoData} className="flex-1 rounded-lg h-8 text-[10px] font-black uppercase tracking-widest">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </div>
          ))}

          <Button variant="ghost" onClick={fechar}
            className="w-full rounded-xl h-9 mt-1 font-black uppercase text-[10px] tracking-widest text-muted-foreground/60">
            {resultado.trim() ? "Salvar e fechar" : "Pular por agora"}
          </Button>
        </div>
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
  onRemarcar: (item: Atendimento) => void;
  onClientClick: (clienteId: string) => void;
  loadingId: string | null;
}> = ({ item, onEdit, onDelete, onMarkRealizado, onRemarcar, onClientClick, loadingId }) => {
  const cfg = STATUS_CONFIG[normalizeAtendimentoStatus(item.status)];
  const { Icon: StatusIcon } = cfg;
  const { label: tipoLabel, Icon: TipoIcon } = tipoInfo(item.tipo_atendimento);
  const dataAt = parseISO(item.data_atendimento);
  const prox = proximidadeBadge(item);

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
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge className={cn("px-2.5 py-1 rounded-xl text-[9px] uppercase tracking-widest font-black flex items-center gap-1", cfg.className)}>
            <StatusIcon className="h-3 w-3" />
            {cfg.label}
          </Badge>
          {prox && (
            <Badge className={cn("px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-widest font-black", prox.className)}>
              {prox.label}
            </Badge>
          )}
          {item.recorrencia_regra && (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50" title="Atendimento recorrente">
              <Repeat className="h-2.5 w-2.5" /> Recorrente
            </span>
          )}
        </div>
      </div>

      {/* Duração */}
      {item.duracao != null && item.duracao > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 font-semibold -mt-1">
          <Clock className="h-3 w-3 text-primary/50" />
          {item.duracao} min
        </div>
      )}

      {/* Cliente */}
      {item.clientes?.nome && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3.5 w-3.5 text-primary/60" />
          {item.cliente_id ? (
            <button onClick={() => onClientClick(item.cliente_id!)}
              className="font-semibold hover:text-primary hover:underline transition-colors text-left" title="Abrir ficha do cliente">
              {item.clientes.nome}
            </button>
          ) : (
            <span className="font-semibold">{item.clientes.nome}</span>
          )}
        </div>
      )}

      {/* Observações */}
      {item.observacoes && (
        <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2 border-l-2 border-primary/20 pl-3">
          {item.observacoes}
        </p>
      )}

      {/* Resultado / desfecho */}
      {item.resultado && (
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/80 mb-0.5">Resultado</p>
          <p className="text-xs text-muted-foreground/90 leading-relaxed line-clamp-2">{item.resultado}</p>
        </div>
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
          {item.status === "cancelado" && (
            <Button size="icon" variant="ghost"
              className="h-7 w-7 rounded-lg hover:bg-blue-500/10 hover:text-blue-500"
              onClick={() => onRemarcar(item)} title="Remarcar">
              <RotateCcw className="h-3.5 w-3.5" />
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
  <div className="glass-card rounded-2xl border border-black/5 dark:border-border bg-card/40 shadow-premium p-3.5 sm:p-5 flex items-center gap-3 sm:gap-4">
    <div className={cn("h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0", color)}>
      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 truncate">{label}</p>
      <p className="text-lg sm:text-2xl font-black tracking-tight">{value}</p>
    </div>
  </div>
);

// ─── Week View (agenda semanal) ───────────────────────────────────────────────

const WeekView: React.FC<{
  items: Atendimento[];
  refDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onHoje: () => void;
  onSelect: (item: Atendimento) => void;
  onNovo: (date: Date) => void;
}> = ({ items, refDate, onPrev, onNext, onHoje, onSelect, onNovo }) => {
  const inicio = startOfWeek(refDate, { weekStartsOn: 0 });
  const dias = Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
  const fim = dias[6];
  const hoje = new Date();
  const porDia = (d: Date) =>
    items
      .filter((it) => isSameDay(parseISO(it.data_atendimento), d))
      .sort((a, b) => parseISO(a.data_atendimento).getTime() - parseISO(b.data_atendimento).getTime());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={onPrev} title="Semana anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={onNext} title="Próxima semana"><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" className="h-9 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest" onClick={onHoje}>Hoje</Button>
        </div>
        <p className="text-sm font-black tracking-tight capitalize">
          {format(inicio, "dd MMM", { locale: ptBR })} – {format(fim, "dd MMM yyyy", { locale: ptBR })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {dias.map((d) => {
          const list = porDia(d);
          const isHoje = isSameDay(d, hoje);
          return (
            <div key={d.toISOString()}
              className={cn("rounded-2xl border p-2 min-h-[150px] flex flex-col gap-1.5 transition-colors",
                isHoje ? "border-primary/40 bg-primary/5" : "border-black/5 dark:border-border bg-card/40")}>
              <div className="flex items-center justify-between px-1">
                <div>
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", isHoje ? "text-primary" : "text-muted-foreground/60")}>
                    {format(d, "EEE", { locale: ptBR })}
                  </p>
                  <p className={cn("text-lg font-black leading-none", isHoje && "text-primary")}>{format(d, "dd")}</p>
                </div>
                <button onClick={() => onNovo(d)}
                  className="h-6 w-6 rounded-lg hover:bg-primary/10 text-muted-foreground/40 hover:text-primary flex items-center justify-center transition-colors"
                  title="Novo atendimento neste dia">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-1 overflow-y-auto">
                {list.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/30 px-1 py-3 text-center">—</p>
                ) : list.map((it) => {
                  const c = STATUS_CONFIG[normalizeAtendimentoStatus(it.status)];
                  return (
                    <button key={it.id} onClick={() => onSelect(it)}
                      className={cn("text-left rounded-lg border px-2 py-1 transition-all hover:shadow-sm", c.className)}>
                      <p className="text-[10px] font-black leading-tight">{fmtSafe(it.data_atendimento, "HH:mm")}</p>
                      <p className="text-[10px] font-semibold truncate leading-tight">
                        {it.clientes?.nome || tipoInfo(it.tipo_atendimento).label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────

const Atendimentos = () => {
  const { user, office } = useAuth();
  const navigate = useNavigate();
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
  const dBusca = useDeferredValue(busca);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroResp, setFiltroResp] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");
  const [view, setView] = useState<"lista" | "semana">("lista");
  const [semanaRef, setSemanaRef] = useState(new Date());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [tiposDialogOpen, setTiposDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Atendimento | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new")) {
      setDialogOpen(true);
      window.history.replaceState({}, "", "/atendimentos");
    }
  }, []);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [followUpItem, setFollowUpItem] = useState<Atendimento | null>(null);
  const [prefill, setPrefill] = useState<Partial<FormState> | null>(null);

  // Stats
  const stats = useMemo(() => ({
    total: items.length,
    agendados: items.filter((i) => i.status === "agendado").length,
    realizados: items.filter((i) => i.status === "realizado").length,
    cancelados: items.filter((i) => i.status === "cancelado").length,
  }), [items]);

  // Atendimentos passados ainda agendados/pendentes → precisam de baixa
  const pendentesBaixa = useMemo(() => {
    const agora = Date.now();
    return items
      .filter((i) => (i.status === "agendado" || i.status === "pendente") && parseISO(i.data_atendimento).getTime() < agora)
      .sort((a, b) => parseISO(a.data_atendimento).getTime() - parseISO(b.data_atendimento).getTime());
  }, [items]);

  // Filtros base (busca, status, tipo, responsável) — usados na lista E na semana
  const baseFiltered = useMemo(() => items.filter((i) => {
    const q = dBusca.toLowerCase();
    const matchBusca = !dBusca
      || i.tipo_atendimento.toLowerCase().includes(q)
      || (i.clientes?.nome?.toLowerCase().includes(q) ?? false)
      || (i.observacoes?.toLowerCase().includes(q) ?? false);
    const matchStatus = filtroStatus === "todos" || i.status === filtroStatus;
    const matchTipo = filtroTipo === "todos" || i.tipo_atendimento === filtroTipo;
    const matchResp = filtroResp === "todos" || (i.responsavel_id ?? "") === filtroResp;
    return matchBusca && matchStatus && matchTipo && matchResp;
  }), [items, dBusca, filtroStatus, filtroTipo, filtroResp]);

  // Período só se aplica à lista (a visão semanal navega pelas datas)
  const filtered = useMemo(() => baseFiltered.filter((i) => {
    if (filtroPeriodo === "todos") return true;
    const d = diasAteData(parseISO(i.data_atendimento));
    if (filtroPeriodo === "hoje") return d === 0;
    if (filtroPeriodo === "7dias") return d >= 0 && d <= 7;
    if (filtroPeriodo === "futuros") return d > 0;
    if (filtroPeriodo === "passados") return d < 0;
    if (filtroPeriodo === "mes") {
      const dt = parseISO(i.data_atendimento); const n = new Date();
      return dt.getMonth() === n.getMonth() && dt.getFullYear() === n.getFullYear();
    }
    return true;
  }), [baseFiltered, filtroPeriodo]);

  // Agrupa os cards por janela temporal (Hoje · Esta semana · Próximos · Passados)
  const grupos = useMemo(() => {
    const map: Record<GrupoKey, Atendimento[]> = { hoje: [], semana: [], futuros: [], passados: [] };
    filtered.forEach((it) => map[grupoDe(it)].push(it));
    const ts = (i: Atendimento) => parseISO(i.data_atendimento).getTime();
    map.hoje.sort((a, b) => ts(a) - ts(b));
    map.semana.sort((a, b) => ts(a) - ts(b));
    map.futuros.sort((a, b) => ts(a) - ts(b));
    map.passados.sort((a, b) => ts(b) - ts(a));
    return ORDEM_GRUPOS.map((k) => ({ key: k, label: LABEL_GRUPOS[k], items: map[k] })).filter((g) => g.items.length);
  }, [filtered]);

  const openNew = () => { setPrefill(null); setEditItem(null); setDialogOpen(true); };
  const openEdit = (item: Atendimento) => { setPrefill(null); setEditItem(item); setDialogOpen(true); };

  // Remarcar: reabre o atendimento em edição já com status "agendado"
  const openRemarcar = (item: Atendimento) => {
    setPrefill(null);
    setEditItem({ ...item, status: "agendado" });
    setDialogOpen(true);
  };

  // Agendar próximo (vindo do follow-up): novo atendimento pré-preenchido
  const agendarProximo = (item: Atendimento) => {
    setFollowUpItem(null);
    setEditItem(null);
    setPrefill({
      tipo_atendimento: item.tipo_atendimento || NONE,
      cliente_id: item.cliente_id ?? NONE,
      processo_id: item.processo_id ?? NONE,
      responsavel_id: (item as any).responsavel_id ?? user?.id ?? "",
      data_atendimento: format(addDays(new Date(), 7), "yyyy-MM-dd"),
      status: "agendado",
    });
    setDialogOpen(true);
  };

  // Abre o atendimento específico vindo de ?openId= (ex.: painel da equipe)
  useOpenItemFromSearch("/atendimentos", !query.isLoading && items.length > 0, (openId) => {
    const it = items.find(x => String(x.id) === openId);
    if (it) { openEdit(it); return true; }
    return false;
  });

  const handleSave = (data: any) => {
    create.mutate(data, { onSuccess: () => setDialogOpen(false) });
  };

  const handleUpdate = (data: any) => {
    update.mutate(data, { onSuccess: () => setDialogOpen(false) });
  };

  const handleDelete = (id: string) => setDeleteId(id);

  const handleMarkRealizado = (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    setLoadingId(id);
    markRealizado.mutate(it, {
      onSuccess: () => setFollowUpItem(it),
      onSettled: () => setLoadingId(null),
    });
  };

  const handleClientClick = (clienteId: string) => navigate(`/clientes?openId=${clienteId}`);

  // Novo atendimento já com a data do dia clicado (visão semanal)
  const novoNoDia = (date: Date) => {
    setEditItem(null);
    setPrefill({ data_atendimento: format(date, "yyyy-MM-dd") });
    setDialogOpen(true);
  };

  const handleMarkCancelado = (id: string) => {
    setLoadingId(id);
    update.mutate({ id, status: "cancelado" }, { onSettled: () => setLoadingId(null) });
  };

  const formInitial: FormState = editItem
    ? {
        tipo_atendimento: editItem.tipo_atendimento || NONE,
        data_atendimento: fmtSafe(editItem.data_atendimento, "yyyy-MM-dd"),
        hora_atendimento: fmtSafe(editItem.data_atendimento, "HH:mm"),
        observacoes: editItem.observacoes ?? "",
        status: editItem.status,
        cliente_id: editItem.cliente_id ?? NONE,
        processo_id: editItem.processo_id ?? NONE,
        responsavel_id: editItem.responsavel_id ?? user?.id ?? "",
        duracao: editItem.duracao != null ? String(editItem.duracao) : "",
        avisos_dias: editItem.avisos_dias ?? null,
        resultado: editItem.resultado ?? "",
        recorrencia: "nenhuma",
        ocorrencias: "4",
      }
    : { ...defaultForm(user?.id ?? ""), ...(prefill ?? {}) };

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 md:space-y-8 overflow-x-hidden entry-animate">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Atendimentos</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Registre e acompanhe todos os atendimentos do escritório.
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {/* Alternar visão */}
          <div className="flex items-center rounded-xl border border-black/8 dark:border-border bg-card/60 p-0.5 shrink-0">
            <Button size="icon" variant={view === "lista" ? "secondary" : "ghost"}
              onClick={() => setView("lista")} className="h-10 w-10 rounded-lg" title="Visão em lista">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button size="icon" variant={view === "semana" ? "secondary" : "ghost"}
              onClick={() => setView("semana")} className="h-10 w-10 rounded-lg" title="Visão semanal">
              <CalendarDays className="h-4 w-4" />
            </Button>
          </div>
          <Button size="icon" variant="outline" onClick={() => setTiposDialogOpen(true)}
            className="h-11 w-11 rounded-xl shrink-0" title="Gerenciar tipos de atendimento">
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button size="lg" onClick={openNew}
            className="flex-1 sm:flex-none rounded-xl h-11 px-3 sm:px-6 font-black uppercase text-xs tracking-widest shadow-premium">
            <Plus className="mr-1.5 sm:mr-2 h-4 w-4" /><span className="sm:hidden">Novo</span><span className="hidden sm:inline">Novo Atendimento</span>
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

      {/* Pendentes de baixa */}
      {pendentesBaixa.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm font-black text-amber-700 dark:text-amber-500">
              {pendentesBaixa.length} atendimento{pendentesBaixa.length !== 1 ? "s" : ""} aguardando baixa
            </p>
          </div>
          <p className="text-xs text-muted-foreground/70 -mt-1">
            Atendimentos com data passada ainda marcados como agendados ou pendentes. Confirme o que ocorreu.
          </p>
          <div className="space-y-2">
            {pendentesBaixa.slice(0, 5).map((item) => {
              const { label: tLabel, Icon: TIcon } = tipoInfo(item.tipo_atendimento, extras);
              return (
                <div key={item.id} className="flex items-center gap-2 rounded-xl bg-card/60 border border-black/5 dark:border-border px-3 py-2">
                  <TIcon className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">
                      {tLabel}{item.clientes?.nome ? ` · ${item.clientes.nome}` : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wide">
                      {fmtSafe(item.data_atendimento, "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" disabled={loadingId === item.id}
                    onClick={() => handleMarkRealizado(item.id)}
                    className="h-7 rounded-lg px-2 text-[10px] font-black uppercase tracking-wide text-emerald-600 hover:bg-emerald-500/10">
                    {loadingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3 mr-1" />Realizado</>}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={loadingId === item.id}
                    onClick={() => handleMarkCancelado(item.id)}
                    className="h-7 rounded-lg px-2 text-[10px] font-black uppercase tracking-wide text-red-500 hover:bg-red-500/10">
                    <XCircle className="h-3 w-3 mr-1" />Cancelar
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => openRemarcar(item)}
                    className="h-7 rounded-lg px-2 text-[10px] font-black uppercase tracking-wide text-blue-500 hover:bg-blue-500/10">
                    <RotateCcw className="h-3 w-3 mr-1" />Remarcar
                  </Button>
                </div>
              );
            })}
            {pendentesBaixa.length > 5 && (
              <p className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-widest pt-1">
                + {pendentesBaixa.length - 5} mais
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, tipo ou observação..."
            className="pl-10 rounded-xl h-11 bg-card/60 border-black/8 dark:border-border" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="rounded-xl h-11 bg-card/60 border-black/8 dark:border-border text-sm">
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
            <SelectTrigger className="rounded-xl h-11 bg-card/60 border-black/8 dark:border-border text-sm">
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
          {membros.length > 0 && (
            <Select value={filtroResp} onValueChange={setFiltroResp}>
              <SelectTrigger className="rounded-xl h-11 bg-card/60 border-black/8 dark:border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos responsáveis</SelectItem>
                {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {view === "lista" && (
            <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
              <SelectTrigger className="rounded-xl h-11 bg-card/60 border-black/8 dark:border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Qualquer período</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="7dias">Próximos 7 dias</SelectItem>
                <SelectItem value="mes">Este mês</SelectItem>
                <SelectItem value="futuros">Futuros</SelectItem>
                <SelectItem value="passados">Passados</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Contagem */}
      {!query.isLoading && view === "lista" && (
        <p className="text-xs text-muted-foreground/60 font-bold uppercase tracking-widest -mt-4">
          {filtered.length} atendimento{filtered.length !== 1 ? "s" : ""}
          {(filtroStatus !== "todos" || filtroTipo !== "todos" || filtroResp !== "todos" || filtroPeriodo !== "todos" || busca) ? " encontrado" + (filtered.length !== 1 ? "s" : "") : ""}
        </p>
      )}

      {/* Conteúdo */}
      {query.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
        </div>
      ) : view === "semana" ? (
        <WeekView
          items={baseFiltered}
          refDate={semanaRef}
          onPrev={() => setSemanaRef((d) => addDays(d, -7))}
          onNext={() => setSemanaRef((d) => addDays(d, 7))}
          onHoje={() => setSemanaRef(new Date())}
          onSelect={openEdit}
          onNovo={novoNoDia}
        />
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
        <div className="space-y-8">
          {grupos.map((g) => (
            <div key={g.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground/70">{g.label}</h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground/60">{g.items.length}</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {g.items.map((item) => (
                  <AtendimentoCard key={item.id} item={item}
                    onEdit={openEdit} onDelete={handleDelete}
                    onMarkRealizado={handleMarkRealizado} onRemarcar={openRemarcar}
                    onClientClick={handleClientClick}
                    loadingId={loadingId} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog form */}
      {dialogOpen && (
        <FormDialog
          key={editItem?.id ?? (prefill ? "prefill" : "new")}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          initial={formInitial}
          editId={editItem?.id}
          officeId={officeId}
          userId={user?.id ?? ""}
          extras={extras}
          membros={membros}
          existing={items}
          onSave={handleSave}
          onUpdate={handleUpdate}
          loading={create.isPending || update.isPending}
        />
      )}

      {/* Follow-up após concluir */}
      <FollowUpDialog
        item={followUpItem}
        onClose={() => setFollowUpItem(null)}
        onAgendarProximo={agendarProximo}
      />

      {/* Dialog gerenciar tipos */}
      <GerenciarTiposDialog
        open={tiposDialogOpen}
        onClose={() => setTiposDialogOpen(false)}
        extras={extras}
        onSave={saveExtras}
      />

      {/* Confirmar exclusão */}
      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) remove.mutate(deleteId); setDeleteId(null); }}
        isLoading={remove.isPending}
        title="Excluir atendimento"
        description="Esta ação não pode ser desfeita. O atendimento será removido permanentemente."
      />
    </div>
  );
};

export default Atendimentos;
