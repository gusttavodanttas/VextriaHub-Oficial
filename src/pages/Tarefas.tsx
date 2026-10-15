import { useMemo, useState, useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckSquare, Plus, Trash2, ListChecks, AlertTriangle, CheckCircle2, Flame, List, Columns3 } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { NovaTarefaDialog } from "@/components/Tarefas/NovaTarefaDialog";
import { StatCard } from "@/components/Tarefas/StatCard";
import { TarefaCard } from "@/components/Tarefas/TarefaCard";
import { TarefaKanbanCard } from "@/components/Tarefas/TarefaKanbanCard";
import { GamificacaoCard } from "@/components/Tarefas/GamificacaoCard";
import { SerieAcabandoAviso } from "@/components/Tarefas/SerieAcabandoAviso";
import { TarefasFilters } from "@/components/Tarefas/TarefasFilters";
import { SelecaoToolbar } from "@/components/Tarefas/SelecaoToolbar";
import { calcularGame } from "@/lib/tarefasGame";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useTarefas, type Tarefa, type TarefaInput } from "@/hooks/useTarefas";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useClientes } from "@/hooks/useClientes";
import { useProcessosV2 } from "@/hooks/useProcessosV2";
import { useOpenItemFromSearch } from "@/hooks/useOpenItemFromSearch";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/errors";
import { continueOccurrences, type RecRule } from "@/lib/recorrencia";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO } from "date-fns";

const Tarefas = () => {
  const navigate = useNavigate();
  const { tarefas, isLoading, isError, error, refetch, create, createMany, update, adiar, toggle, remove, bulkPatch } = useTarefas();
  const { canManageTarefas } = usePermissions();
  const { data: clientesData } = useClientes();
  const { data: processosData } = useProcessosV2();
  const { users: officeUsers } = useOfficeUsers();
  const { user } = useAuth();

  const { data: atendimentosData } = useQuery({
    queryKey: ["atendimentos-opts", user?.office_id],
    queryFn: async () => {
      if (!user?.office_id) return [];
      const { data } = await supabase.from("atendimentos")
        .select("id, tipo_atendimento, data_atendimento")
        .eq("office_id", user.office_id).eq("deletado", false)
        .order("data_atendimento", { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!user?.office_id,
  });

  // Contagem de comentários por tarefa (1 query; resiliente se a tabela não existir)
  const { data: commentCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["tarefa-coment-counts", user?.office_id],
    enabled: !!user?.office_id,
    queryFn: async () => {
      if (!user?.office_id) return {};
      const { data, error } = await supabase.from("tarefa_comentarios")
        .select("tarefa_id").eq("office_id", user.office_id).eq("deletado", false);
      if (error) return {};
      const m: Record<string, number> = {};
      (data || []).forEach((r: any) => { m[r.tarefa_id] = (m[r.tarefa_id] || 0) + 1; });
      return m;
    },
  });

  // Progresso de subtarefas por tarefa (1 query; resiliente se a tabela não existir)
  const { data: subtaskCounts = {} } = useQuery<Record<string, { total: number; done: number }>>({
    queryKey: ["subtarefa-counts", user?.office_id],
    enabled: !!user?.office_id,
    queryFn: async () => {
      if (!user?.office_id) return {};
      const { data, error } = await supabase.from("tarefa_subtarefas")
        .select("tarefa_id, concluida").eq("office_id", user.office_id).eq("deletado", false);
      if (error) return {};
      const m: Record<string, { total: number; done: number }> = {};
      (data || []).forEach((r: any) => { const e = (m[r.tarefa_id] ||= { total: 0, done: 0 }); e.total++; if (r.concluida) e.done++; });
      return m;
    },
  });

  const clientes = useMemo(
    () => (clientesData || [])
      .map((c: any) => ({ id: c.id, label: c.nome }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    [clientesData]
  );
  const membros = useMemo(() => officeUsers.map(u => ({ id: u.user_id, label: u.profile?.full_name || u.profile?.email || "Membro" })), [officeUsers]);
  const processos = useMemo(
    () => (processosData || [])
      .map((p: any) => ({ id: p.id, label: p.numeroProcesso ? `${p.titulo} · ${p.numeroProcesso}` : p.titulo, cliente_id: p.clienteId || p.cliente_id || null }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    [processosData]
  );
  const atendimentos = useMemo(() => (atendimentosData || []).map((a: any) => ({ id: a.id, label: `${a.tipo_atendimento}${a.data_atendimento ? " · " + format(parseISO(a.data_atendimento), "dd/MM/yy") : ""}` })), [atendimentosData]);
  const processoMap = useMemo(() => Object.fromEntries(processos.map(p => [p.id, p.label])), [processos]);
  const atendimentoMap = useMemo(() => Object.fromEntries(atendimentos.map(a => [a.id, a.label])), [atendimentos]);
  const membroMap = useMemo(() => Object.fromEntries(membros.map(m => [m.id, m.label])), [membros]);

  const [search, setSearch] = useState("");
  const dSearch = useDeferredValue(search);
  const [prioridadeFilter, setPrioridadeFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("pendentes");
  const [respFilter, setRespFilter] = useState("todos");
  const [clienteFilter, setClienteFilter] = useState("todos");
  const [vencimentoFilter, setVencimentoFilter] = useState<"todos" | "atrasadas" | "hoje">("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tarefa | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  // Filtros base (busca, prioridade, responsável, cliente) — usados na lista E no kanban
  const baseFiltered = useMemo(() => tarefas.filter(t => {
    const q = dSearch.toLowerCase();
    const matchesSearch = !q || t.titulo?.toLowerCase().includes(q) || (t.cliente_nome || "").toLowerCase().includes(q) || (t.descricao || "").toLowerCase().includes(q);
    const matchesPrio = prioridadeFilter === "todas" || t.prioridade === prioridadeFilter;
    const matchesResp = respFilter === "todos" || (t.responsavel_id ?? "") === respFilter;
    const matchesCliente = clienteFilter === "todos" || t.cliente_id === clienteFilter;
    return matchesSearch && matchesPrio && matchesResp && matchesCliente;
  }), [tarefas, dSearch, prioridadeFilter, respFilter, clienteFilter]);

  // Lista aplica também status (pendentes/concluídas) e vencimento (dos stat cards)
  const filtered = useMemo(() => baseFiltered.filter(t => {
    const matchesStatus = statusFilter === "todas" || (statusFilter === "pendentes" ? !t.concluida : t.concluida);
    let matchesVenc = true;
    if (vencimentoFilter === "atrasadas") matchesVenc = !!t.data_vencimento && !t.concluida && isPast(parseISO(t.data_vencimento)) && !isToday(parseISO(t.data_vencimento));
    else if (vencimentoFilter === "hoje") matchesVenc = !!t.data_vencimento && isToday(parseISO(t.data_vencimento));
    return matchesStatus && matchesVenc;
  }), [baseFiltered, statusFilter, vencimentoFilter]);

  // Kanban por status de fluxo (A Fazer / Em Andamento / Concluída)
  const kanbanCols = useMemo(() => {
    const c: Record<string, Tarefa[]> = { a_fazer: [], fazendo: [], concluida: [] };
    for (const t of baseFiltered) {
      if (t.concluida) c.concluida.push(t);
      else if (t.status === "fazendo") c.fazendo.push(t);
      else c.a_fazer.push(t);
    }
    return c;
  }, [baseFiltered]);

  // Qual stat card está "ativo" conforme os filtros atuais
  const activeStat = useMemo(() => {
    if (statusFilter === "concluidas" && vencimentoFilter === "todos") return "concluidas";
    if (statusFilter === "pendentes" && vencimentoFilter === "atrasadas") return "atrasadas";
    if (statusFilter === "pendentes" && vencimentoFilter === "hoje") return "hoje";
    if (statusFilter === "pendentes" && vencimentoFilter === "todos") return "pendentes";
    return "";
  }, [statusFilter, vencimentoFilter]);

  const aplicarStat = (stat: "pendentes" | "atrasadas" | "hoje" | "concluidas") => {
    if (activeStat === stat) { setStatusFilter("pendentes"); setVencimentoFilter("todos"); return; }
    if (stat === "concluidas") { setStatusFilter("concluidas"); setVencimentoFilter("todos"); }
    else if (stat === "atrasadas") { setStatusFilter("pendentes"); setVencimentoFilter("atrasadas"); }
    else if (stat === "hoje") { setStatusFilter("pendentes"); setVencimentoFilter("hoje"); }
    else { setStatusFilter("pendentes"); setVencimentoFilter("todos"); }
  };

  const multiSelect = useMultiSelect(filtered);

  const stats = useMemo(() => {
    const pendentes = tarefas.filter(t => !t.concluida);
    const atrasadas = pendentes.filter(t => t.data_vencimento && isPast(parseISO(t.data_vencimento)) && !isToday(parseISO(t.data_vencimento)));
    const concluidas = tarefas.filter(t => t.concluida);
    return {
      pendentes: pendentes.length,
      atrasadas: atrasadas.length,
      hoje: pendentes.filter(t => t.data_vencimento && isToday(parseISO(t.data_vencimento))).length,
      concluidas: concluidas.length,
    };
  }, [tarefas]);

  // Agrupamento por vencimento (somente pendentes; concluídas vão num grupo único)
  const groups = useMemo(() => {
    const g: Record<string, Tarefa[]> = { Atrasadas: [], Hoje: [], Amanhã: [], "Esta semana": [], Futuras: [], "Sem prazo": [], Concluídas: [] };
    for (const t of filtered) {
      if (t.concluida) { g.Concluídas.push(t); continue; }
      if (!t.data_vencimento) { g["Sem prazo"].push(t); continue; }
      const d = parseISO(t.data_vencimento);
      if (isToday(d)) g.Hoje.push(t);
      else if (isPast(d)) g.Atrasadas.push(t);
      else if (isTomorrow(d)) g.Amanhã.push(t);
      else if (isThisWeek(d, { weekStartsOn: 1 })) g["Esta semana"].push(t);
      else g.Futuras.push(t);
    }
    return g;
  }, [filtered]);

  const groupColor: Record<string, string> = {
    Atrasadas: "text-rose-500", Hoje: "text-orange-500", Amanhã: "text-amber-500",
    "Esta semana": "text-blue-500", Futuras: "text-muted-foreground/50", "Sem prazo": "text-muted-foreground/50", Concluídas: "text-emerald-500",
  };

  const KANBAN: { key: string; label: string; color: string; dot: string }[] = [
    { key: "a_fazer",   label: "A Fazer",       color: "text-slate-500",   dot: "bg-slate-400" },
    { key: "fazendo",   label: "Em Andamento",  color: "text-blue-500",    dot: "bg-blue-500" },
    { key: "concluida", label: "Concluída",     color: "text-emerald-500", dot: "bg-emerald-500" },
  ];

  // Gamificação (dados reais) — usa a data de conclusão auditada (concluida_em);
  // cai para updated_at só em tarefas antigas (anteriores à auditoria).
  const game = useMemo(() => calcularGame(tarefas), [tarefas]);

  // Abre a tarefa específica vinda de ?openId= (ex.: card do processo) em modo edição
  useOpenItemFromSearch("/tarefas", !isLoading && tarefas.length > 0, (openId) => {
    const t = tarefas.find(x => String(x.id) === openId);
    if (t) { openEdit(t); return true; }
    // Fallback: tarefa de processo compartilhado de outro escritório não entra na
    // lista (filtrada por office_id do usuário atual) — busca direto por id, mesmo
    // padrão já usado em Audiencias.tsx.
    (async () => {
      const { data } = await supabase.from("tarefas").select("*, clientes!cliente_id(nome)").eq("id", openId).maybeSingle();
      if (data) {
        const d = data as Tarefa & { clientes?: { nome?: string | null } | null };
        openEdit({
          id: d.id, titulo: d.titulo, descricao: d.descricao, data_vencimento: d.data_vencimento,
          prioridade: d.prioridade, concluida: !!d.concluida, status: d.status,
          cliente_id: d.cliente_id, processo_id: d.processo_id, atendimento_id: d.atendimento_id ?? null,
          recorrencia_grupo: d.recorrencia_grupo ?? null, recorrencia_regra: d.recorrencia_regra ?? null,
          recorrencia_restantes: d.recorrencia_restantes ?? null, cliente_nome: d.clientes?.nome || null,
          updated_at: d.updated_at, responsavel_id: d.responsavel_id ?? null,
          concluida_em: d.concluida_em ?? null, concluida_por: d.concluida_por ?? null,
          avisos_dias: d.avisos_dias ?? null,
        } as Tarefa);
      }
    })();
    return true;
  });

  const handleSubmit = async (input: TarefaInput, id?: string) => {
    if (id) await update.mutateAsync({ id, input });
    else await create.mutateAsync(input);
  };
  const handleSubmitMany = async (inputs: TarefaInput[]) => {
    await createMany.mutateAsync(inputs);
  };

  // Séries de recorrência acabando (poucas ocorrências futuras restantes)
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("tarefa_series_dismissed") || "[]")); } catch { return new Set(); }
  });
  const persistDismissed = (s: Set<string>) => {
    setDismissed(new Set(s));
    try { localStorage.setItem("tarefa_series_dismissed", JSON.stringify([...s])); } catch { /* ignore */ }
  };

  const seriesAcabando = useMemo(() => {
    const byGroup: Record<string, Tarefa[]> = {};
    for (const t of tarefas) {
      if (!t.recorrencia_grupo) continue;
      (byGroup[t.recorrencia_grupo] ||= []).push(t);
    }
    const out: { grupo: string; titulo: string; regra: string; restantes: number }[] = [];
    for (const [grupo, items] of Object.entries(byGroup)) {
      const pendentes = items.filter(t => !t.concluida);
      if (pendentes.length === 0) continue;
      // Modelo encadeado: a tarefa pendente carrega quantas AINDA serão geradas.
      const ativa = pendentes.find(t => t.recorrencia_restantes != null);
      if (ativa) {
        const restantes = ativa.recorrencia_restantes ?? 0;
        if (restantes <= 2 && !dismissed.has(grupo)) {
          out.push({ grupo, titulo: ativa.titulo, regra: ativa.recorrencia_regra || "semanal", restantes });
        }
      } else if (items.length >= 3 && pendentes.length <= 2 && !dismissed.has(grupo)) {
        // Série legada em lote (sem contador): conta as pendentes.
        out.push({ grupo, titulo: items[0].titulo, regra: items[0].recorrencia_regra || "semanal", restantes: pendentes.length });
      }
    }
    return out;
  }, [tarefas, dismissed]);

  const handleExtend = async (grupo: string) => {
    const items = tarefas.filter(t => t.recorrencia_grupo === grupo);
    if (!items.length) return;
    const pendentes = items.filter(t => !t.concluida);
    const ativa = pendentes.find(t => t.recorrencia_restantes != null);

    // Modelo encadeado: só aumenta o contador; as próximas nascem ao concluir.
    if (ativa) {
      await update.mutateAsync({ id: ativa.id, input: { recorrencia_restantes: (ativa.recorrencia_restantes ?? 0) + 4 } });
      return;
    }

    // Série legada em lote: cria 4 ocorrências preservando responsável e avisos.
    const template = items[items.length - 1]; // tarefas vêm ordenadas por vencimento asc
    const regra = (template.recorrencia_regra || "semanal") as RecRule;
    const last = template.data_vencimento ? new Date(`${template.data_vencimento}T12:00:00`) : new Date();
    const datas = continueOccurrences(last, regra, 4);
    const inputs: TarefaInput[] = datas.map(d => ({
      titulo: template.titulo,
      descricao: template.descricao,
      data_vencimento: format(d, "yyyy-MM-dd"),
      prioridade: template.prioridade || "media",
      cliente_id: template.cliente_id,
      processo_id: template.processo_id,
      atendimento_id: template.atendimento_id,
      responsavel_id: template.responsavel_id ?? null,
      recorrencia_grupo: grupo,
      recorrencia_regra: regra,
      ...(Array.isArray(template.avisos_dias) ? { avisos_dias: template.avisos_dias } : {}),
    }));
    await createMany.mutateAsync(inputs);
  };
  const openNew = () => { setEditTarget(null); setDialogOpen(true); };
  const openEdit = (t: Tarefa) => { setEditTarget(t); setDialogOpen(true); };
  const handleConfirmDelete = async () => {
    await remove.mutateAsync(multiSelect.getSelectedItems().map(i => i.id));
    multiSelect.clearSelection();
    setDeleteDialogOpen(false);
  };

  // Ações em lote
  const [selectMode, setSelectMode] = useState(false);
  const selectedIds = () => multiSelect.getSelectedItems().map(i => i.id);
  const bulkConcluir = async () => { await bulkPatch.mutateAsync({ ids: selectedIds(), concluir: true }); multiSelect.clearSelection(); };
  const bulkPrioridade = async (prioridade: string) => { await bulkPatch.mutateAsync({ ids: selectedIds(), patch: { prioridade } }); multiSelect.clearSelection(); };
  const bulkResponsavel = async (responsavel_id: string) => { await bulkPatch.mutateAsync({ ids: selectedIds(), patch: { responsavel_id } }); multiSelect.clearSelection(); };
  const bulkPrazo = async (data: string) => { await bulkPatch.mutateAsync({ ids: selectedIds(), patch: { data_vencimento: data || null } }); multiSelect.clearSelection(); };

  // Kanban: mover tarefa entre colunas de fluxo
  const moverTarefa = (id: string, col: string) => {
    const t = tarefas.find(x => x.id === id);
    if (!t || !canManageTarefas) return;
    if (col === "concluida") {
      if (!t.concluida) toggle.mutate({ id: t.id, concluida: true, tarefa: t });
    } else if (t.concluida) {
      bulkPatch.mutate({ ids: [t.id], patch: { status: col }, concluir: false });
    } else if (t.status !== col) {
      bulkPatch.mutate({ ids: [t.id], patch: { status: col } });
    }
  };

  const renderCard = (t: Tarefa) => (
    <TarefaCard key={t.id} t={t} selected={multiSelect.isSelected(t.id)} selectMode={selectMode} canManageTarefas={canManageTarefas}
      processoMap={processoMap} atendimentoMap={atendimentoMap} membroMap={membroMap}
      subtasks={subtaskCounts[t.id]} comments={commentCounts[t.id]} navigate={navigate}
      onToggleSelect={(id) => multiSelect.toggleItem(id)} onEdit={openEdit}
      onToggleConcluida={(x) => toggle.mutate({ id: x.id, concluida: !x.concluida, tarefa: x })} onAdiar={(x) => adiar.mutate(x)}
      onDelete={(x) => { multiSelect.clearSelection(); multiSelect.toggleItem(x.id); setDeleteDialogOpen(true); }} />
  );

  const renderKanbanCard = (t: Tarefa) => (
    <TarefaKanbanCard key={t.id} t={t} canManageTarefas={canManageTarefas} dragging={draggingId === t.id}
      subtasks={subtaskCounts[t.id]} comments={commentCounts[t.id]} onDragStart={setDraggingId}
      onDragEnd={() => { setDraggingId(null); setOverCol(null); }} onOpen={openEdit} onAdiar={(x) => adiar.mutate(x)} />
  );

  return (
    <div className="flex-1 p-4 md:p-6 space-y-5 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20"><CheckSquare className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Tarefas</h1>
            <p className="text-sm text-muted-foreground">Organize e acompanhe seus afazeres.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {canManageTarefas && view === "lista" && !multiSelect.isNoneSelected && (
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="rounded-xl h-10 gap-2 font-bold shrink-0">
              <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Excluir </span>({multiSelect.selectedCount})
            </Button>
          )}
          <div className="flex items-center rounded-xl border border-black/8 dark:border-border bg-card/60 p-0.5 shrink-0">
            <Button size="icon" variant={view === "lista" ? "secondary" : "ghost"}
              onClick={() => setView("lista")} className="h-9 w-9 rounded-lg" title="Lista" aria-label="Lista">
              <List className="h-4 w-4" />
            </Button>
            <Button size="icon" variant={view === "kanban" ? "secondary" : "ghost"}
              onClick={() => setView("kanban")} className="h-9 w-9 rounded-lg" title="Kanban" aria-label="Kanban">
              <Columns3 className="h-4 w-4" />
            </Button>
          </div>
          {canManageTarefas && (
            <Button onClick={openNew} className="flex-1 sm:flex-none rounded-xl h-10 gap-2 font-bold shadow-sm">
              <Plus className="h-4 w-4" /> Nova Tarefa
            </Button>
          )}
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-destructive/20 bg-destructive/5">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-destructive">Não foi possível carregar as tarefas</p>
            <p className="text-xs text-muted-foreground">{getErrorMessage(error)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-xl font-bold shrink-0">Tentar novamente</Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard icon={ListChecks} label="Pendentes" value={stats.pendentes} color="text-purple-500" bg="bg-purple-500/10" active={activeStat === "pendentes"} onClick={() => aplicarStat("pendentes")} />
        <StatCard icon={AlertTriangle} label="Atrasadas" value={stats.atrasadas} color="text-rose-500" bg="bg-rose-500/10" active={activeStat === "atrasadas"} onClick={() => aplicarStat("atrasadas")} />
        <StatCard icon={Flame} label="Vencem hoje" value={stats.hoje} color="text-orange-500" bg="bg-orange-500/10" active={activeStat === "hoje"} onClick={() => aplicarStat("hoje")} />
        <StatCard icon={CheckCircle2} label="Concluídas" value={stats.concluidas} color="text-emerald-500" bg="bg-emerald-500/10" active={activeStat === "concluidas"} onClick={() => aplicarStat("concluidas")} />
      </div>

      {/* Gamificação */}
      <GamificacaoCard game={game} />

      {/* Avisos de série de recorrência acabando */}
      {seriesAcabando.map((s) => (
        <SerieAcabandoAviso key={s.grupo} serie={s} extending={createMany.isPending}
          onExtend={() => handleExtend(s.grupo)} onDismiss={() => persistDismissed(new Set(dismissed).add(s.grupo))} />
      ))}

      {/* Filtros */}
      <TarefasFilters view={view} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        prioridadeFilter={prioridadeFilter} setPrioridadeFilter={setPrioridadeFilter} respFilter={respFilter} setRespFilter={setRespFilter}
        clienteFilter={clienteFilter} setClienteFilter={setClienteFilter} membros={membros} clientes={clientes} />

      {/* Lista */}
      {isError ? null : isLoading ? (
        <div className="space-y-2.5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-black/[0.03] dark:bg-muted/20 animate-pulse" />)}</div>
      ) : view === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {KANBAN.map((col) => {
            const items = kanbanCols[col.key] || [];
            return (
              <div key={col.key}
                onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
                onDragLeave={() => setOverCol((c) => c === col.key ? null : c)}
                onDrop={() => { if (draggingId) moverTarefa(draggingId, col.key); setDraggingId(null); setOverCol(null); }}
                className={cn(
                  "rounded-2xl border p-2.5 space-y-2 min-h-[220px] transition-colors",
                  overCol === col.key ? "border-primary/50 bg-primary/[0.04]" : "border-black/5 dark:border-border bg-card/30"
                )}>
                <div className="flex items-center gap-2 px-1 pt-0.5">
                  <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", col.color)}>{col.label}</span>
                  <span className="text-[10px] font-black text-muted-foreground/40">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0
                    ? <p className="text-[11px] text-muted-foreground/30 text-center py-8">Arraste tarefas para cá</p>
                    : items.map(renderKanbanCard)}
                </div>
              </div>
            );
          })}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
          <div className="p-5 rounded-full bg-purple-500/10 text-purple-500"><CheckSquare className="h-10 w-10 opacity-70" /></div>
          <div>
            <p className="font-black text-lg">Nenhuma tarefa {tarefas.length > 0 ? "encontrada" : "cadastrada"}</p>
            <p className="text-sm text-muted-foreground mt-1">{tarefas.length > 0 ? "Ajuste a busca ou os filtros." : "Comece criando sua primeira tarefa."}</p>
          </div>
          {tarefas.length === 0 && canManageTarefas && <Button onClick={openNew} className="rounded-xl gap-2 font-bold"><Plus className="h-4 w-4" /> Nova Tarefa</Button>}
        </div>
      ) : (
        <div className="space-y-5">
          <SelecaoToolbar selectMode={selectMode} onEnterSelect={() => setSelectMode(true)}
            onExitSelect={() => { multiSelect.clearSelection(); setSelectMode(false); }} multiSelect={multiSelect}
            canManageTarefas={canManageTarefas} membros={membros} bulkConcluir={bulkConcluir} bulkPrioridade={bulkPrioridade}
            bulkResponsavel={bulkResponsavel} bulkPrazo={bulkPrazo} bulkPending={bulkPatch.isPending} removePending={remove.isPending}
            onDelete={() => setDeleteDialogOpen(true)} />
          {Object.entries(groups).map(([label, items]) =>
            items.length === 0 ? null : (
              <div key={label} className="space-y-2">
                <p className={cn("text-[10px] font-black uppercase tracking-widest px-1 flex items-center gap-2", groupColor[label])}>
                  {label} <span className="text-muted-foreground/30">·</span> <span className="opacity-70">{items.length}</span>
                </p>
                <div className="space-y-2">{items.map(renderCard)}</div>
              </div>
            )
          )}
        </div>
      )}

      <NovaTarefaDialog open={dialogOpen} onOpenChange={setDialogOpen}
        clientes={clientes} processos={processos} atendimentos={atendimentos}
        membros={membros}
        tarefa={editTarget} onSubmit={handleSubmit} onSubmitMany={handleSubmitMany} />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Excluir Tarefas"
        description={`Tem certeza que deseja excluir ${multiSelect.selectedCount} tarefa(s)? Esta ação pode ser desfeita na lixeira.`}
        isLoading={remove.isPending}
      />
    </div>
  );
};

export default Tarefas;
