import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { Client } from "@/types/client";
import { useClientes } from "@/hooks/useClientes";
import { cn } from "@/lib/utils";

import { Users, Plus, Search, LayoutGrid, List, UserCheck, UserX, Building2, User, Download, Cake, ArrowUpDown, MessageCircle } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";

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
  const {
    data: dbClientes,
    loading,
    create,
    update,
    requestMultipleDelete,
    isEmpty: dbIsEmpty,
  } = useClientes();
  const { isAdmin, isOfficeAdmin, isSuperAdmin } = useAuth();
  const permissions = usePermissions();
  const hasAdminRights = isAdmin || isOfficeAdmin || isSuperAdmin;

  // Mapeia todos os clientes reais (qualquer status exceto leads CRM puros)
  const { teams: myTeams, isAnyCoordinator } = useMyTeams();
  const [teamFilter, setTeamFilter] = useState<string | null>(null);

  const clients: Client[] = useMemo(() =>
    dbClientes.map((c) => ({
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
    })),
    [dbClientes]
  );

  // Stats
  const stats = useMemo(() => ({
    total: clients.length,
    ativos: clients.filter((c) => c.status.toLowerCase() === "ativo").length,
    inativos: clients.filter((c) => c.status.toLowerCase() === "inativo").length,
    juridica: clients.filter((c) => c.tipoPessoa === "juridica").length,
  }), [clients]);

  // Estados
  const [sortBy, setSortBy] = useState<"recentes" | "nome" | "processos">("recentes");
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

  const showEmptyState = dbIsEmpty && !loading;

  // Filtragem + ordenação (useMemo evita re-render extra a cada tecla → digitação fluida)
  const filteredClients = useMemo(() => {
    let filtered = [...clients];
    const q = dSearch.toLowerCase().trim();
    const qDigits = onlyDigits(dSearch);

    if (q) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (!!qDigits && onlyDigits(c.phone).includes(qDigits)) ||
          (!!qDigits && onlyDigits(c.cpfCnpj).includes(qDigits))
      );
    }
    if (advancedFilters.tipoPessoa) filtered = filtered.filter((c) => c.tipoPessoa === advancedFilters.tipoPessoa);
    if (advancedFilters.origem) filtered = filtered.filter((c) => c.origem === advancedFilters.origem);
    if (advancedFilters.status) filtered = filtered.filter((c) => c.status.toLowerCase() === advancedFilters.status.toLowerCase());
    if (advancedFilters.dataInicioFrom) filtered = filtered.filter((c) => new Date(c.createdAt) >= advancedFilters.dataInicioFrom);
    if (advancedFilters.dataInicioTo) filtered = filtered.filter((c) => new Date(c.createdAt) <= advancedFilters.dataInicioTo);

    if (teamFilter) {
      const teamMemberIds = myTeams.find((t) => t.id === teamFilter)?.memberIds ?? [];
      filtered = filtered.filter((c) => teamMemberIds.includes((c as any).userId));
    }

    filtered.sort((a, b) => {
      if (sortBy === "nome") return a.name.localeCompare(b.name, "pt-BR");
      if (sortBy === "processos") return (b.cases || 0) - (a.cases || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return filtered;
  }, [clients, dSearch, advancedFilters, teamFilter, myTeams, sortBy]);

  const multiSelect = useMultiSelect(filteredClients);

  // Aniversariantes do mês (data 'YYYY-MM-DD' — parse manual evita fuso)
  const aniversariantes = useMemo(() => {
    const mesAtual = new Date().getMonth() + 1;
    return clients
      .filter((c) => {
        const parts = (c.dataAniversario || "").split("-");
        return parts.length === 3 && Number(parts[1]) === mesAtual;
      })
      .map((c) => ({ ...c, dia: Number(c.dataAniversario.split("-")[2]) }))
      .sort((a, b) => a.dia - b.dia);
  }, [clients]);

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

  // Abrir cliente via query param
  useEffect(() => {
    const openId = searchParams.get("openId") || searchParams.get("id");
    if (!openId || !clients.length) return;
    const client = clients.find((c) => String(c.id) === openId);
    if (client) { setSelectedClient(client); setClientDetailsOpen(true); }
    navigate("/clientes", { replace: true });
  }, [location.search, clients]);

  // Handlers
  const handleEditClient = (clientId: string) => {
    const c = clients.find((c) => c.id === clientId);
    if (c) { setEditingClient(c); setEditDialogOpen(true); }
  };

  const handleSaveClient = async (updatedClient: Client): Promise<boolean> => {
    const doc = onlyDigits(updatedClient.cpfCnpj);
    if (doc) {
      const dup = clients.find((c) => c.id !== updatedClient.id && onlyDigits(c.cpfCnpj) === doc);
      if (dup) { toast({ variant: "destructive", title: "Documento já cadastrado", description: `${dup.name} já usa esse CPF/CNPJ.` }); return false; }
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
      const dup = clients.find((c) => onlyDigits(c.cpfCnpj) === doc);
      if (dup) { toast({ variant: "destructive", title: "Cliente já cadastrado", description: `${dup.name} já usa esse CPF/CNPJ.` }); return false; }
    }
    const success = await create({
      nome: newClient.name,
      email: newClient.email,
      telefone: newClient.phone,
      cpf_cnpj: doc,
      tipo_pessoa: newClient.tipoPessoa,
      origem: newClient.origem,
      endereco: newClient.endereco,
      status: newClient.status || "Ativo",
      data_aniversario: newClient.dataAniversario,
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
        <Button size="lg" onClick={() => setNovoClienteDialogOpen(true)}
          className="rounded-xl h-11 px-6 font-black uppercase text-xs tracking-widest shadow-premium">
          <Plus className="mr-2 h-4 w-4" />Novo Cliente
        </Button>
      </div>

      {/* Stats */}
      {!loading && clients.length > 0 && (
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
      ) : showEmptyState ? (
        <ClientsEmptyState onNewClient={() => setNovoClienteDialogOpen(true)} />
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
                  {filteredClients.length} cliente{filteredClients.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
            {/* Ordenação */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-10 w-auto gap-1.5 rounded-xl border-black/8 dark:border-border text-xs font-bold">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recentes">Mais recentes</SelectItem>
                <SelectItem value="nome">Nome (A–Z)</SelectItem>
                <SelectItem value="processos">Mais processos</SelectItem>
              </SelectContent>
            </Select>

            {/* Exportar CSV */}
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredClients.length === 0}
              className="h-10 rounded-xl border-black/8 dark:border-border text-xs font-bold gap-1.5">
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
