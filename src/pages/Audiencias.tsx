
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, MapPin, User, Users, FileText, Plus, Search, Filter, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { NovaAudienciaDialog } from "@/components/Audiencias/NovaAudienciaDialog";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { getInitialData } from "@/utils/initialData";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";


const Audiencias = () => {
  const { isFirstLogin } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todas");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const mockAudienciasData: any[] = [];

  const [audiencias, setAudiencias] = useState(mockAudienciasData);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "agendada": return "border-blue-500/50 text-blue-500 bg-blue-500/10 font-bold";
      case "confirmada": return "border-emerald-500/50 text-emerald-500 bg-emerald-500/10 font-bold";
      case "pendente": return "border-yellow-500/50 text-yellow-500 bg-yellow-500/10 font-bold";
      case "realizada": return "border-muted/30 text-muted-foreground bg-muted/10";
      case "cancelada": return "border-red-500/50 text-red-500 bg-red-500/10 font-bold";
      default: return "border-muted/30 text-muted-foreground bg-muted/10";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "agendada": return "Agendada";
      case "confirmada": return "Confirmada";
      case "pendente": return "Pendente";
      case "realizada": return "Realizada";
      case "cancelada": return "Cancelada";
      default: return status;
    }
  };

  const filteredAudiencias = audiencias.filter(audiencia => {
    const matchesSearch = audiencia.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         audiencia.cliente.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "todas" || audiencia.status === statusFilter;
    const matchesTipo = tipoFilter === "todos" || audiencia.tipo === tipoFilter;
    
    return matchesSearch && matchesStatus && matchesTipo;
  });

  const multiSelect = useMultiSelect(filteredAudiencias);

  const handleAddAudiencia = (novaAudiencia: any) => {
    const audienciaComId = {
      ...novaAudiencia,
      id: Date.now()
    };
    setAudiencias(prev => [audienciaComId, ...prev]);
  };

  const handleDeleteSelected = () => {
    const selectedItems = multiSelect.getSelectedItems();
    if (selectedItems.length === 0) {
      toast({
        title: "Nenhuma audiência selecionada",
        description: "Selecione pelo menos uma audiência para excluir.",
        variant: "destructive"
      });
      return;
    }
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const selectedIds = multiSelect.getSelectedItems().map(item => item.id);
    setAudiencias(prev => prev.filter(audiencia => !selectedIds.includes(audiencia.id)));
    
    toast({
      title: "Audiências excluídas",
      description: `${multiSelect.selectedCount} audiência(s) foram excluídas com sucesso.`,
    });
    
    multiSelect.clearSelection();
    setDeleteDialogOpen(false);
    setIsDeleting(false);
  };

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-10 overflow-x-hidden entry-animate">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Users className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-foreground">
              Audiências
            </h1>
          </div>
          <p className="text-sm md:text-lg text-muted-foreground font-medium">
            Gerencie seus compromissos judiciais e sustentações orais.
          </p>
        </div>
        <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 shadow-premium">
          {!multiSelect.isNoneSelected && (
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              className="rounded-xl h-12 px-6 font-black uppercase text-xs tracking-widest shadow-lg shadow-red-500/20"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir ({multiSelect.selectedCount})
            </Button>
          )}
          <NovaAudienciaDialog onAddAudiencia={handleAddAudiencia} />
        </div>
      </div>

      {/* Filtros */}
      <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-[2rem] overflow-hidden shadow-premium">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
              <Input
                placeholder="Buscar por título ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 bg-black/[0.02] dark:bg-muted/20 border-black/5 dark:border-white/5 rounded-xl font-medium"
              />
            </div>
            <div className="flex gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-44 h-12 bg-black/[0.02] dark:bg-muted/20 border-black/5 dark:border-white/5 rounded-xl font-bold">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="todas">Todos Status</SelectItem>
                  <SelectItem value="agendada">Agendada</SelectItem>
                  <SelectItem value="confirmada">Confirmada</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="realizada">Realizada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-full md:w-44 h-12 bg-black/[0.02] dark:bg-muted/20 border-black/5 dark:border-white/5 rounded-xl font-bold">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="todos">Todos Tipos</SelectItem>
                  <SelectItem value="Trabalhista">Trabalhista</SelectItem>
                  <SelectItem value="Família">Família</SelectItem>
                  <SelectItem value="Previdenciário">Previdenciário</SelectItem>
                  <SelectItem value="Cível">Cível</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="lista" className="space-y-8">
        <div className="glass-card p-2 rounded-3xl inline-flex h-auto border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 shadow-inner">
          <TabsList className="bg-transparent h-auto p-0 gap-1">
            <TabsTrigger value="lista" className="rounded-2xl px-10 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg shadow-primary/20 transition-all">
              Lista
            </TabsTrigger>
            <TabsTrigger value="calendario" className="rounded-2xl px-10 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg shadow-primary/20 transition-all">
              Calendário
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="lista" className="space-y-6">
          {/* Selection Controls */}
          {filteredAudiencias.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/10 rounded-2xl">
              <div className="flex items-center gap-4">
                <Checkbox
                  checked={multiSelect.isAllSelected}
                  onCheckedChange={() => 
                    multiSelect.isAllSelected ? multiSelect.clearSelection() : multiSelect.selectAll()
                  }
                  className="rounded-md h-5 w-5"
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {multiSelect.selectedCount > 0 ? (
                    `${multiSelect.selectedCount} de ${filteredAudiencias.length} selecionada(s)`
                  ) : (
                    "Selecionar todas"
                  )}
                </span>
              </div>
              {multiSelect.selectedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={multiSelect.clearSelection}
                  className="h-8 rounded-lg font-black uppercase text-[10px] tracking-widest text-primary hover:bg-primary/10"
                >
                  Limpar seleção
                </Button>
              )}
            </div>
          )}

          <div className="grid gap-6">
            {filteredAudiencias.map((audiencia) => (
              <Card key={audiencia.id} className={`group hover-lift rounded-[2rem] border border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl shadow-premium transition-all duration-300 ${
                multiSelect.isSelected(audiencia.id) ? "ring-2 ring-primary bg-primary/[0.02]" : ""
              }`}>
                <CardContent className="p-8">
                  <div className="flex flex-col lg:flex-row gap-8">
                    <div className="flex items-start gap-6 flex-1">
                      <Checkbox
                        checked={multiSelect.isSelected(audiencia.id)}
                        onCheckedChange={() => multiSelect.toggleItem(audiencia.id)}
                        className="rounded-md h-6 w-6 mt-1"
                      />
                      <div className="flex-1 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <h3 className="font-black text-2xl tracking-tight group-hover:text-primary transition-colors">{audiencia.titulo}</h3>
                          <Badge className={cn("px-6 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm", getStatusColor(audiencia.status))}>
                            {getStatusText(audiencia.status)}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          <div className="flex items-center gap-3 bg-black/[0.03] dark:bg-white/5 p-3 rounded-2xl border border-black/5 dark:border-white/10">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span className="text-[11px] font-black uppercase tracking-widest opacity-70">
                              {format(new Date(audiencia.data), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 bg-black/[0.03] dark:bg-white/5 p-3 rounded-2xl border border-black/5 dark:border-white/10">
                            <Clock className="h-4 w-4 text-primary" />
                            <span className="text-[11px] font-black uppercase tracking-widest opacity-70">{audiencia.hora}</span>
                          </div>
                          <div className="flex items-center gap-3 bg-black/[0.03] dark:bg-white/5 p-3 rounded-2xl border border-black/5 dark:border-white/10">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span className="text-[11px] font-black uppercase tracking-widest opacity-70 truncate">{audiencia.local}</span>
                          </div>
                          <div className="flex items-center gap-3 bg-black/[0.03] dark:bg-white/5 p-3 rounded-2xl border border-black/5 dark:border-white/10">
                            <User className="h-4 w-4 text-primary" />
                            <span className="text-[11px] font-black uppercase tracking-widest opacity-70 truncate">{audiencia.cliente}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5">
                          <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 font-black uppercase text-[10px] tracking-widest rounded-xl px-4 py-1">
                            {audiencia.tipo}
                          </Badge>
                          {audiencia.observacao && (
                            <p className="text-xs text-muted-foreground font-medium italic opacity-60">
                              "{audiencia.observacao}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex lg:flex-col gap-3 min-w-[140px]">
                      <Button className="rounded-xl h-11 font-black uppercase text-[10px] tracking-widest bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                        <FileText className="h-4 w-4 mr-2" />
                        Detalhes
                      </Button>
                      <Button variant="outline" className="rounded-xl h-11 font-black uppercase text-[10px] tracking-widest border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5">
                        Editar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="calendario" className="space-y-6">
          <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-[2.5rem] overflow-hidden shadow-premium">
            <CardHeader className="p-8">
              <CardTitle className="text-2xl font-black tracking-tight">Calendário de Audiências</CardTitle>
              <CardDescription className="font-medium text-muted-foreground">
                Visualização mensal das suas audiências agendadas
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <div className="text-center text-muted-foreground py-20 bg-black/[0.01] dark:bg-white/[0.01] rounded-[2rem] border border-dashed border-black/10 dark:border-white/10">
                <Calendar className="h-16 w-16 mx-auto mb-6 opacity-10" />
                <p className="font-black uppercase tracking-widest text-xs mb-2">Calendário em desenvolvimento</p>
                <p className="text-sm font-medium opacity-60">Em breve você poderá visualizar suas audiências em formato de calendário</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

            <DeleteConfirmDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              onConfirm={handleConfirmDelete}
              title="Excluir Audiências"
              description={`Tem certeza que deseja excluir ${multiSelect.selectedCount} audiência(s)? Esta ação não pode ser desfeita.`}
              isLoading={isDeleting}
            />
    </div>
  );
};

export default Audiencias;
