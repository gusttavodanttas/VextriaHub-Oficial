
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Plus, Edit, Trash2 } from "lucide-react";
import { DemandGoalsConfig } from "@/components/Goals/DemandGoalsConfig";
import { CreateGoalDialog } from "@/components/Goals/CreateGoalDialog";
import { useToast } from "@/hooks/use-toast";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";

const Metas = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("individuais");
  const [createGoalOpen, setCreateGoalOpen] = useState(false);
  const [metas, setMetas] = useState([
    {
      id: 1,
      titulo: "Meta de Receita Mensal",
      tipo: "receita",
      periodo: "mensal",
      valorMeta: 15000,
      valorAtual: 8500,
      status: "ativa",
      dataInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      dataFim: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    },
    {
      id: 2,
      titulo: "Novos Clientes",
      tipo: "clientes",
      periodo: "mensal",
      valorMeta: 10,
      valorAtual: 6,
      status: "ativa",
      dataInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      dataFim: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    },
    {
      id: 3,
      titulo: "Processos Finalizados",
      tipo: "processos",
      periodo: "mensal",
      valorMeta: 15,
      valorAtual: 12,
      status: "ativa",
      dataInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      dataFim: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    }
  ]);

  const handleCreateGoal = (novaMeta: any) => {
    setMetas([...metas, novaMeta]);
  };

  const handleDeleteGoal = (goalId: number) => {
    setMetas(metas.filter(m => m.id !== goalId));
    toast({
      title: "Meta excluída",
      description: "A meta foi excluída com sucesso.",
    });
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-600";
    if (percentage >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const formatValue = (value: number, tipo: string) => {
    if (tipo === "receita") {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    }
    return value.toString();
  };

  return (
    <PermissionGuard permission="canViewMetas" showDeniedMessage>
    <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-12 overflow-x-hidden entry-animate">
      {/* Page Header Moderno */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Target className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 drop-shadow-sm">
              Metas & Objetivos
            </h1>
          </div>
          <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl">
            Visualize o progresso em tempo real e impulsione a performance do seu escritório.
          </p>
        </div>
        
        <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 shadow-premium">
          <Button 
            onClick={() => setCreateGoalOpen(true)}
            size="lg"
            className="rounded-xl h-12 shadow-premium bg-primary hover:bg-primary/90 font-black uppercase text-xs tracking-widest px-8"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nova Meta
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="glass-card p-2 rounded-3xl inline-flex w-full md:w-auto h-auto border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 shadow-inner">
          <TabsList className="bg-transparent h-auto p-0 flex flex-nowrap gap-1">
            <TabsTrigger value="individuais" className="rounded-2xl px-10 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg shadow-primary/20 transition-all">
              Individuais
            </TabsTrigger>
            <TabsTrigger value="demandas" className="rounded-2xl px-10 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg shadow-primary/20 transition-all">
              Demandas
            </TabsTrigger>
            <TabsTrigger value="escritorio" className="rounded-2xl px-10 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg shadow-primary/20 transition-all">
              Escritório
            </TabsTrigger>
          </TabsList>
        </div>

          <TabsContent value="individuais" className="space-y-8 entry-animate slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-2xl font-black tracking-tight">Suas Metas Pessoais</h3>
            </div>

            <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
              {metas.map((meta) => {
                const percentage = Math.round((meta.valorAtual / meta.valorMeta) * 100);
                
                return (
                  <div key={meta.id} className="glass-card hover-lift p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl shadow-premium group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Target className="h-24 w-24" />
                    </div>
                    
                    <div className="relative z-10 space-y-8">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <h4 className="text-2xl font-black group-hover:text-primary transition-colors duration-500 leading-tight">
                            {meta.titulo}
                          </h4>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-primary/10 text-primary border-primary/20 font-black px-3 py-1 rounded-lg uppercase text-[10px] tracking-widest shadow-sm">
                              {meta.periodo}
                            </Badge>
                            <Badge className="bg-black/[0.03] dark:bg-white/5 text-muted-foreground border-black/5 dark:border-white/5 font-black px-3 py-1 rounded-lg uppercase text-[10px] tracking-widest shadow-sm">
                              {meta.tipo}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl hover:bg-primary/10">
                            <Edit className="h-5 w-5" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => handleDeleteGoal(meta.id)}
                            className="h-10 w-10 rounded-xl hover:bg-red-500/10 hover:text-red-500"
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <div className="space-y-1">
                            <p className="text-5xl font-black tracking-tighter">
                              {formatValue(meta.valorAtual, meta.tipo)}
                            </p>
                            <p className="text-sm font-medium text-muted-foreground opacity-60">
                              Objetivo Final: {formatValue(meta.valorMeta, meta.tipo)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-2xl font-black ${getProgressColor(percentage)}`}>
                              {percentage}%
                            </span>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Proporção</p>
                          </div>
                        </div>

                        <div className="w-full bg-black/5 dark:bg-white/5 rounded-2xl h-4 p-1 border border-black/5 dark:border-white/5 shadow-inner">
                          <div 
                            className="bg-gradient-to-r from-primary to-primary/60 h-full rounded-xl transition-all duration-1000 ease-out shadow-premium relative group-hover:shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          >
                            <div className="absolute top-0 right-0 h-full w-2 bg-white/20 blur-sm rounded-full" />
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-black/5 dark:border-white/5 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">Meta Ativa</span>
                        </div>
                        <div className="bg-primary/5 dark:bg-primary/10 px-4 py-2 rounded-2xl border border-primary/10 dark:border-primary/20">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-0.5">Falta para concluir</p>
                          <p className="font-black text-primary text-lg leading-none">
                            {formatValue(Math.max(meta.valorMeta - meta.valorAtual, 0), meta.tipo)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {metas.length === 0 && (
                <div className="col-span-full py-20 text-center glass-card rounded-[3rem] space-y-6">
                  <div className="p-8 bg-white/5 rounded-full inline-block">
                    <Target className="h-16 w-16 text-muted-foreground/20" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-extrabold">Nenhuma meta ativa</h3>
                    <p className="text-muted-foreground font-medium max-w-sm mx-auto">
                      Comece a transformar sua produtividade criando sua primeira meta estratégica hoje.
                    </p>
                  </div>
                  <Button onClick={() => setCreateGoalOpen(true)} size="lg" className="rounded-2xl h-14 px-10 font-bold shadow-premium">
                    <Plus className="h-6 w-6 mr-2" />
                    Criar Primeira Meta
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="demandas" className="space-y-4">
            <DemandGoalsConfig />
          </TabsContent>

          <TabsContent value="escritorio" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Metas do Escritório
                </CardTitle>
                <CardDescription>
                  Objetivos gerais e indicadores de desempenho
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="font-medium">Indicadores Financeiros</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm">
                          <span>Faturamento Mensal</span>
                          <span>R$ 180.000 / R$ 200.000</span>
                        </div>
                        <Progress value={90} className="mt-1" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm">
                          <span>Margem de Lucro</span>
                          <span>68% / 70%</span>
                        </div>
                        <Progress value={97} className="mt-1" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium">Indicadores Operacionais</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm">
                          <span>Novos Processos</span>
                          <span>45 / 50</span>
                        </div>
                        <Progress value={90} className="mt-1" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm">
                          <span>Satisfação Clientes</span>
                          <span>92% / 95%</span>
                        </div>
                        <Progress value={97} className="mt-1" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <CreateGoalDialog
          open={createGoalOpen}
          onOpenChange={setCreateGoalOpen}
          onSave={handleCreateGoal}
        />
      </div>
    </PermissionGuard>
  );
};

export default Metas;
