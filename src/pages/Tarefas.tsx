import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Tarefa, TarefaFormData } from "@/types/tarefa";
import { useTarefaService } from "@/services/tarefaService";
import { useMultiSelect } from "@/hooks/useMultiSelect";

// Componentes refatorados
import { TarefasPageHeader } from "@/components/Tarefas/TarefasPageHeader";
import { TarefasFilters } from "@/components/Tarefas/TarefasFilters";
import { TarefasList } from "@/components/Tarefas/TarefasList";
import { TarefasEmptyState } from "@/components/Tarefas/TarefasEmptyState";
import { NovaTarefaDialog } from "@/components/Tarefas/NovaTarefaDialog";

// Componentes existentes mantidos
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Target, Plus } from "lucide-react";

// Dados de exemplo
const initialTasks: Tarefa[] = [
  {
    id: 1,
    title: "Protocolar petição inicial - Silva vs. Empresa XYZ",
    dueDate: "Hoje, 16:00",
    priority: "alta",
    client: "Maria Silva",
    case: "Trabalhista #2025-001",
    points: 50,
    completed: false,
    description: "Protocolar petição inicial no processo trabalhista contra a Empresa XYZ"
  },
  {
    id: 2,
    title: "Responder publicação judicial",
    dueDate: "Amanhã, 12:00",
    priority: "alta",
    client: "João Santos",
    case: "Civil #2025-015",
    points: 40,
    completed: false,
    description: "Responder à publicação judicial referente ao processo civil"
  },
  {
    id: 3,
    title: "Reunião com cliente",
    dueDate: "23/01, 14:30",
    priority: "media",
    client: "Tech Solutions Ltda",
    case: "Empresarial #2025-008",
    points: 20,
    completed: true,
    description: "Reunião de alinhamento sobre contratos empresariais"
  }
];

const Tarefas = () => {
  const { toast } = useToast();
  const tarefaService = useTarefaService();
  
  // Estados
  const [tarefas, setTarefas] = useState<Tarefa[]>(initialTasks);
  const [completedTasks, setCompletedTasks] = useState<number[]>([3]);
  const [searchValue, setSearchValue] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteIndividualDialogOpen, setDeleteIndividualDialogOpen] = useState(false);
  const [tarefaToDelete, setTarefaToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [novaTarefaDialogOpen, setNovaTarefaDialogOpen] = useState(false);

  // Multi-seleção
  const multiSelect = useMultiSelect(tarefas);

  // Handlers
  const handleToggleComplete = (taskId: number) => {
    const result = tarefaService.toggleTaskCompletion(tarefas, taskId);
    setTarefas(result.tarefas);
    
    if (result.completedTask) {
      setCompletedTasks(prev => 
        result.completedTask!.completed 
          ? [...prev, taskId]
          : prev.filter(id => id !== taskId)
      );
    }
  };

  const handleNewTarefa = () => {
    setNovaTarefaDialogOpen(true);
  };

  const handleAddTarefa = (tarefaData: TarefaFormData) => {
    const novaTarefa: Tarefa = {
      ...tarefaData,
      id: Date.now(), // ID temporário
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setTarefas(prev => [novaTarefa, ...prev]);
  };

  const handleDeleteSelected = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const selectedIds = multiSelect.getSelectedItems().map(item => item.id);
      const result = tarefaService.deleteTarefas(tarefas, selectedIds);
      
      if (result.success) {
        setTarefas(result.tarefas);
        setCompletedTasks(prev => prev.filter(id => !selectedIds.includes(id)));
        multiSelect.clearSelection();
      }
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Ocorreu um erro ao excluir as tarefas.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleDeleteTarefa = (tarefaId: number) => {
    setTarefaToDelete(tarefaId);
    setDeleteIndividualDialogOpen(true);
  };

  const handleConfirmDeleteIndividual = async () => {
    if (!tarefaToDelete) return;
    
    setIsDeleting(true);
    try {
      const result = tarefaService.deleteTarefas(tarefas, [tarefaToDelete]);
      
      if (result.success) {
        setTarefas(result.tarefas);
        setCompletedTasks(prev => prev.filter(id => id !== tarefaToDelete));
        toast({
          title: "Tarefa excluída",
          description: "A tarefa foi excluída com sucesso.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Ocorreu um erro ao excluir a tarefa.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteIndividualDialogOpen(false);
      setTarefaToDelete(null);
    }
  };

  const handleLoadSampleData = () => {
    setTarefas(initialTasks);
    setCompletedTasks([3]);
    toast({
      title: "Dados carregados",
      description: "Dados de exemplo foram carregados com sucesso.",
    });
  };

  // Handlers de filtros
  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const handlePriorityFilterChange = (value: string) => {
    setPriorityFilter(value);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
  };

  const handleClearFilters = () => {
    setSearchValue("");
    setPriorityFilter("all");
    setStatusFilter("all");
    setSortBy("priority");
  };

  // Filtragem e ordenação
  const filteredTarefas = tarefaService.filterTarefas(tarefas, {
    search: searchValue,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const sortedTarefas = tarefaService.sortTarefas(filteredTarefas, sortBy as any);

  // Estatísticas
  const stats = tarefaService.calculateStats(tarefas);

  // Contagem de filtros ativos
  const activeFiltersCount = [
    searchValue !== "",
    priorityFilter !== "all",
    statusFilter !== "all"
  ].filter(Boolean).length;

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-12 overflow-x-hidden entry-animate">
      {/* Page Header Moderno */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Calendar className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 drop-shadow-sm">
              Tarefas e Gamificação
            </h1>
          </div>
          <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl">
            Pratique a alta performance, conquiste pontos e mantenha seu fluxo de trabalho impecável.
          </p>
        </div>
        
        <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5">
          <Button 
            onClick={handleNewTarefa}
            size="lg"
            className="rounded-xl shadow-premium h-12 px-8 font-black uppercase text-xs tracking-widest bg-primary hover:bg-primary/90"
          >
            <Plus className="mr-2 h-5 w-5" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Grid de Estatísticas / Gamificação */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-3xl shadow-premium border border-black/5 dark:border-white/10 bg-card hover-lift group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Target className="h-20 w-20" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Total de Pontos</p>
          <p className="text-4xl font-black text-foreground group-hover:text-primary transition-colors tracking-tighter">2.450</p>
          <p className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full mt-2 inline-block uppercase tracking-widest">Nível: Master</p>
        </div>
        
        <div className="glass-card p-6 rounded-3xl shadow-premium border border-black/5 dark:border-white/10 bg-card hover-lift group">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Concluídas Hoje</p>
          <p className="text-4xl font-black text-foreground tracking-tighter">{stats.completed ?? 0}</p>
          <p className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full mt-2 inline-block uppercase tracking-widest">+{(stats.completed ?? 0) * 50} pontos</p>
        </div>

        <div className="md:col-span-2 glass-card p-6 rounded-3xl overflow-hidden relative border border-primary/20 bg-primary/[0.02] dark:bg-primary/5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-1">Missão Semanal</p>
              <h3 className="text-xl font-black tracking-tight">Finalizar 15 Prazos</h3>
            </div>
            <Badge className="bg-primary hover:bg-primary py-1.5 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20">500 XP</Badge>
          </div>
          <div className="space-y-3 pt-2">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary">
              <span>Progresso da Missão</span>
              <span>12 / 15</span>
            </div>
            <div className="w-full h-3 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary/60 w-[80%] rounded-full shadow-[0_0_15px_rgba(var(--primary),0.3)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="glass-card rounded-[2.5rem] shadow-premium border border-black/5 dark:border-white/10 overflow-hidden bg-card/40 backdrop-blur-xl">
        <div className="p-8 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/2 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <h3 className="text-2xl font-black tracking-tight">Lista de Afazeres</h3>
            <TarefasFilters
              searchValue={searchValue}
              priorityFilter={priorityFilter}
              statusFilter={statusFilter}
              sortBy={sortBy}
              onSearchChange={handleSearchChange}
              onPriorityFilterChange={handlePriorityFilterChange}
              onStatusFilterChange={handleStatusFilterChange}
              onSortChange={handleSortChange}
              onClearFilters={handleClearFilters}
              activeFiltersCount={activeFiltersCount}
            />
          </div>
        </div>

        {tarefas.length === 0 ? (
          <TarefasEmptyState
            onNewTarefa={handleNewTarefa}
            onLoadSampleData={handleLoadSampleData}
          />
        ) : (
          <div className="p-4 md:p-8">
            {sortedTarefas.length === 0 ? (
              <TarefasEmptyState
                onNewTarefa={handleNewTarefa}
                onLoadSampleData={handleLoadSampleData}
                isFiltered={true}
                onClearFilters={handleClearFilters}
              />
            ) : (
              <div className="space-y-6">
                {/* Controles de seleção premium */}
                <div className="flex items-center justify-between p-6 bg-black/[0.03] dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5 shadow-inner">
                  <div className="flex items-center gap-6">
                    <Checkbox
                      checked={multiSelect.isAllSelected}
                      onCheckedChange={() => 
                        multiSelect.isAllSelected ? multiSelect.clearSelection() : multiSelect.selectAll()
                      }
                      className="h-6 w-6 border-2 border-black/10 dark:border-white/20 rounded-lg data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all shadow-sm"
                    />
                    <span className="text-xs font-black text-muted-foreground/60 uppercase tracking-widest">
                      {multiSelect.selectedCount > 0 ? (
                        <span className="text-primary font-black">{multiSelect.selectedCount} tarefas selecionadas</span>
                      ) : (
                        "Selecionar todas as tarefas"
                      )}
                    </span>
                  </div>
                  {multiSelect.selectedCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={multiSelect.clearSelection}
                      className="font-black text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-500/10 rounded-xl h-10 px-4"
                    >
                      Limpar seleção
                    </Button>
                  )}
                </div>

                <TarefasList
                  tarefas={sortedTarefas}
                  selectedIds={multiSelect.getSelectedItems().map(item => item.id)}
                  completedIds={completedTasks}
                  onToggleSelect={multiSelect.toggleItem}
                  onToggleComplete={handleToggleComplete}
                  onDelete={handleDeleteTarefa}
                  getPriorityColor={tarefaService.getPriorityColor}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de confirmação de exclusão em lote */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Excluir Tarefas"
        description={`Tem certeza que deseja excluir ${multiSelect.selectedCount} tarefa(s)? Apenas tarefas concluídas podem ser excluídas.`}
        isLoading={isDeleting}
      />

      {/* Modal de confirmação de exclusão individual */}
      <DeleteConfirmDialog
        open={deleteIndividualDialogOpen}
        onOpenChange={setDeleteIndividualDialogOpen}
        onConfirm={handleConfirmDeleteIndividual}
        title="Excluir Tarefa"
        description="Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita."
        isLoading={isDeleting}
      />

      {/* Modal de nova tarefa */}
      <NovaTarefaDialog
        open={novaTarefaDialogOpen}
        onOpenChange={setNovaTarefaDialogOpen}
        onAddTarefa={handleAddTarefa}
      />
    </div>
  );
};

export default Tarefas;
