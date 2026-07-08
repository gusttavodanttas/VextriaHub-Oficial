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

// Módulos extraídos deste arquivo (Fase 3 da consolidação) — comportamento idêntico
import {
  NONE, STATUS_CONFIG, ORDEM_GRUPOS, LABEL_GRUPOS, grupoDe, diasAteData,
  defaultForm, tipoInfo, type Atendimento, type FormState, type GrupoKey, type StatusType,
} from "@/components/Atendimentos/shared";
import { useAtendimentos, useAtendimentoTipos } from "@/hooks/useAtendimentos";
import { AtendimentoFormDialog as FormDialog } from "@/components/Atendimentos/AtendimentoFormDialog";
import { GerenciarTiposDialog } from "@/components/Atendimentos/GerenciarTiposDialog";
import { FollowUpDialog } from "@/components/Atendimentos/FollowUpDialog";
import { AtendimentoCard, StatCard, WeekView } from "@/components/Atendimentos/AtendimentoCard";
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
