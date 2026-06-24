
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDataState } from "@/hooks/useDataState";
import { useMultiSelect } from "@/hooks/useMultiSelect";

// Componentes existentes
import { AtendimentosPageHeader } from "@/components/Atendimentos/AtendimentosPageHeader";
import { AtendimentosFilters } from "@/components/Atendimentos/AtendimentosFilters";
import { AtendimentosEmptyState } from "@/components/Atendimentos/AtendimentosEmptyState";
import { AtendimentosSelectionControls } from "@/components/Atendimentos/AtendimentosSelectionControls";
import { AtendimentosGrid } from "@/components/Atendimentos/AtendimentosGrid";
import { EditAtendimentoDialog } from "@/components/Atendimentos/EditAtendimentoDialog";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";

// Novo componente
import { NovoAtendimentoDialog } from "@/components/Atendimentos/NovoAtendimentoDialog";

const initialAtendimentosData: any[] = [];

const Atendimentos = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: atendimentos, isNewUser, loadSampleData } = useDataState(initialAtendimentosData);
  
  // Estados
  const [atendimentosList, setAtendimentosList] = useState<any[]>(atendimentos);
  const [filteredAtendimentos, setFilteredAtendimentos] = useState<any[]>(atendimentos);
  const [editingAtendimento, setEditingAtendimento] = useState<any | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [novoAtendimentoDialogOpen, setNovoAtendimentoDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(isNewUser);

  // Clientes mock para o dropdown
  const [clientes] = useState([
    { id: 1, name: "João Silva Santos" },
    { id: 2, name: "Maria Oliveira Ltda" },
    { id: 3, name: "Pedro Costa" },
    { id: 4, name: "Ana Santos" }
  ]);

  // Atualizar lista quando dados do hook mudarem
  useEffect(() => {
    setAtendimentosList(atendimentos);
    setFilteredAtendimentos(atendimentos);
  }, [atendimentos]);

  useEffect(() => {
    setShowEmptyState(isNewUser && atendimentos.length === 0);
  }, [isNewUser, atendimentos]);

  // Multi-seleção
  const multiSelect = useMultiSelect(filteredAtendimentos);

  // Handlers
  const handleEditAtendimento = (atendimentoId: number) => {
    const atendimento = atendimentosList.find(a => a.id === atendimentoId);
    if (atendimento) {
      setEditingAtendimento(atendimento);
      setEditDialogOpen(true);
    }
  };

  const handleSaveAtendimento = (updatedAtendimento: any) => {
    const newAtendimentos = atendimentosList.map(a => 
      a.id === updatedAtendimento.id ? updatedAtendimento : a
    );
    setAtendimentosList(newAtendimentos);
    setFilteredAtendimentos(newAtendimentos);
  };

  const handleNovoAtendimento = (novoAtendimento: any) => {
    const newAtendimentos = [...atendimentosList, novoAtendimento];
    setAtendimentosList(newAtendimentos);
    setFilteredAtendimentos(newAtendimentos);
    setShowEmptyState(false);
  };

  const handleDeleteSelected = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const selectedIds = multiSelect.getSelectedItems().map(item => item.id);
      const newAtendimentos = atendimentosList.filter(a => !selectedIds.includes(a.id));
      
      setAtendimentosList(newAtendimentos);
      setFilteredAtendimentos(newAtendimentos);
      multiSelect.clearSelection();
      
      toast({
        title: "Atendimentos excluídos",
        description: `${selectedIds.length} atendimento(s) foram excluídos com sucesso.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Ocorreu um erro ao excluir os atendimentos.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleFiltersChange = (filters: any) => {
    let filtered = [...atendimentosList];

    if (filters.status) {
      filtered = filtered.filter(a => a.status === filters.status);
    }

    if (filters.tipo) {
      filtered = filtered.filter(a => a.tipoAtendimento === filters.tipo);
    }

    if (filters.dataFrom) {
      filtered = filtered.filter(a => new Date(a.dataAtendimento) >= filters.dataFrom);
    }

    if (filters.dataTo) {
      filtered = filtered.filter(a => new Date(a.dataAtendimento) <= filters.dataTo);
    }

    setFilteredAtendimentos(filtered);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden">
      {/* Page Header */}
      <AtendimentosPageHeader
        selectedCount={multiSelect.selectedCount}
        onDeleteSelected={handleDeleteSelected}
        onNewAtendimento={() => setNovoAtendimentoDialogOpen(true)}
        isNoneSelected={multiSelect.isNoneSelected}
        isFiltered={false}
        onClearFilter={() => {}}
      />

      {/* Empty State para novos usuários */}
      {showEmptyState ? (
        <AtendimentosEmptyState
          onNewAtendimento={() => setNovoAtendimentoDialogOpen(true)}
          onLoadSampleData={loadSampleData}
        />
      ) : (
        // Conteúdo normal quando há atendimentos
        <>
          {/* Filters */}
          <AtendimentosFilters
            searchValue=""
            statusFilter=""
            tipoFilter=""
            onSearchChange={() => {}}
            onStatusFilterChange={() => {}}
            onTipoFilterChange={() => {}}
            onClearFilters={() => {}}
            activeFiltersCount={0}
          />

          {/* Selection Controls */}
          {filteredAtendimentos.length > 0 && (
            <AtendimentosSelectionControls
              isAllSelected={multiSelect.isAllSelected}
              selectedCount={multiSelect.selectedCount}
              totalCount={filteredAtendimentos.length}
              onSelectAll={multiSelect.selectAll}
              onClearSelection={multiSelect.clearSelection}
              groupedByDate={false}
              onToggleGrouping={() => {}}
            />
          )}

          {/* Atendimentos Grid */}
          {filteredAtendimentos.length > 0 && (
            <AtendimentosGrid
              atendimentos={filteredAtendimentos}
              selectedIds={multiSelect.getSelectedItems().map(item => item.id)}
              onToggleSelect={multiSelect.toggleItem}
              onEditAtendimento={(id: string) => handleEditAtendimento(parseInt(id))}
              onNavigateToClient={(clientId: number, clientName: string) => {
                console.log('Navigate to client:', clientId, clientName);
                navigate(`/clientes?client=${clientId}`);
              }}
              onNavigateToProcesses={(clientId: number, clientName: string) => {
                console.log('Navigate to processes:', clientId, clientName);
                navigate(`/processos?client=${clientId}`);
              }}
              getStatusColor={(status: string) => {
                switch (status) {
                  case 'agendado': return 'bg-blue-500';
                  case 'realizado': return 'bg-green-500';
                  case 'cancelado': return 'bg-red-500';
                  default: return 'bg-gray-500';
                }
              }}
            />
          )}
        </>
      )}

      {/* Modais */}
      <NovoAtendimentoDialog
        open={novoAtendimentoDialogOpen}
        onOpenChange={setNovoAtendimentoDialogOpen}
        onSave={handleNovoAtendimento}
        clientes={clientes}
      />

      <EditAtendimentoDialog
        atendimento={editingAtendimento}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSaveAtendimento}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Excluir Atendimentos"
        description={`Tem certeza que deseja excluir ${multiSelect.selectedCount} atendimento(s)?`}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default Atendimentos;
