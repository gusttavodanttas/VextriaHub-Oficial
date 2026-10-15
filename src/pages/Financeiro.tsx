import { useState, useMemo, useDeferredValue } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { usePermissions } from "@/hooks/usePermissions";
import { toNull } from "@/components/Financeiro/shared";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/rows";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import { startOfMonth, endOfMonth, parseISO, isAfter, isBefore, isSameMonth, addMonths } from "date-fns";

// Módulos extraídos deste arquivo (desmonte do god-component) — comportamento idêntico
import { NONE, defaultForm, type FinanceiroItem, type FormState, type TipoType, type EscopoType } from "@/components/Financeiro/shared";
import { useFinanceiro, useFinanceiroCategorias, useFinanceiroGruposPrioridade } from "@/hooks/useFinanceiro";
import { GerenciarCategoriasDialog } from "@/components/Financeiro/GerenciarCategoriasDialog";
import { GerenciarPrioridadesDialog } from "@/components/Financeiro/GerenciarPrioridadesDialog";
import { FormDialog } from "@/components/Financeiro/FinanceiroFormDialog";
import { FinanceiroRow, EmptyState, LoadingSkeleton } from "@/components/Financeiro/FinanceiroRow";
import { ImportarPlanilhaDialog } from "@/components/Financeiro/ImportarPlanilhaDialog";
import { DiligenciasFinanceiroPanel } from "@/components/Correspondentes/DiligenciasFinanceiroPanel";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { FinanceiroHeader } from "@/components/Financeiro/FinanceiroHeader";
import { MesNavegacao } from "@/components/Financeiro/MesNavegacao";
import { FinanceiroStats } from "@/components/Financeiro/FinanceiroStats";
import { MixingIndexCard } from "@/components/Financeiro/MixingIndexCard";
import { FinanceiroFilters } from "@/components/Financeiro/FinanceiroFilters";
import { PriorizacaoTab } from "@/components/Financeiro/PriorizacaoTab";
import { calcularStats, calcularMixing, agruparPendentesPorGrupo, baixarCsvFinanceiro } from "@/components/Financeiro/calculos";
// ─── Page ────────────────────────────────────────────────────────────────────

const Financeiro = () => {
  const { user, office } = useAuth();
  const officeId = office?.id ?? user?.office_id ?? "";
  const { canManageFinanceiro } = usePermissions();

  const { query, create, update, remove, registrarPagamento, cancelarGrupo } = useFinanceiro(officeId);
  const items = query.data ?? [];

  const { categoriasReceita, categoriasDespesa, error: categoriasError, save: saveCategorias } = useFinanceiroCategorias(officeId);
  const { gruposPrioridade, error: gruposPrioridadeError, save: saveGruposPrioridadeRaw } = useFinanceiroGruposPrioridade(officeId);
  const saveGruposPrioridade = async (grupos: typeof gruposPrioridade) => {
    if (!canManageFinanceiro) return false;
    return saveGruposPrioridadeRaw(grupos);
  };

  const handleSaveCategorias = async (receita: string[], despesa: string[]) => {
    if (!canManageFinanceiro) return;
    await saveCategorias(receita, despesa);
  };

  const [busca, setBusca] = useState("");
  const dBusca = useDeferredValue(busca);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroEscopo, setFiltroEscopo] = useState<"todos" | EscopoType>("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [prioridadeDialogOpen, setPrioridadeDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  // Antes usava confirm() nativo em vez do DeleteConfirmDialog padrão do app.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmCancelarGrupoId, setConfirmCancelarGrupoId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<FinanceiroItem | null>(null);
  const [defaultTipo, setDefaultTipo] = useState<TipoType>("receita");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Mês em visualização — navegável (não trava no mês corrente), afeta os
  // cards "do Mês" e as listas (Priorização fica de fora, é um work-list vivo).
  const [mesRef, setMesRef] = useState(() => startOfMonth(new Date()));
  const mesStart = startOfMonth(mesRef);
  const mesEnd = endOfMonth(mesRef);
  const isMesAtual = isSameMonth(mesRef, new Date());
  const mesAnterior = () => setMesRef((d) => addMonths(d, -1));
  const proximoMes = () => setMesRef((d) => addMonths(d, 1));
  const irParaHoje = () => setMesRef(startOfMonth(new Date()));

  const stats = useMemo(() => calcularStats(items, mesStart, mesEnd), [items, mesStart, mesEnd]);

  // Índice de mistura patrimonial PJ/PF (ver calcularMixing).
  const mixing = useMemo(() => calcularMixing(items), [items]);

  // Categorias dinâmicas usadas nos registros (para o filtro)
  const todasCategorias = useMemo(() => {
    const cats = new Set(
      items.map((i) => i.categoria).filter((c): c is string => !!c && c.trim() !== "")
    );
    return Array.from(cats);
  }, [items]);

  const filtered = useMemo(() => items.filter((i) => {
    const q = dBusca.toLowerCase();
    const matchBusca = !dBusca || i.descricao.toLowerCase().includes(q) || (i.clientes?.nome?.toLowerCase().includes(q) ?? false);
    const matchStatus = filtroStatus === "todos" || i.status === filtroStatus;
    const matchCat = filtroCategoria === "todas" || i.categoria === filtroCategoria;
    const matchEscopo = filtroEscopo === "todos" || i.escopo === filtroEscopo;
    const matchMes = !isBefore(parseISO(i.data_vencimento), mesStart) && !isAfter(parseISO(i.data_vencimento), mesEnd);
    return matchBusca && matchStatus && matchCat && matchEscopo && matchMes;
  }), [items, dBusca, filtroStatus, filtroCategoria, filtroEscopo, mesStart, mesEnd]);

  const receber = filtered.filter((i) => i.tipo === "receita");
  const pagar = filtered.filter((i) => i.tipo === "despesa");

  // Priorização: despesas ainda em aberto (pendente/vencida/parcial), agrupadas
  // pelos grupos de prioridade configurados pelo escritório — ajuda a decidir o
  // que pagar primeiro quando o caixa aperta.
  const pendentesPagar = useMemo(
    () => items.filter((i) => i.tipo === "despesa" && (i.status === "pendente" || i.status === "vencido" || i.status === "parcial")),
    [items]
  );
  const pendentesPorGrupo = useMemo(() => agruparPendentesPorGrupo(pendentesPagar, gruposPrioridade), [pendentesPagar, gruposPrioridade]);

  // Exporta os lançamentos visíveis (respeita os filtros ativos).
  const exportCSV = () => baixarCsvFinanceiro(filtered, gruposPrioridade);

  const openNew = (tipo: TipoType) => {
    if (!canManageFinanceiro) return;
    setEditItem(null);
    setDefaultTipo(tipo);
    setDialogOpen(true);
  };

  const openEdit = (item: FinanceiroItem) => {
    if (!canManageFinanceiro) return;
    setEditItem(item);
    setDefaultTipo(item.tipo);
    setDialogOpen(true);
  };

  const handleSave = (data: any) => {
    if (!canManageFinanceiro) return;
    create.mutate(data, { onSuccess: () => setDialogOpen(false) });
  };

  const handleUpdate = (data: any) => {
    if (!canManageFinanceiro) return;
    update.mutate(data, { onSuccess: () => setDialogOpen(false) });
  };

  // Converte um lançamento avulso em série: só cria as parcelas/ocorrências
  // futuras depois que a atualização do próprio lançamento (virando a 1ª) confirmar.
  const handleConvertToSerie = (
    updatePayload: TablesUpdate<"financeiro"> & { id: string },
    novasLinhas: TablesInsert<"financeiro">[],
  ) => {
    if (!canManageFinanceiro) return;
    update.mutate(updatePayload, {
      onSuccess: () => create.mutate(novasLinhas, { onSuccess: () => setDialogOpen(false) }),
    });
  };

  const handleRegistrarPagamento = (item: FinanceiroItem, valor: number) => {
    if (!canManageFinanceiro) return;
    setLoadingId(item.id);
    registrarPagamento.mutate({ item, valor }, { onSettled: () => setLoadingId(null) });
  };

  const handlePrioridadeChange = (id: string, prioridade: string | null) => {
    if (!canManageFinanceiro) return;
    update.mutate({ id, prioridade });
  };

  const handleDelete = (id: string) => {
    if (!canManageFinanceiro) return;
    setConfirmDeleteId(id);
  };

  const confirmDeleteItem = () => {
    if (!confirmDeleteId) return;
    remove.mutate(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  const formInitial: FormState = editItem
    ? {
        tipo: editItem.tipo,
        descricao: editItem.descricao,
        valor: String(editItem.valor),
        data_vencimento: editItem.data_vencimento,
        status: editItem.status,
        categoria: toNull(editItem.categoria) ?? NONE,
        cliente_id: toNull(editItem.cliente_id) ?? NONE,
        processo_id: toNull(editItem.processo_id) ?? NONE,
        escopo: editItem.escopo ?? "pj",
        prioridade: editItem.prioridade ?? NONE,
        valor_pago: editItem.valor_pago != null ? String(editItem.valor_pago) : "",
        modo: "unico",
        parcelas: "2",
        recorrencia: "mensal",
        meses_recorrencia: "12",
      }
    : defaultForm(defaultTipo, isMesAtual ? new Date() : mesRef);

  const handleCancelarGrupo = (grupoId: string) => {
    if (!canManageFinanceiro) return;
    setConfirmCancelarGrupoId(grupoId);
  };

  const confirmCancelarGrupoAction = () => {
    if (!confirmCancelarGrupoId) return;
    cancelarGrupo.mutate(confirmCancelarGrupoId);
    setConfirmCancelarGrupoId(null);
  };

  return (
    <PermissionGuard permission="canViewFinanceiro" showDeniedMessage>
      <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-12 overflow-x-hidden entry-animate">

        {/* Header */}
        <FinanceiroHeader onGerenciarCategorias={() => setCatDialogOpen(true)} onGerenciarPrioridades={() => setPrioridadeDialogOpen(true)}
          onImportar={() => setImportDialogOpen(true)} onExportar={exportCSV} exportarDesabilitado={filtered.length === 0} onNovo={openNew} />

        {/* Navegação de mês — afeta os cards "do Mês" e as listas abaixo */}
        <MesNavegacao mesRef={mesRef} isMesAtual={isMesAtual} onAnterior={mesAnterior} onProximo={proximoMes} onHoje={irParaHoje} />

        {/* Erro de busca — antes uma falha de rede/RLS virava estatística zerada sem aviso */}
        {query.isError && (
          <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold">Não foi possível carregar os lançamentos financeiros</p>
              <p className="text-xs opacity-80">{query.error instanceof Error ? query.error.message : "Tente novamente em instantes."}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => query.refetch()} className="rounded-xl font-bold shrink-0">
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Stats */}
        {!query.isError && <FinanceiroStats stats={stats} loading={query.isLoading} />}

        {/* Índice de mistura patrimonial PJ/PF */}
        {!query.isError && !query.isLoading && <MixingIndexCard mixing={mixing} />}

        {/* Resumo de diligências (custo com correspondentes) */}
        <DiligenciasFinanceiroPanel />

        {/* Filtros */}
        <FinanceiroFilters busca={busca} onBusca={setBusca} filtroStatus={filtroStatus} onFiltroStatus={setFiltroStatus}
          filtroCategoria={filtroCategoria} onFiltroCategoria={setFiltroCategoria}
          filtroEscopo={filtroEscopo} onFiltroEscopo={setFiltroEscopo} categorias={todasCategorias} />

        {/* Tabs */}
        <Tabs defaultValue="todos" className="w-full space-y-8">
          <div className="glass-card p-2 rounded-3xl inline-flex h-auto border border-black/5 dark:border-border bg-black/[0.02] dark:bg-muted/30 shadow-inner overflow-x-auto max-w-full">
            <TabsList className="bg-transparent h-auto p-0 gap-1">
              {[
                { value: "receber", label: `A Receber (${receber.length})` },
                { value: "pagar",   label: `A Pagar (${pagar.length})` },
                { value: "priorizacao", label: `Priorização (${pendentesPagar.length})` },
                { value: "todos",   label: `Todos (${filtered.length})` },
              ].map(({ value, label }) => (
                <TabsTrigger key={value} value={value}
                  className="rounded-2xl px-6 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-foreground data-[state=active]:shadow-lg transition-all">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {([
            { value: "receber", data: receber, emptyLabel: "Nenhuma receita encontrada", tipo: "receita" as TipoType },
            { value: "pagar",   data: pagar,   emptyLabel: "Nenhuma despesa encontrada", tipo: "despesa" as TipoType },
            { value: "todos",   data: filtered, emptyLabel: "Nenhum registro encontrado", tipo: "receita" as TipoType },
          ]).map(({ value, data, emptyLabel, tipo }) => (
            <TabsContent key={value} value={value} className="space-y-4 entry-animate">
              {query.isError ? null : query.isLoading ? <LoadingSkeleton /> : data.length === 0
                ? <EmptyState label={emptyLabel} onNew={() => openNew(tipo)} />
                : data.map((item) => (
                    <FinanceiroRow key={item.id} item={item}
                      onRegistrarPagamento={handleRegistrarPagamento} onEdit={openEdit}
                      onDelete={handleDelete} onCancelarGrupo={handleCancelarGrupo}
                      onPrioridadeChange={handlePrioridadeChange} gruposPrioridade={gruposPrioridade}
                      loadingId={loadingId} />
                  ))
              }
            </TabsContent>
          ))}

          {/* Priorização: despesas em aberto agrupadas pelos grupos configurados */}
          <TabsContent value="priorizacao" className="space-y-6 entry-animate">
            {query.isError ? null : (
              <PriorizacaoTab loading={query.isLoading} pendentesPagar={pendentesPagar} pendentesPorGrupo={pendentesPorGrupo}
                gruposPrioridade={gruposPrioridade} loadingId={loadingId} onNovaDespesa={() => openNew("despesa")}
                onPrioridadeChange={handlePrioridadeChange} onRegistrarPagamento={handleRegistrarPagamento} />
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog criar/editar */}
        {dialogOpen && (
          <FormDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            initial={formInitial}
            editId={editItem?.id}
            officeId={officeId}
            userId={user?.id ?? ""}
            categoriasReceita={categoriasReceita}
            categoriasDespesa={categoriasDespesa}
            gruposPrioridade={gruposPrioridade}
            permiteConverterSerie={!!editItem && !editItem.grupo_id}
            onSave={handleSave}
            onUpdate={handleUpdate}
            onConvertToSerie={handleConvertToSerie}
            loading={create.isPending || update.isPending}
          />
        )}

        {/* Dialog categorias */}
        <GerenciarCategoriasDialog
          open={catDialogOpen}
          onClose={() => setCatDialogOpen(false)}
          categoriasReceita={categoriasReceita}
          categoriasDespesa={categoriasDespesa}
          error={categoriasError}
          onSave={handleSaveCategorias}
        />

        {/* Dialog grupos de prioridade */}
        <GerenciarPrioridadesDialog
          open={prioridadeDialogOpen}
          onClose={() => setPrioridadeDialogOpen(false)}
          grupos={gruposPrioridade}
          error={gruposPrioridadeError}
          onSave={saveGruposPrioridade}
        />

        {/* Dialog importar planilha */}
        <ImportarPlanilhaDialog
          open={importDialogOpen}
          onClose={() => setImportDialogOpen(false)}
          officeId={officeId}
          userId={user?.id ?? ""}
          categoriasReceita={categoriasReceita}
          categoriasDespesa={categoriasDespesa}
          importing={create.isPending}
          onImport={(rows) => { if (!canManageFinanceiro) return; create.mutate(rows, { onSuccess: () => setImportDialogOpen(false) }); }}
        />

        <DeleteConfirmDialog
          open={!!confirmDeleteId}
          onOpenChange={(open) => !open && setConfirmDeleteId(null)}
          onConfirm={confirmDeleteItem}
          title="Excluir lançamento?"
          description="Esta ação move o lançamento para a lixeira. Você pode restaurá-lo depois, se precisar."
          isLoading={remove.isPending}
        />

        <DeleteConfirmDialog
          open={!!confirmCancelarGrupoId}
          onOpenChange={(open) => !open && setConfirmCancelarGrupoId(null)}
          onConfirm={confirmCancelarGrupoAction}
          title="Cancelar lançamentos futuros?"
          description="Todos os lançamentos futuros pendentes deste grupo recorrente serão cancelados."
          confirmText="Cancelar lançamentos"
          isLoading={cancelarGrupo.isPending}
        />
      </div>
    </PermissionGuard>
  );
};

export default Financeiro;
