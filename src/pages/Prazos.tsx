import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, AlertCircle, Clock, Calendar, Search, Filter, Eye } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NovoPrazoStandaloneDialog } from "@/components/Processos/NovoPrazoStandaloneDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Prazos = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch prazos from database
  const { data: prazos = [], refetch } = useQuery({
    queryKey: ['prazos', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('prazos')
        .select('*')
        .eq('user_id', user.id)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Filter prazos based on search and filters
  const filteredPrazos = prazos.filter(prazo => {
    const matchesSearch = prazo.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prazo.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || prazo.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || prazo.prioridade === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta': return 'bg-red-500';
      case 'media': return 'bg-yellow-500';
      case 'baixa': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string, dataVencimento: string) => {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    
    if (status === 'concluido') return 'bg-green-100 text-green-800';
    if (vencimento < hoje) return 'bg-red-100 text-red-800';
    if (vencimento.getTime() - hoje.getTime() <= 3 * 24 * 60 * 60 * 1000) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getDaysUntilDeadline = (dataVencimento: string) => {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diffTime = vencimento.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `Vencido há ${Math.abs(diffDays)} dia(s)`;
    if (diffDays === 0) return 'Vence hoje';
    if (diffDays === 1) return 'Vence amanhã';
    return `${diffDays} dias restantes`;
  };

  const categorizedPrazos = {
    vencidos: filteredPrazos.filter(p => new Date(p.data_vencimento) < new Date() && p.status !== 'concluido'),
    hoje: filteredPrazos.filter(p => {
      const hoje = new Date();
      const vencimento = new Date(p.data_vencimento);
      return vencimento.toDateString() === hoje.toDateString() && p.status !== 'concluido';
    }),
    proximosSete: filteredPrazos.filter(p => {
      const hoje = new Date();
      const vencimento = new Date(p.data_vencimento);
      const diffTime = vencimento.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= 7 && p.status !== 'concluido';
    }),
    futuros: filteredPrazos.filter(p => {
      const hoje = new Date();
      const vencimento = new Date(p.data_vencimento);
      const diffTime = vencimento.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 7 && p.status !== 'concluido';
    }),
    concluidos: filteredPrazos.filter(p => p.status === 'concluido'),
  };

  const handleSuccess = () => {
    refetch();
    toast({
      title: "Prazo adicionado com sucesso",
      description: "O prazo foi salvo e está sendo monitorado.",
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prazos</h1>
          <p className="text-muted-foreground">
            Gerencie e monitore todos os seus prazos judiciais
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Prazo
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar prazos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Prioridades</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Prazos Tabs */}
      <Tabs defaultValue="vencidos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="vencidos" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Vencidos</span>
            <span className="sm:hidden">Venc.</span>
            <Badge variant="destructive" className="ml-1">
              {categorizedPrazos.vencidos.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="hoje" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Hoje</span>
            <Badge variant="secondary" className="ml-1">
              {categorizedPrazos.hoje.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="proximosSete" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">7 Dias</span>
            <Badge variant="secondary" className="ml-1">
              {categorizedPrazos.proximosSete.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="futuros" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Futuros</span>
            <Badge variant="secondary" className="ml-1">
              {categorizedPrazos.futuros.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="concluidos" className="flex items-center gap-2">
            <span className="hidden sm:inline">Concluídos</span>
            <span className="sm:hidden">Concl.</span>
            <Badge variant="outline" className="ml-1">
              {categorizedPrazos.concluidos.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Render prazos for each category */}
        {Object.entries(categorizedPrazos).map(([category, prazosData]) => (
          <TabsContent key={category} value={category} className="space-y-4">
            {prazosData.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum prazo encontrado nesta categoria</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {prazosData.map((prazo) => (
                  <Card key={prazo.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{prazo.titulo}</CardTitle>
                          <CardDescription className="mt-1">
                            {prazo.descricao}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getPriorityColor(prazo.prioridade)}`} />
                          <Badge 
                            variant="secondary" 
                            className={getStatusColor(prazo.status, prazo.data_vencimento)}
                          >
                            {prazo.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {format(new Date(prazo.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{getDaysUntilDeadline(prazo.data_vencimento)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs">Prioridade:</span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {prazo.prioridade}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* New Prazo Dialog */}
      <NovoPrazoStandaloneDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default Prazos;
