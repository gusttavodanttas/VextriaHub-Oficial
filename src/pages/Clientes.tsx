import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { Client } from "@/types/client";
import { Loader2, Users, Plus, Search } from "lucide-react";
import { useClientes } from "@/hooks/useClientes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Debug logs
console.log('%c [VEXTRIA] CLIENTES DEPLOY - 2026-04-25-04-20 ', 'background: #0ea5e9; color: #fff; font-weight: bold; font-size: 16px;');

// Componentes refatorados
import { ClientsPageHeader } from "@/components/Clientes/ClientsPageHeader";
import { ClientsSearchBar } from "@/components/Clientes/ClientsSearchBar";
import { ClientsAdvancedFilters } from "@/components/Clientes/ClientsAdvancedFilters";
import { ClientsEmptyState } from "@/components/Clientes/ClientsEmptyState";
import { ClientsSelectionControls } from "@/components/Clientes/ClientsSelectionControls";
import { ClientsGrid } from "@/components/Clientes/ClientsGrid";
import { ClientsTable } from "@/components/Clientes/ClientsTable";
import { ClientDetailsModal } from "@/components/Clientes/ClientDetailsModal";
import { LayoutGrid, List } from "lucide-react";

// Componentes existentes mantidos
import { EditClientDialog } from "@/components/Clientes/EditClientDialog";
import { NovoClienteDialog } from "@/components/Clientes/NovoClienteDialog";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";

const Clientes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    data: dbClientes, 
    loading, 
    create, 
    update, 
    requestMultipleDelete, 
    isEmpty: dbIsEmpty 
  } = useClientes();
  const { user, isAdmin, isOfficeAdmin, isSuperAdmin } = useAuth();
  const permissions = usePermissions();
  const hasAdminRights = isAdmin || isOfficeAdmin || isSuperAdmin;
  
  // Mapeamento dos dados do banco para o formato da UI
  // Filtramos para mostrar apenas clientes reais (Ativo ou Convertido do CRM)
  // Ocultamos leads que ainda estão em prospecção
  const clients = dbClientes
    .filter(c => {
      const status = (c.status || "").toLowerCase();
      return status === "ativo" || status === "convertido";
    })
    .map(c => ({
      id: c.id,
      name: c.nome,
      email: c.email || '',
      phone: c.telefone || '',
      cases: c.processos?.[0]?.count || 0,
      status: c.status || 'Ativo',
      lastContact: c.updated_at,
      cpfCnpj: c.cpf_cnpj || '',
      tipoPessoa: (c.tipo_pessoa || "fisica") as any,
      origem: c.origem || '',
      endereco: c.endereco || '',
      dataAniversario: c.data_aniversario || '',
      createdAt: c.created_at
    }));

  // Estados
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [novoClienteDialogOpen, setNovoClienteDialogOpen] = useState(false);
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const showEmptyState = dbIsEmpty && !loading;

  // Atualizar lista filtrada quando os dados ou a busca mudarem
  useEffect(() => {
    applyFilters(clients, searchValue, {});
  }, [dbClientes, searchValue]);

  // Multi-seleção
  const multiSelect = useMultiSelect(filteredClients);

  // Aplicar filtros
  const applyFilters = (clientsList: Client[], search: string, advancedFilters: any) => {
    let filtered = [...clientsList];

    // Filtro de busca
    if (search) {
      filtered = filtered.filter(client =>
        client.name.toLowerCase().includes(search.toLowerCase()) ||
        client.email.toLowerCase().includes(search.toLowerCase()) ||
        client.phone.includes(search) ||
        client.cpfCnpj.includes(search)
      );
    }

    // Filtros avançados
    if (advancedFilters.tipoPessoa) {
      filtered = filtered.filter(client => client.tipoPessoa === advancedFilters.tipoPessoa);
    }

    if (advancedFilters.origem) {
      filtered = filtered.filter(client => client.origem === advancedFilters.origem);
    }

    if (advancedFilters.status) {
      filtered = filtered.filter(client => client.status === advancedFilters.status);
    }

    if (advancedFilters.dataInicioFrom) {
      filtered = filtered.filter(client => 
        new Date(client.createdAt) >= advancedFilters.dataInicioFrom
      );
    }

    if (advancedFilters.dataInicioTo) {
      filtered = filtered.filter(client => 
        new Date(client.createdAt) <= advancedFilters.dataInicioTo
      );
    }

    setFilteredClients(filtered);
  };

  // Handlers de cliente
  const handleEditClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setEditingClient(client);
      setEditDialogOpen(true);
    }
  };

  const handleClientClick = (client: Client) => {
    setSelectedClient(client);
    setClientDetailsOpen(true);
  };

  const handleSaveClient = async (updatedClient: Client) => {
    const success = await update(updatedClient.id, {
      nome: updatedClient.name,
      email: updatedClient.email,
      telefone: updatedClient.phone,
      cpf_cnpj: updatedClient.cpfCnpj,
      tipo_pessoa: updatedClient.tipoPessoa,
      origem: updatedClient.origem,
      endereco: updatedClient.endereco,
      status: updatedClient.status,
      data_aniversario: updatedClient.dataAniversario
    });
    
    if (success) {
      toast({
        title: "Cliente atualizado",
        description: `Os dados de ${updatedClient.name} foram atualizados com sucesso.`,
      });
    }
  };

  const handleNovoCliente = async (newClient: Client) => {
    const success = await create({
      nome: newClient.name,
      email: newClient.email,
      telefone: newClient.phone,
      cpf_cnpj: newClient.cpfCnpj,
      tipo_pessoa: newClient.tipoPessoa,
      origem: newClient.origem,
      endereco: newClient.endereco,
      status: newClient.status || 'Ativo',
      data_aniversario: newClient.dataAniversario
    });
    
    if (success) {
      toast({
        title: "Cliente cadastrado",
        description: `${newClient.name} foi cadastrado com sucesso.`,
      });
    }
  };

  // Handlers de navegação
  const handleViewProcesses = (clientId: string, clientName: string) => {
    navigate('/processos', { state: { clientFilter: clientName, clientId } });
  };

  const handleViewAtendimentos = (clientId: string, clientName: string) => {
    navigate('/atendimentos', { state: { clientFilter: clientName, clientId } });
  };

  const handleViewConsultivo = (clientId: string, clientName: string) => {
    navigate('/consultivo', { state: { clientFilter: clientName, clientId } });
  };

  // Handlers de exclusão
  const handleDeleteSelected = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteSingleClient = (clientId: string) => {
    setClientToDelete(clientId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const selectedIds = clientToDelete 
        ? [clientToDelete] 
        : multiSelect.getSelectedItems().map(client => client.id);
        
      const success = await requestMultipleDelete(selectedIds, "Exclusão solicitada pelo usuário");
      
      if (success && !clientToDelete) {
        multiSelect.clearSelection();
      }
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Ocorreu um erro ao excluir os clientes.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };


  // Handlers de UI
  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    applyFilters(clients, value, {});
  };

  const handleAdvancedFiltersChange = (filters: any) => {
    applyFilters(clients, searchValue, filters);
  };

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-12 overflow-x-hidden entry-animate">
      {/* Page Header Moderno Premium */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary/10 via-card/80 to-background border border-black/5 dark:border-white/10 p-8 shadow-premium">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-secondary/10 rounded-full blur-[60px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-premium group hover:scale-110 transition-transform duration-300">
                <Users className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                Gestão de{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                  Clientes
                </span>
              </h1>
            </div>
            <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl px-1">
              Gerencie sua base de relacionamentos e funil de vendas com inteligência.
            </p>
          </div>
          
          <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl border border-black/5 dark:border-white/10 shadow-premium">
            <Button 
              onClick={() => setNovoClienteDialogOpen(true)}
              size="lg"
              className="rounded-xl shadow-premium h-12 px-8 font-black uppercase tracking-widest text-[11px] gap-2"
            >
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </div>
        </div>
      </div>

      {/* Seção de Filtros e Busca Premium */}
      <div className="grid grid-cols-1 gap-6">
        <div className="glass-card p-8 rounded-[2.5rem] shadow-premium border border-black/5 dark:border-white/10 bg-white dark:bg-card/40">
          <div className="flex flex-col md:flex-row gap-6 mb-8">
            <div className="flex-1 relative group/search">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30 group-focus-within/search:text-primary transition-all duration-300" />
              <Input
                placeholder="Pesquisar por nome, email ou documento..."
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-14 h-16 bg-white dark:bg-white/[0.05] border-black/5 dark:border-white/10 rounded-[1.5rem] text-lg focus:ring-4 focus:ring-primary/10 transition-all shadow-premium font-black placeholder:text-muted-foreground/30 placeholder:font-medium tracking-tight"
              />
            </div>
          </div>
          <ClientsAdvancedFilters 
            onFiltersChange={handleAdvancedFiltersChange} 
            onClearFilters={() => handleSearchChange("")}
          />
        </div>
      </div>

      {/* Lista de Clientes */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
            <Loader2 className="h-14 w-14 animate-spin text-primary relative" />
          </div>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">Sincronizando Base de Clientes...</p>
        </div>
      ) : showEmptyState ? (
        <ClientsEmptyState 
          onNewClient={() => setNovoClienteDialogOpen(true)} 
        />
      ) : (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <ClientsSelectionControls
                isAllSelected={multiSelect.isAllSelected}
                selectedCount={multiSelect.selectedCount}
                totalCount={filteredClients.length}
                onSelectAll={multiSelect.selectAll}
                onClearSelection={multiSelect.clearSelection}
                onDeleteSelected={handleDeleteSelected}
              />
              
              <div className="flex items-center p-1 bg-black/5 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/10 backdrop-blur-sm self-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "px-4 py-2 h-auto text-xs font-black uppercase tracking-widest transition-all rounded-lg",
                    viewMode === 'list' 
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                  )}
                >
                  <List className="w-4 h-4 mr-2" />
                  Lista
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "px-4 py-2 h-auto text-xs font-black uppercase tracking-widest transition-all rounded-lg",
                    viewMode === 'grid' 
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                  )}
                >
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  Cards
                </Button>
              </div>
            </div>

            {/* Grid vs Tabela de Clientes */}
            {viewMode === "grid" ? (
              <ClientsGrid
                clients={filteredClients}
                selectedIds={multiSelect.getSelectedItems().map(item => item.id)}
                onToggleSelect={multiSelect.toggleItem}
                onClientClick={handleClientClick}
                onEditClient={handleEditClient}
                onViewProcesses={handleViewProcesses}
                onViewAtendimentos={handleViewAtendimentos}
                onViewConsultivo={handleViewConsultivo}
                onDeleteClient={handleDeleteSingleClient}
              />
            ) : (
              <ClientsTable
                clients={filteredClients}
                selectedIds={multiSelect.getSelectedItems().map(item => String(item.id))}
                onToggleSelect={(id) => multiSelect.toggleItem(id)}
                onClientClick={handleClientClick}
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
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setClientToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={hasAdminRights ? "Excluir Cliente(s) Definitivamente" : "Solicitar Exclusão de Cliente(s)"}
        description={hasAdminRights 
          ? `Tem certeza que deseja excluir ${clientToDelete ? 'este' : multiSelect.selectedCount} cliente(s)? Esta ação não poderá ser desfeita.` 
          : `Você está solicitando a exclusão de ${clientToDelete ? 'este' : multiSelect.selectedCount} cliente(s). Um administrador precisará aprovar esta solicitação.`
        }
        isLoading={isDeleting}
      />
    </div>
  );
};

export default Clientes;
