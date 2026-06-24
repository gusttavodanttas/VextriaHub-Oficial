import { useState, useEffect } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useExclusoesPendentes } from "@/hooks/useExclusoesPendentes";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useUserRole } from "@/hooks/useUserRole";
import { useOfficeManagement } from "@/hooks/useOfficeManagement";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { Shield, Check, X, Clock, User, FileText, AlertCircle, Building2, CreditCard, Users, TrendingUp, Activity } from "lucide-react";
import { OfficeControlPanel } from "@/components/SuperAdmin/OfficeControlPanel";
import { SubscriptionControlPanel } from "@/components/SuperAdmin/SubscriptionControlPanel";
import { GlobalMetrics } from "@/components/Admin/GlobalMetrics";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const getTabelaDisplayName = (tabela: string) => {
  const nomes: Record<string, string> = {
    clientes: 'Cliente',
    processos: 'Processo',
    audiencias: 'Audiência',
    prazos: 'Prazo',
    tarefas: 'Tarefa',
    atendimentos: 'Atendimento',
    metas: 'Meta',
    financeiro: 'Financeiro',
  };
  return nomes[tabela] || tabela;
};

const getTabelaIcon = (tabela: string) => {
  const icones: Record<string, any> = {
    clientes: User,
    processos: FileText,
    audiencias: Clock,
    prazos: AlertCircle,
    tarefas: Check,
    atendimentos: User,
    metas: FileText,
    financeiro: FileText,
  };
  return icones[tabela] || FileText;
};

import { useSearchParams } from "react-router-dom";

const Admin = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || "dashboard";
  const [activeTab, setActiveTab] = useState(initialTab);
  const { canViewAdminFeatures, isSuperAdmin, isLoading: authLoading } = useUserRole();
  const { user } = useAuth();
  
  const isMainSuperAdmin = user?.email?.toLowerCase().trim() === 'contato@vextriahub.com.br';

  // Sync activeTab when URL changes (from sidebar clicks)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTab]);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };
  
  const {
    data: exclusoesPendentes,
    loading: requestsLoading,
    aprovarExclusao,
    rejeitarExclusao,
    aprovarMultiplasExclusoes,
    canManage,
    isEmpty
  } = useExclusoesPendentes();

  const multiSelect = useMultiSelect(exclusoesPendentes);
  const [processando, setProcessando] = useState<string | null>(null);

  const handleAprovar = async (id: string) => {
    setProcessando(id);
    await aprovarExclusao(id);
    setProcessando(null);
  };

  const handleRejeitar = async (id: string) => {
    setProcessando(id);
    await rejeitarExclusao(id);
    setProcessando(null);
  };

  const handleAprovarSelecionados = async () => {
    const selectedIds = multiSelect.getSelectedItems().map(item => item.id);
    setProcessando('multiplo');
    await aprovarMultiplasExclusoes(selectedIds);
    multiSelect.clearSelection();
    setProcessando(null);
  };

  if (authLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!canViewAdminFeatures) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Acesso Negado</h3>
            <p className="text-muted-foreground">
              Você precisa ser um administrador para acessar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 overflow-x-hidden entry-animate fade-in duration-700">
      <div className="w-full">
        {isMainSuperAdmin ? (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            {/* TabsList removido — navegação feita pelo sidebar */}

            <TabsContent value="dashboard" className="entry-animate slide-in-from-bottom-4 duration-500 mt-0">
              <GlobalMetrics />
            </TabsContent>

            <TabsContent value="offices" className="entry-animate slide-in-from-bottom-4 duration-500 mt-0">
              <OfficeControlPanel />
            </TabsContent>

            <TabsContent value="subscriptions" className="entry-animate slide-in-from-bottom-4 duration-500 mt-0">
              <SubscriptionControlPanel />
            </TabsContent>

            <TabsContent value="requests" className="space-y-6 entry-animate slide-in-from-bottom-4 duration-500 mt-0">
            {/* Stats Rápido */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 rounded-[2rem] shadow-premium border border-black/5 dark:border-white/10 hover-lift group">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Pendentes</p>
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                </div>
                <p className="text-4xl font-black text-amber-500">{exclusoesPendentes.length}</p>
              </div>

              <div className="glass-card p-6 rounded-[2rem] shadow-premium border border-black/5 dark:border-white/10 hover-lift group">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Selecionadas</p>
                  <Check className="h-5 w-5 text-primary" />
                </div>
                <p className="text-4xl font-black text-foreground">{multiSelect.selectedCount}</p>
              </div>

              <div className="glass-card p-6 rounded-[2rem] shadow-premium border border-black/5 dark:border-white/10 hover-lift group">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Categorias</p>
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-4xl font-black text-emerald-500">{new Set(exclusoesPendentes.map(e => e.tabela)).size}</p>
              </div>
            </div>

            {!multiSelect.isNoneSelected && (
              <div className="glass-card p-6 rounded-3xl bg-primary/5 border-primary/20 flex flex-col md:flex-row items-center justify-between gap-6 entry-animate fade-in zoom-in duration-300">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary rounded-2xl shadow-premium">
                    <Shield className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-extrabold">{multiSelect.selectedCount} Solicitações Selecionadas</p>
                    <p className="text-sm font-medium opacity-70">Ações em massa para otimização de fluxo.</p>
                  </div>
                </div>
                <Button 
                  onClick={handleAprovarSelecionados}
                  size="lg"
                  className="rounded-2xl h-14 px-10 text-lg font-bold shadow-premium bg-primary hover:bg-primary/90"
                >
                  <Check className="mr-2 h-6 w-6" />
                  Aprovar Massa
                </Button>
              </div>
            )}

                  {requestsLoading && (
                    <Card>
                      <CardContent className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Carregando solicitações...</p>
                      </CardContent>
                    </Card>
                  )}

                  {isEmpty && !requestsLoading && (
                    <Card>
                      <CardContent className="text-center py-12">
                        <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Nenhuma solicitação pendente</h3>
                        <p className="text-muted-foreground">
                          Todas as solicitações de exclusão foram processadas.
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Selection Controls */}
                  {exclusoesPendentes.length > 0 && (
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-4">
                        <Checkbox
                          checked={multiSelect.isAllSelected}
                          onCheckedChange={() => 
                            multiSelect.isAllSelected ? multiSelect.clearSelection() : multiSelect.selectAll()
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          {multiSelect.selectedCount > 0 ? (
                            `${multiSelect.selectedCount} de ${exclusoesPendentes.length} selecionado(s)`
                          ) : (
                            "Selecionar todos"
                          )}
                        </span>
                      </div>
                      {multiSelect.selectedCount > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={multiSelect.clearSelection}
                        >
                          Limpar seleção
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Exclusões Pendentes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {exclusoesPendentes.map((exclusao) => {
                      const TabelaIcon = getTabelaIcon(exclusao.tabela);
                      const dadosRegistro = exclusao.dados_registro as any;
                      
                      return (
                        <Card 
                          key={exclusao.id}
                          className={`glass-card rounded-[2rem] border-black/5 dark:border-white/5 transition-all duration-500 overflow-hidden hover-lift ${
                            multiSelect.isSelected(exclusao.id) ? "ring-2 ring-primary bg-primary/[0.02]" : ""
                          }`}
                        >
                          <CardHeader className="pb-3 px-6 pt-6">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-4">
                                <div className="relative flex items-center justify-center">
                                  <Checkbox
                                    checked={multiSelect.isSelected(exclusao.id)}
                                    onCheckedChange={() => multiSelect.toggleItem(exclusao.id)}
                                    className="rounded-lg h-5 w-5 border-black/10 dark:border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                  />
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shadow-inner">
                                    <TabelaIcon className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <CardTitle className="text-lg font-black tracking-tight">
                                      {getTabelaDisplayName(exclusao.tabela)}
                                    </CardTitle>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                                      {format(new Date(exclusao.solicitado_em), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-black text-[10px] uppercase tracking-widest px-3 py-1 rounded-xl">
                                Pendente
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="p-6 pt-2 space-y-5">
                            {/* Informações do registro */}
                            <div className="p-5 bg-black/[0.03] dark:bg-white/[0.03] rounded-3xl border border-black/5 dark:border-white/5 shadow-inner">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 opacity-60">Dados do Registro</h4>
                              <div className="grid grid-cols-1 gap-2 text-sm font-bold text-foreground/80">
                                {dadosRegistro.nome && (
                                  <div className="flex items-center justify-between py-1 border-b border-black/5 dark:border-white/5">
                                    <span className="text-muted-foreground font-medium">Nome:</span>
                                    <span>{dadosRegistro.nome}</span>
                                  </div>
                                )}
                                {dadosRegistro.titulo && (
                                  <div className="flex items-center justify-between py-1 border-b border-black/5 dark:border-white/5">
                                    <span className="text-muted-foreground font-medium">Título:</span>
                                    <span>{dadosRegistro.titulo}</span>
                                  </div>
                                )}
                                {dadosRegistro.numero_processo && (
                                  <div className="flex items-center justify-between py-1 border-b border-black/5 dark:border-white/5">
                                    <span className="text-muted-foreground font-medium">Nº Processo:</span>
                                    <span className="font-mono">{dadosRegistro.numero_processo}</span>
                                  </div>
                                )}
                                {dadosRegistro.email && (
                                  <div className="flex items-center justify-between py-1 border-b border-black/5 dark:border-white/5">
                                    <span className="text-muted-foreground font-medium">Email:</span>
                                    <span className="text-primary">{dadosRegistro.email}</span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between py-1">
                                  <span className="text-muted-foreground font-medium">Status Atual:</span>
                                  <Badge variant="outline" className="rounded-lg font-black text-[9px] uppercase">{dadosRegistro.status || 'N/A'}</Badge>
                                </div>
                              </div>
                            </div>

                            {/* Informações da solicitação */}
                            <div className="space-y-4 pt-2">
                              <div className="flex items-center gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/10">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                  <User className="h-4 w-4 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">Solicitado por</p>
                                  <p className="text-xs font-black truncate">
                                    {(exclusao as any).user?.full_name || (exclusao as any).user?.email || 'Usuário desconhecido'}
                                  </p>
                                </div>
                              </div>

                              {exclusao.motivo && (
                                <div className="px-4 py-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/10 italic text-xs text-muted-foreground leading-relaxed">
                                  "{exclusao.motivo}"
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 gap-3 pt-2">
                                <Button
                                  variant="outline"
                                  size="lg"
                                  onClick={() => handleRejeitar(exclusao.id)}
                                  disabled={processando === exclusao.id}
                                  className="rounded-2xl h-12 font-black uppercase text-[10px] tracking-widest border-black/5 dark:border-white/10 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Rejeitar
                                </Button>
                                <Button
                                  size="lg"
                                  onClick={() => handleAprovar(exclusao.id)}
                                  disabled={processando === exclusao.id}
                                  className="rounded-2xl h-12 font-black uppercase text-[10px] tracking-widest shadow-premium bg-primary hover:bg-primary/90 transition-all"
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  Aprovar
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              // Non-super admin view (existing deletion requests view)
              <div className="space-y-8 animate-in fade-in duration-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight">Solicitações de Exclusão</h2>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Gerencie os pedidos de remoção de dados do seu escritório.</p>
                  </div>
                  {!multiSelect.isNoneSelected && (
                    <Button
                      onClick={handleAprovarSelecionados}
                      disabled={processando === 'multiplo'}
                      size="lg"
                      className="rounded-2xl h-14 px-8 font-black uppercase text-xs tracking-widest shadow-premium bg-primary hover:bg-primary/90 transition-all"
                    >
                      <Check className="h-5 w-5 mr-2" />
                      Aprovar Selecionados ({multiSelect.selectedCount})
                    </Button>
                  )}
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-card p-6 rounded-[2rem] shadow-premium border border-black/5 dark:border-white/10 hover-lift group">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Pendentes</p>
                      <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-primary">{exclusoesPendentes.length}</p>
                  </div>

                  <div className="glass-card p-6 rounded-[2rem] shadow-premium border border-black/5 dark:border-white/10 hover-lift group">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Selecionadas</p>
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                        <Check className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-amber-500">{multiSelect.selectedCount}</p>
                  </div>

                  <div className="glass-card p-6 rounded-[2rem] shadow-premium border border-black/5 dark:border-white/10 hover-lift group">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Categorias</p>
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                        <Activity className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-emerald-500">{new Set(exclusoesPendentes.map(e => e.tabela)).size}</p>
                  </div>
                </div>

                {/* Exclusões Pendentes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {exclusoesPendentes.map((exclusao) => {
                    const TabelaIcon = getTabelaIcon(exclusao.tabela);
                    const dadosRegistro = exclusao.dados_registro as any;
                    
                    return (
                      <Card 
                        key={exclusao.id}
                        className={`glass-card rounded-[2.5rem] border-black/5 dark:border-white/5 transition-all duration-500 overflow-hidden hover-lift ${
                          multiSelect.isSelected(exclusao.id) ? "ring-2 ring-primary bg-primary/[0.02]" : ""
                        }`}
                      >
                        <CardHeader className="pb-3 px-8 pt-8">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <Checkbox
                                checked={multiSelect.isSelected(exclusao.id)}
                                onCheckedChange={() => multiSelect.toggleItem(exclusao.id)}
                                className="rounded-lg h-6 w-6 border-black/10 dark:border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <div className="flex items-center gap-3">
                                <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-inner">
                                  <TabelaIcon className="h-6 w-6" />
                                </div>
                                <div>
                                  <CardTitle className="text-xl font-black tracking-tight">
                                    {getTabelaDisplayName(exclusao.tabela)}
                                  </CardTitle>
                                  <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                                    {format(new Date(exclusao.solicitado_em), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-xl">
                              Pendente
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-8 pt-4 space-y-6">
                          {/* Informações do registro */}
                          <div className="p-6 bg-black/[0.03] dark:bg-white/[0.03] rounded-[2rem] border border-black/5 dark:border-white/5 shadow-inner">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 opacity-60">Dados do Registro</h4>
                            <div className="grid grid-cols-1 gap-3 text-sm font-bold text-foreground/80">
                              {dadosRegistro.nome && (
                                <div className="flex items-center justify-between py-2 border-b border-black/5 dark:border-white/5">
                                  <span className="text-muted-foreground font-medium">Nome:</span>
                                  <span>{dadosRegistro.nome}</span>
                                </div>
                              )}
                              {dadosRegistro.titulo && (
                                <div className="flex items-center justify-between py-2 border-b border-black/5 dark:border-white/5">
                                  <span className="text-muted-foreground font-medium">Título:</span>
                                  <span>{dadosRegistro.titulo}</span>
                                </div>
                              )}
                              {dadosRegistro.numero_processo && (
                                <div className="flex items-center justify-between py-2 border-b border-black/5 dark:border-white/5">
                                  <span className="text-muted-foreground font-medium">Nº Processo:</span>
                                  <span className="font-mono text-primary">{dadosRegistro.numero_processo}</span>
                                </div>
                              )}
                              {dadosRegistro.email && (
                                <div className="flex items-center justify-between py-2 border-b border-black/5 dark:border-white/5">
                                  <span className="text-muted-foreground font-medium">Email:</span>
                                  <span className="text-blue-500">{dadosRegistro.email}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between py-2">
                                <span className="text-muted-foreground font-medium">Status Atual:</span>
                                <Badge variant="outline" className="rounded-lg font-black text-[10px] uppercase px-3">{dadosRegistro.status || 'N/A'}</Badge>
                              </div>
                            </div>
                          </div>

                          {/* Informações da solicitação */}
                          <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 rounded-3xl bg-primary/5 border border-primary/10">
                              <div className="p-2.5 bg-primary/10 rounded-2xl">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Solicitado por</p>
                                <p className="text-sm font-black truncate">
                                  {(exclusao as any).user?.full_name || (exclusao as any).user?.email || 'Usuário desconhecido'}
                                </p>
                              </div>
                            </div>

                            {exclusao.motivo && (
                              <div className="px-5 py-4 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/10 italic text-sm text-muted-foreground leading-relaxed">
                                "{exclusao.motivo}"
                              </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4 pt-2">
                              <Button
                                variant="outline"
                                size="lg"
                                onClick={() => handleRejeitar(exclusao.id)}
                                disabled={processando === exclusao.id}
                                className="rounded-[1.5rem] h-14 font-black uppercase text-xs tracking-widest border-black/5 dark:border-white/10 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all"
                              >
                                <X className="h-5 w-5 mr-2" />
                                Rejeitar
                              </Button>
                              <Button
                                size="lg"
                                onClick={() => handleAprovar(exclusao.id)}
                                disabled={processando === exclusao.id}
                                className="rounded-[1.5rem] h-14 font-black uppercase text-xs tracking-widest shadow-premium bg-primary hover:bg-primary/90 transition-all"
                              >
                                <Check className="h-5 w-5 mr-2" />
                                Aprovar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
      </div>
    </div>
  );
};

export default Admin;
