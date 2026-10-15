import { useState, useMemo, useEffect, useDeferredValue, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtSafe } from "@/lib/dates";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useOpenItemFromSearch } from "@/hooks/useOpenItemFromSearch";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { usePermissions } from "@/hooks/usePermissions";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Clock, CheckCircle2, XCircle } from "lucide-react";
import { format, addDays } from "date-fns";

// Módulos extraídos deste arquivo (Fase 3 da consolidação) — comportamento idêntico
import { NONE, defaultForm, type Atendimento, type FormState } from "@/components/Atendimentos/shared";
import { useAtendimentos, useAtendimentoTipos, normalizarStatusAtendimento } from "@/hooks/useAtendimentos";
import { CarregarMaisHistorico } from "@/components/shared/CarregarMaisHistorico";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/rows";
import { AtendimentoFormDialog as FormDialog } from "@/components/Atendimentos/AtendimentoFormDialog";
import { GerenciarTiposDialog } from "@/components/Atendimentos/GerenciarTiposDialog";
import { FollowUpDialog } from "@/components/Atendimentos/FollowUpDialog";
import { AtendimentoCard, StatCard, WeekView } from "@/components/Atendimentos/AtendimentoCard";
import { AtendimentosHeader } from "@/components/Atendimentos/AtendimentosHeader";
import { PendentesBaixa } from "@/components/Atendimentos/PendentesBaixa";
import { AtendimentosFilters } from "@/components/Atendimentos/AtendimentosFilters";
import { AtendimentosErro, AtendimentosVazio } from "@/components/Atendimentos/AtendimentosEstados";
import { calcularStats, pendentesDeBaixa, matchPeriodo, agruparPorJanela } from "@/components/Atendimentos/listagem";
// ─── Page ────────────────────────────────────────────────────────────────────

const Atendimentos = () => {
  const { user, office } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const officeId = office?.id ?? user?.office_id ?? "";

  const { query, create, update, remove, markRealizado } = useAtendimentos(officeId);
  const { canCreateAtendimentos, canEditAtendimentos, canManageOfficeSettings } = usePermissions();
  const { extras, error: extrasError, save: saveExtras } = useAtendimentoTipos(officeId);
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

  // Stats e demais derivações: ver components/Atendimentos/listagem.ts.
  const stats = useMemo(() => calcularStats(items, query.contagens), [items, query.contagens]);

  const pendentesBaixa = useMemo(() => pendentesDeBaixa(items), [items]);

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

  const filtered = useMemo(() => baseFiltered.filter((i) => matchPeriodo(i, filtroPeriodo)), [baseFiltered, filtroPeriodo]);

  const grupos = useMemo(() => agruparPorJanela(filtered), [filtered]);

  // Histórico (realizados/cancelados) vem paginado — rodapé com o que falta carregar.
  const carregarMais = (
    <CarregarMaisHistorico
      restantes={query.historicoRestantes}
      carregando={query.carregandoMaisHistorico}
      onClick={query.carregarMaisHistorico}
      rotulo="atendimentos"
    />
  );

  const openNew = () => { if (!canCreateAtendimentos) return; setPrefill(null); setEditItem(null); setDialogOpen(true); };
  const openEdit = (item: Atendimento) => { if (!canEditAtendimentos) return; setPrefill(null); setEditItem(item); setDialogOpen(true); };

  // Remarcar: reabre o atendimento em edição já com status "agendado"
  const openRemarcar = (item: Atendimento) => {
    if (!canEditAtendimentos) return;
    setPrefill(null);
    setEditItem({ ...item, status: "agendado" });
    setDialogOpen(true);
  };

  // Agendar próximo (vindo do follow-up): novo atendimento pré-preenchido
  const agendarProximo = (item: Atendimento) => {
    if (!canCreateAtendimentos) return;
    setFollowUpItem(null);
    setEditItem(null);
    setPrefill({
      tipo_atendimento: item.tipo_atendimento || NONE,
      cliente_id: item.cliente_id ?? NONE,
      processo_id: item.processo_id ?? NONE,
      responsavel_id: item.responsavel_id ?? user?.id ?? "",
      data_atendimento: format(addDays(new Date(), 7), "yyyy-MM-dd"),
      status: "agendado",
    });
    setDialogOpen(true);
  };

  // Abre o atendimento específico vindo de ?openId= (ex.: painel da equipe)
  // Se o item não estiver nas listas carregadas (histórico além do cap, lista vazia),
  // busca direto pelo id — antes o link simplesmente não abria nada.
  const openIdBuscado = useRef<string | null>(null);
  useOpenItemFromSearch("/atendimentos", !query.isLoading, (openId) => {
    const it = items.find(x => String(x.id) === openId);
    if (it) { openEdit(it); return true; }
    if (openIdBuscado.current === openId || !officeId) return false;
    openIdBuscado.current = openId;
    supabase.from("atendimentos").select("*, clientes(nome)").eq("id", openId).eq("office_id", officeId).maybeSingle()
      .then(({ data, error }) => {
        if (error || !data || data.deletado) {
          toast({ title: "Atendimento não encontrado", description: error ? getErrorMessage(error) : "Ele pode ter sido excluído.", variant: "destructive" });
          return;
        }
        openEdit({ ...data, status: normalizarStatusAtendimento(data.status) } as unknown as Atendimento);
      });
    return true;
  });

  const handleSave = (data: TablesInsert<"atendimentos">) => {
    if (!canCreateAtendimentos) return;
    create.mutate(data, { onSuccess: () => setDialogOpen(false) });
  };

  const handleUpdate = (data: TablesUpdate<"atendimentos"> & { id: string }) => {
    if (!canEditAtendimentos) return;
    update.mutate(data, { onSuccess: () => setDialogOpen(false) });
  };

  const handleDelete = (id: string) => setDeleteId(id);

  const handleMarkRealizado = (id: string) => {
    if (!canEditAtendimentos) return;
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
    if (!canCreateAtendimentos) return;
    setEditItem(null);
    setPrefill({ data_atendimento: format(date, "yyyy-MM-dd") });
    setDialogOpen(true);
  };

  const handleMarkCancelado = (id: string) => {
    if (!canEditAtendimentos) return;
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
      <AtendimentosHeader view={view} onView={setView} canManageOfficeSettings={canManageOfficeSettings}
        onGerenciarTipos={() => setTiposDialogOpen(true)} onNovo={openNew} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} Icon={MessageSquare} color="bg-primary/10 text-primary" />
        <StatCard label="Agendados" value={stats.agendados} Icon={Clock} color="bg-blue-500/10 text-blue-500" />
        <StatCard label="Realizados" value={stats.realizados} Icon={CheckCircle2} color="bg-emerald-500/10 text-emerald-500" />
        <StatCard label="Cancelados" value={stats.cancelados} Icon={XCircle} color="bg-red-500/10 text-red-500" />
      </div>

      {/* Pendentes de baixa */}
      <PendentesBaixa pendentes={pendentesBaixa} extras={extras} loadingId={loadingId}
        onRealizado={handleMarkRealizado} onCancelado={handleMarkCancelado} onRemarcar={openRemarcar} />

      {/* Filtros */}
      <AtendimentosFilters busca={busca} onBusca={setBusca} filtroStatus={filtroStatus} onFiltroStatus={setFiltroStatus}
        filtroTipo={filtroTipo} onFiltroTipo={setFiltroTipo} filtroResp={filtroResp} onFiltroResp={setFiltroResp}
        filtroPeriodo={filtroPeriodo} onFiltroPeriodo={setFiltroPeriodo}
        extras={extras} membros={membros} mostrarPeriodo={view === "lista"} />

      {/* Contagem */}
      {!query.isLoading && !query.isError && view === "lista" && (
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
      ) : query.isError ? (
        <AtendimentosErro error={query.error} onRetry={() => query.refetch()} />
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
        <AtendimentosVazio filtrando={!!busca || filtroStatus !== "todos" || filtroTipo !== "todos"}
          semHistorico={query.historicoRestantes === 0} onNovo={openNew}>
          {carregarMais}
        </AtendimentosVazio>
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
          {carregarMais}
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
        error={extrasError}
        onSave={saveExtras}
      />

      {/* Confirmar exclusão */}
      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) remove.mutate(deleteId); setDeleteId(null); }}
        isLoading={remove.isPending}
        title="Excluir atendimento"
        description="O atendimento será movido para a Lixeira, de onde pode ser restaurado."
      />
    </div>
  );
};

export default Atendimentos;
