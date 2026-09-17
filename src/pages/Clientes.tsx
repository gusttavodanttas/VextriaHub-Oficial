import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { Client } from "@/types/client";
import type { ClienteComProcessos } from "@/types/database";
import { useClientes } from "@/hooks/useClientes";
import { useClientesLista, useClientesStats, useClientesAniversariantesDoMes } from "@/hooks/useClientesLista";
import { cn } from "@/lib/utils";

import { Users, Plus, Search, LayoutGrid, List, UserCheck, UserX, Building2, User, Download, Cake, ArrowUpDown, MessageCircle, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useMyTeams } from "@/hooks/useMyTeams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { onlyDigits } from "@/lib/document";

import { ClientsAdvancedFilters } from "@/components/Clientes/ClientsAdvancedFilters";
import { ClientsGrid } from "@/components/Clientes/ClientsGrid";
import { ClientsTable } from "@/components/Clientes/ClientsTable";
import { ClientDetailsModal } from "@/components/Clientes/ClientDetailsModal";
import { EditClientDialog } from "@/components/Clientes/EditClientDialog";
import { NovoClienteDialog } from "@/components/Clientes/NovoClienteDialog";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { ClientsSelectionControls } from "@/components/Clientes/ClientsSelectionControls";
import { ClientsEmptyState } from "@/components/Clientes/ClientsEmptyState";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

// Sem anotação de retorno explícita — userId não faz parte de Client mas é
// usado (via cast) pelo filtro de equipe; mantém o mesmo formato solto que o
// código já usava antes desta função existir. Função de módulo (não recriada
// a cada render) para não precisar entrar nas deps de useMemo.
const mapClient = (c: ClienteComProcessos) => ({
  id: c.id,
  name: c.nome,
  email: c.email || "",
  phone: c.telefone || "",
  cases: c.processos?.[0]?.count || 0,
  status: c.status || "Ativo",
  lastContact: c.updated_at,
  cpfCnpj: c.cpf_cnpj || "",
  tipoPessoa: (c.tipo_pessoa || "fisica") as any,
  origem: c.origem || "",
  endereco: c.endereco || "",
  dataAniversario: c.data_aniversario || "",
  createdAt: c.created_at,
  userId: (c as any).user_id || null,
});

// Stat card
const StatCard = ({ label, value, Icon, color }: { label: string; value: number; Icon: React.FC<any>; color: string }) => (
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

const Clientes = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { toast } = useToast();
  // useClientes() aqui só fornece as mutações (create/update/requestMultipleDelete)
  // e a lista capada em 1000 usada para checagem de CPF/CNPJ duplicado — a
  // LISTAGEM da tela vem de useClientesLista() (paginada). Mesmo hook que o CRM
  // usa (com a lista inteira), evitando duplicar a lógica de mutação.
  const {
    data: dbClientesFull,
    create,
    update,
    requestMultipleDelete,
  } = useClientes();
  const { isAdmin, isOfficeAdmin, isSuperAdmin } = useAuth();
  const permissions = usePermissions();
  const hasAdminRights = isAdmin || isOfficeAdmin || isSuperAdmin;

  const { teams: myTeams, isAnyCoordinator } = useMyTeams();
  const [teamFilter, setTeamFilter] = useState<string | null>(null);

  // Estados
  const [sortBy, setSortBy] = useState<"recentes" | "nome">("recentes");
  const [searchValue, setSearchValue] = useState("");
  const dSearch = useDeferredValue(searchValue);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [novoClienteDialogOpen, setNovoClienteDialogOpen] = useState(false);
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [advancedFilters, setAdvancedFilters] = useState<any>({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;

  // Volta pra página 1 sempre que um filtro muda — senão o usuário pode ficar
  // numa página que não existe mais para o novo recorte.
  useEffect(() => { setPage(1); }, [dSearch, advancedFilters, teamFilter, sortBy]);

  const teamMemberIds = useMemo(() => (
    teamFilter ? (myTeams.find((t) => t.id === teamFilter)?.memberIds ?? null) : null
  ), [teamFilter, myTeams]);

  const {
    data: dbClientesPagina, total, loading, error: dbError, refetch: refetchClientes,
  } = useClientesLista({
    page, pageSize: PAGE_SIZE, search: dSearch, sortBy,
    tipoPessoa: advancedFilters.tipoPessoa || null,
    origem: advancedFilters.origem || null,
    status: advancedFilters.status || null,
    dataInicioFrom: advancedFilters.dataInicioFrom || null,
    dataInicioTo: advancedFilters.dataInicioTo || null,
    teamMemberIds,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Página atual, já filtrada/ordenada/paginada no servidor.
  const clients: Client[] = useMemo(() => dbClientesPagina.map(mapClient), [dbClientesPagina]);
  const filteredClients = clients;

  // Stats globais (independentes da busca/filtro ativo) e "office vazio" (pra
  // decidir entre o empty-state de onboarding e o de "sem resultados pra estes filtros").
  const stats = useClientesStats();
  const showEmptyState = !loading && !dbError && stats.total === 0;
  const semResultadosParaFiltro = !loading && !dbError && !showEmptyState && total === 0;
  const hasActiveFilters = !!(dSearch || advancedFilters.tipoPessoa || advancedFilters.origem || advancedFilters.status || advancedFilters.dataInicioFrom || advancedFilters.dataInicioTo || teamFilter);
  const handleClearAllFilters = () => { setSearchValue(""); setAdvancedFilters({}); setTeamFilter(null); };

  const multiSelect = useMultiSelect(filteredClients);

  // Aniversariantes do mês — busca própria e leve, não depende da página atual.
  const aniversariantesRaw = useClientesAniversariantesDoMes();
  const aniversariantes = useMemo(() =>
    aniversariantesRaw
      .map((c) => ({ ...mapClient(c), dia: Number((c.data_aniversario || "").split("-")[2]) }))
      .sort((a, b) => a.dia - b.dia),
    [aniversariantesRaw]
  );

  // Exporta só a página atual (24 clientes) — a lista agora é paginada no
  // servidor, não existe mais "todos os filtrados" carregado de uma vez.
  const exportCSV = () => {
    const header = ["Nome", "Documento", "Email", "Telefone", "Tipo", "Status", "Origem", "Processos", "Cadastro"];
    const linhas = filteredClients.map((c) => [
      c.name, c.cpfCnpj, c.email, c.phone,
      c.tipoPessoa === "juridica" ? "Pessoa Jurídica" : "Pessoa Física",
      c.status, c.origem, String(c.cases),
      c.createdAt ? new Date(c.createdAt).toLocaleDateString("pt-BR") : "",
    ]);
    const csv = [header, ...linhas]
      .map((r) => r.map((f) => `"${String(f ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Abrir cliente via query param — busca direta por id (o cliente pode não
  // estar na página atualmente carregada, já que a lista agora é paginada).
  useEffect(() => {
    const openId = searchParams.get("openId") || searchParams.get("id");
    if (!openId) return;
    (async () => {
      const { data: row } = await supabase
        .from("clientes")
        .select("*, processos!processos_cliente_id_fkey(count)")
        .eq("id", openId)
        .maybeSingle();
      if (row) { setSelectedClient(mapClient(row as any)); setClientDetailsOpen(true); }
    })();
    navigate("/clientes", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Handlers
  const handleEditClient = (clientId: string) => {
    const c = clients.find((c) => c.id === clientId);
    if (c) { setEditingClient(c); setEditDialogOpen(true); }
  };

  const handleSaveClient = async (updatedClient: Client): Promise<boolean> => {
    const doc = onlyDigits(updatedClient.cpfCnpj);
    if (doc) {
      // Checa contra dbClientesFull (useClientes(), não paginado) — a checagem
      // precisa alcançar clientes fora da página atual.
      const dup = dbClientesFull.find((c) => c.id !== updatedClient.id && onlyDigits(c.cpf_cnpj || "") === doc);
      if (dup) { toast({ variant: "destructive", title: "Documento já cadastrado", description: `${dup.nome} já usa esse CPF/CNPJ.` }); return false; }
    }
    const success = await update(updatedClient.id, {
      nome: updatedClient.name,
      email: updatedClient.email,
      telefone: updatedClient.phone,
      cpf_cnpj: doc,
      tipo_pessoa: updatedClient.tipoPessoa,
      origem: updatedClient.origem,
      endereco: updatedClient.endereco,
      status: updatedClient.status,
      data_aniversario: updatedClient.dataAniversario,
    });
    if (success) toast({ title: "Cliente atualizado", description: `${updatedClient.name} atualizado com sucesso.` });
    return !!success;
  };

  const handleNovoCliente = async (newClient: {
    name: string; email: string; phone: string; cpfCnpj: string;
    tipoPessoa: "fisica" | "juridica"; origem: string; endereco: string;
    dataAniversario: string; status: string;
  }): Promise<boolean> => {
    const doc = onlyDigits(newClient.cpfCnpj);
    if (doc) {
      const dup = dbClientesFull.find((c) => onlyDigits(c.cpf_cnpj || "") === doc);
      if (dup) { toast({ variant: "destructive", title: "Cliente já cadastrado", description: `${dup.nome} já usa esse CPF/CNPJ.` }); return false; }
    }
    const success = await create({
      nome: newClient.name,
      email: newClient.email,
      telefone: newClient.phone,
      cpf_cnpj: doc,
      tipo_pessoa: newClient.tipoPessoa,
      origem: newClient.origem,
      endereco: newClient.endereco,
      // status em minúsculo: os filtros/KPIs e as metas casam "ativo"/"convertido"
      // (o backfill v10 padronizou; gravar "Ativo" reintroduzia a divergência). (v11)
      status: (newClient.status || "ativo").toLowerCase(),
      data_aniversario: newClient.dataAniversario,
      // NovoCliente = Omit<Row,...>: colunas nullable continuam de presença
      // obrigatória. Campos não expostos no formulário entram como null.
      observacoes: null,
      proximo_contato: null,
      team_id: null,
      valor_estimado: null,
    });
    if (success) toast({ title: "Cliente cadastrado", description: `${newClient.name} cadastrado com sucesso.` });
    return !!success;
  };

  const handleDeleteSingleClient = (clientId: string) => {
    setClientToDelete(clientId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const ids = clientToDelete ? [clientToDelete] : multiSelect.getSelectedItems().map((c) => c.id);
      const success = await requestMultipleDelete(ids, "Exclusão solicitada pelo usuário");
      if (success && !clientToDelete) multiSelect.clearSelection();
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const handleViewProcesses = (id: string, name: string) => navigate("/processos", { state: { clientFilter: name, clientId: id } });
  const handleViewAtendimentos = (id: string, name: string) => navigate("/atendimentos", { state: { clientFilter: name, clientId: id } });
  const handleViewConsultivo = (id: string, name: string) => navigate("/consultivo", { state: { clientFilter: name, clientId: id } });

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 overflow-x-hidden entry-animate">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie sua base de clientes e relacionamentos.
            </p>
          </div>
        </div>
        <PermissionGuard permission="canCreateClients">
          <Button size="lg" onClick={() => setNovoClienteDialogOpen(true)}
            className="rounded-xl h-11 px-6 font-black uppercase text-xs tracking-widest shadow-premium">
            <Plus className="mr-2 h-4 w-4" />Novo Cliente
          </Button>
        </PermissionGuard>
      </div>

      {/* Stats */}
      {!loading && stats.total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total" value={stats.total} Icon={Users} color="bg-primary/10 text-primary" />
          <StatCard label="Ativos" value={stats.ativos} Icon={UserCheck} color="bg-emerald-500/10 text-emerald-500" />
          <StatCard label="Inativos" value={stats.inativos} Icon={UserX} color="bg-red-500/10 text-red-500" />
          <StatCard label="Jurídica" value={stats.juridica} Icon={Building2} color="bg-violet-500/10 text-violet-500" />
        </div>
      )}

      {/* Aniversariantes do mês */}
      {!loading && aniversariantes.length > 0 && (
        <div className="rounded-2xl border border-pink-500/20 bg-pink-500/5 p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-pink-500/15 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
            <Cake className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-pink-600 dark:text-pink-400">Aniversariantes do mês</p>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {aniversariantes.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1.5 text-xs font-bold bg-card border border-black/5 dark:border-border rounded-full px-2.5 py-1">
                  <span className="text-pink-600 dark:text-pink-400 font-black">{String(c.dia).padStart(2, "0")}</span>
                  <button onClick={() => { setSelectedClient(c); setClientDetailsOpen(true); }} className="hover:text-primary truncate max-w-[140px]">{c.name}</button>
                  {c.phone && (
                    <a href={`https://wa.me/55${onlyDigits(c.phone)}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400" title="WhatsApp">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Busca + Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Buscar por nome, e-mail, telefone ou documento..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10 rounded-xl h-11 bg-card/60 border-black/8 dark:border-border"
          />
        </div>
        <ClientsAdvancedFilters
          onFiltersChange={setAdvancedFilters}
          onClearFilters={() => { setAdvancedFilters({}); setSearchValue(""); }}
        />
        {/* Filtro de equipe — só para coordenadores */}
        {isAnyCoordinator && myTeams.filter(t => t.myRole === 'coordinator').map(team => (
          <button
            key={team.id}
            onClick={() => setTeamFilter(prev => prev === team.id ? null : team.id)}
            className={cn(
              "h-11 px-3 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0",
              teamFilter === team.id
                ? "border-transparent text-white"
                : "border-black/8 dark:border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
            style={teamFilter === team.id ? { backgroundColor: team.color } : {}}
          >
            <Users className="h-3.5 w-3.5" />
            {team.name}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
        </div>
      ) : dbError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível carregar os clientes"
          description={dbError}
          actionLabel="Tentar novamente"
          onAction={refetchClientes}
        />
      ) : showEmptyState ? (
        <ClientsEmptyState onNewClient={() => setNovoClienteDialogOpen(true)} />
      ) : semResultadosParaFiltro ? (
        <EmptyState
          icon={Search}
          title="Nenhum cliente encontrado"
          description="Nenhum cliente corresponde à busca ou aos filtros selecionados."
          actionLabel={hasActiveFilters ? "Limpar filtros" : undefined}
          onAction={hasActiveFilters ? handleClearAllFilters : undefined}
        />
      ) : (
        <div className="space-y-4">
          {/* Controls bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <ClientsSelectionControls
                isAllSelected={multiSelect.isAllSelected}
                selectedCount={multiSelect.selectedCount}
                totalCount={filteredClients.length}
                onSelectAll={multiSelect.selectAll}
                onClearSelection={multiSelect.clearSelection}
                onDeleteSelected={() => setDeleteDialogOpen(true)}
              />
              {!multiSelect.selectedCount && (
                <p className="text-xs text-muted-foreground/60 font-bold uppercase tracking-widest">
                  {total} cliente{total !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
            {/* Ordenação — "mais processos" saiu: não dá pra ordenar por uma
                contagem agregada de uma relação embutida no servidor. */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-10 w-auto gap-1.5 rounded-xl border-black/8 dark:border-border text-xs font-bold">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recentes">Mais recentes</SelectItem>
                <SelectItem value="nome">Nome (A–Z)</SelectItem>
              </SelectContent>
            </Select>

            {/* Exportar CSV — só a página atual */}
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredClients.length === 0}
              title="Exporta os clientes da página atual" className="h-10 rounded-xl border-black/8 dark:border-border text-xs font-bold gap-1.5">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>

            {/* Toggle grid/lista */}
            <div className="flex items-center p-1 bg-black/5 dark:bg-black/20 rounded-xl border border-black/5 dark:border-border">
              <Button variant="ghost" size="sm" onClick={() => setViewMode("list")}
                className={cn(
                  "px-3 py-2 h-auto text-xs font-black uppercase tracking-widest transition-all rounded-lg",
                  viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}>
                <List className="w-3.5 h-3.5 mr-1.5" />Lista
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setViewMode("grid")}
                className={cn(
                  "px-3 py-2 h-auto text-xs font-black uppercase tracking-widest transition-all rounded-lg",
                  viewMode === "grid" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}>
                <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />Cards
              </Button>
            </div>
            </div>
          </div>

          {viewMode === "grid" ? (
            <ClientsGrid
              clients={filteredClients}
              selectedIds={multiSelect.getSelectedItems().map((i) => i.id)}
              onToggleSelect={multiSelect.toggleItem}
              onClientClick={(c) => { setSelectedClient(c); setClientDetailsOpen(true); }}
              onEditClient={handleEditClient}
              onViewProcesses={handleViewProcesses}
              onViewAtendimentos={handleViewAtendimentos}
              onViewConsultivo={handleViewConsultivo}
              onDeleteClient={handleDeleteSingleClient}
            />
          ) : (
            <ClientsTable
              clients={filteredClients}
              selectedIds={multiSelect.getSelectedItems().map((i) => String(i.id))}
              onToggleSelect={(id) => multiSelect.toggleItem(id)}
              onClientClick={(c) => { setSelectedClient(c); setClientDetailsOpen(true); }}
              onEditClient={handleEditClient}
              onViewProcesses={handleViewProcesses}
              onViewAtendimentos={handleViewAtendimentos}
              onViewConsultivo={handleViewConsultivo}
              onDeleteClient={handleDeleteSingleClient}
            />
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Página {page} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 rounded-lg text-xs font-bold gap-1"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 rounded-lg text-xs font-bold gap-1"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      <ClientDetailsModal
        client={selectedClient}
        isOpen={clientDetailsOpen}
        onClose={() => setClientDetailsOpen(false)}
        onEditClient={handleEditClient}
        onViewProcesses={handleViewProcesses}
        onViewAtendimentos={handleViewAtendimentos}
        onViewConsultivo={handleViewConsultivo}
      />

      <EditClientDialog
        client={editingClient}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSaveClient}
        onDelete={handleDeleteSingleClient}
      />

      <NovoClienteDialog
        open={novoClienteDialogOpen}
        onOpenChange={setNovoClienteDialogOpen}
        onSave={handleNovoCliente}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setClientToDelete(null); }}
        onConfirm={handleConfirmDelete}
        title={hasAdminRights ? "Excluir Cliente(s)" : "Solicitar Exclusão"}
        description={
          hasAdminRights
            ? `Confirma a exclusão de ${clientToDelete ? "1" : multiSelect.selectedCount} cliente(s)? Esta ação não pode ser desfeita.`
            : `Solicitar exclusão de ${clientToDelete ? "1" : multiSelect.selectedCount} cliente(s)? Um administrador precisará aprovar.`
        }
        isLoading={isDeleting}
      />
    </div>
  );
};

export default Clientes;
