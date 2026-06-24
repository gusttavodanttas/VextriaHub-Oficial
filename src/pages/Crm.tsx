import { useState } from "react";
import { UserCheck, Phone, Mail, Building2, Calendar, Filter, Search, Plus, Target, TrendingUp, BarChart3, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NovoLeadDialog } from "@/components/Crm/NovoLeadDialog";
import { getStatusColor } from "@/components/Crm/CrmUtils";
import { useClientes } from "@/hooks/useClientes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Importações dos novos componentes modularizados
import { CrmLeadsList } from "@/components/Crm/CrmLeadsList";
import { CrmConversoes } from "@/components/Crm/CrmConversoes";
import { CrmPipelineVendas } from "@/components/Crm/CrmPipelineVendas";
import { CrmFunilVendas } from "@/components/Crm/CrmFunilVendas";
import { CrmOportunidades } from "@/components/Crm/CrmOportunidades";
import { CrmOportunidadeDetail } from "@/components/Crm/CrmOportunidadeDetail";
import { 
  CrmRelatorios, 
  CrmMetas, 
  CrmEmailMarketing, 
  CrmFollowUp 
} from "@/components/Crm/CrmDashboards";

export default function Crm() {
  const { data: allClientes = [], loading, refresh } = useClientes();
  const [activeTab, setActiveTab] = useState("leads");
  const [currentView, setCurrentView] = useState("main");
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [showNovoLeadDialog, setShowNovoLeadDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const leadsStatuses = ["lead", "quente", "morno", "frio"];
  const conversionStatuses = ["convertido"];
  
  // Apenas leads reais (não convertidos e não clientes diretos)
  const leads = allClientes.filter(c => leadsStatuses.includes(c.status || ""));
  
  // Apenas leads que foram convertidos pelo CRM (exclui clientes cadastrados diretamente)
  const convertedClients = allClientes.filter(c => conversionStatuses.includes(c.status || ""));

  const hotLeadsCount = leads.filter(l => l.status === "quente").length;
  
  // Taxa baseada apenas no universo do CRM
  const crmTotal = leads.length + convertedClients.length;
  const conversionRate = crmTotal > 0 
    ? Math.round((convertedClients.length / crmTotal) * 100) 
    : 0;

  const filteredLeads = leads.filter(l => 
    l.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (l.email && l.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredClients = convertedClients.filter(c => 
    c.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleMenuClick = (view: string) => {
    setCurrentView(view);
    setActiveTab("leads");
  };

  const handleCardClick = (view: string) => {
    setCurrentView(view);
    setActiveTab("leads");
  };

  const handleBackToMain = () => {
    setCurrentView("main");
    setActiveTab("leads");
  };

  const handleOpportunityClick = (opportunity: any) => {
    setSelectedOpportunity(opportunity);
    setCurrentView("opportunity-detail");
  };

  const renderSpecificView = () => {
    switch (currentView) {
      case "leads":
        return <CrmLeadsList onBack={handleBackToMain} tipo="todos" data={leads} refresh={refresh} />;
      case "leads-quentes":
        return <CrmLeadsList onBack={handleBackToMain} tipo="quentes" data={leads.filter(l => l.status === "quente")} refresh={refresh} />;
      case "conversoes":
        return <CrmConversoes onBack={handleBackToMain} />;
      case "receita-potencial":
        return <CrmPipelineVendas onBack={handleBackToMain} data={allClientes} loading={loading} />;
      case "funil-vendas":
        return <CrmFunilVendas onBack={handleBackToMain} data={allClientes} loading={loading} />;
      case "oportunidades":
        return <CrmOportunidades onBack={handleBackToMain} onOpportunityClick={handleOpportunityClick} />;
      case "opportunity-detail":
        return <CrmOportunidadeDetail onBack={() => setCurrentView("oportunidades")} opportunity={selectedOpportunity} />;
      case "relatorios":
        return <CrmRelatorios onBack={handleBackToMain} data={allClientes} loading={loading} />;
      case "metas":
        return <CrmMetas onBack={handleBackToMain} data={allClientes} loading={loading} />;
      case "email-marketing":
        return <CrmEmailMarketing onBack={handleBackToMain} />;
      case "follow-up":
        return <CrmFollowUp onBack={handleBackToMain} />;
      default:
        return null;
    }
  };

  if (currentView !== "main") {
    return (
      <div className="p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {renderSpecificView()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-12 overflow-x-hidden entry-animate">
      {/* Page Header Moderno */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <UserCheck className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 drop-shadow-sm">
              Gestão de Relacionamento
            </h1>
          </div>
          <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl">
            Converta prospecções em contratos e gerencie seu funil de vendas com inteligência.
          </p>
        </div>
        
        <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl shadow-premium">
          <Button 
            onClick={() => setShowNovoLeadDialog(true)}
            size="lg"
            className="rounded-xl h-12 shadow-premium bg-primary hover:bg-primary/90 font-bold px-8"
          >
            <Plus className="h-5 w-5 mr-2" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Navigation Groups Premium */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="glass-card p-2 rounded-2xl flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-xl font-bold px-6 h-11 hover:bg-primary/10 hover:text-primary transition-all">
                Pipeline & Prospecção
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 rounded-2xl border-black/5 dark:border-white/5 bg-background/80 backdrop-blur-2xl p-2">
              <DropdownMenuItem className="rounded-xl p-4 cursor-pointer hover:bg-primary/10 mb-1 transition-all" onSelect={() => handleMenuClick("funil-vendas")}>
                <Target className="h-5 w-5 text-primary mr-4" />
                <div>
                  <p className="font-extrabold text-sm">Funil Estratégico</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Fluxo completo de vendas</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl p-4 cursor-pointer hover:bg-primary/10 transition-all" onSelect={() => handleMenuClick("oportunidades")}>
                <TrendingUp className="h-5 w-5 text-primary mr-4" />
                <div>
                  <p className="font-extrabold text-sm">Oportunidades Ativas</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Gestão de leads qualificados</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="glass-card p-2 rounded-2xl flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-xl font-bold px-6 h-11 hover:bg-primary/10 hover:text-primary transition-all">
                Análises Dinâmicas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 rounded-2xl border-black/5 dark:border-white/5 bg-background/80 backdrop-blur-2xl p-2">
              <DropdownMenuItem className="rounded-xl p-4 cursor-pointer hover:bg-primary/10 mb-1 transition-all" onSelect={() => handleMenuClick("relatorios")}>
                <BarChart3 className="h-5 w-5 text-primary mr-4" />
                <div>
                  <p className="font-extrabold text-sm">Performance CRM</p>
                  <p className="text-[10px] text-muted-foreground font-medium">Relatórios e ROI</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl p-4 cursor-pointer hover:bg-primary/10 transition-all" onSelect={() => handleMenuClick("metas")}>
                <Target className="h-5 w-5 text-primary mr-4" />
                <div>
                  <p className="font-extrabold text-sm">Metas Comerciais</p>
                  <p className="text-[10px] text-muted-foreground font-medium">KPIs de aquisição</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="glass-card p-2 rounded-2xl flex items-center gap-1 ml-auto">
          <Button variant="ghost" className="rounded-xl font-bold px-6 h-11 hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100 transition-all" onClick={() => window.location.href = '/configuracoes'}>
            Parâmetros CRM
          </Button>
        </div>
      </div>

      {/* Stats Premium Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-[2rem] shadow-premium border-black/5 dark:border-white/10 hover-lift group cursor-pointer" onClick={() => handleCardClick("leads")}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Base Total</p>
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <UserCheck className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-4xl font-black text-foreground">{loading ? <Loader2 className="h-8 w-8 animate-spin" /> : leads.length}</p>
          <p className="text-xs font-bold text-muted-foreground/40 mt-2 uppercase tracking-tighter">Leads em observação</p>
        </div>
        
        <div className="glass-card p-6 rounded-[2rem] shadow-premium border-black/5 dark:border-white/10 hover-lift group cursor-pointer" onClick={() => handleCardClick("leads-quentes")}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Leads Quentes</p>
            <div className="p-2.5 bg-orange-500/10 rounded-xl">
              <Phone className="h-5 w-5 text-orange-500" />
            </div>
          </div>
          <p className="text-4xl font-black text-orange-500">{loading ? <Loader2 className="h-8 w-8 animate-spin" /> : hotLeadsCount}</p>
          <p className="text-xs font-bold text-muted-foreground/40 mt-2 uppercase tracking-tighter">Potencial de contrato imediato</p>
        </div>

        <div className="glass-card p-6 rounded-[2rem] shadow-premium border-black/5 dark:border-white/10 hover-lift group cursor-pointer" onClick={() => handleCardClick("conversoes")}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Sucesso Conversão</p>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
          <p className="text-4xl font-black text-emerald-500">{loading ? <Loader2 className="h-8 w-8 animate-spin" /> : `${conversionRate}%`}</p>
          <p className="text-xs font-bold text-muted-foreground/40 mt-2 uppercase tracking-tighter">Taxa média mensal</p>
        </div>
 
        <div className="glass-card p-6 rounded-[2rem] shadow-premium border-black/5 dark:border-white/10 hover-lift group cursor-pointer" onClick={() => handleCardClick("receita-potencial")}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Valor Pipeline</p>
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-4xl font-black text-gradient">{loading ? <Loader2 className="h-8 w-8 animate-spin" /> : `R$ ${leads.length * 1.5}k`}</p>
          <p className="text-xs font-bold text-muted-foreground/40 mt-2 uppercase tracking-tighter">Estimativa baseada em volume</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 px-4">
          <div className="glass-card p-2 rounded-[1.5rem] inline-flex h-auto">
            <TabsList className="bg-transparent h-auto p-0 gap-1">
              <TabsTrigger value="leads" className="rounded-xl px-10 py-3 font-black uppercase text-xs tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-premium transition-all">
                Pipeline Leads
              </TabsTrigger>
              <TabsTrigger value="clientes" className="rounded-xl px-10 py-3 font-black uppercase text-xs tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-premium transition-all">
                Histórico Conversão
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
              <Input
                placeholder="Filtrar base..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 bg-black/[0.03] dark:bg-white/[0.03] border-black/5 dark:border-white/5 rounded-xl font-bold"
              />
            </div>
            <Button variant="ghost" className="h-12 w-12 rounded-xl border border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground/40 hover:text-primary">
              <Filter className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <TabsContent value="leads">
            <Card className="glass-card border-black/5 dark:border-white/5 overflow-hidden rounded-[2rem]">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xl md:text-2xl font-black">Leads Ativos ({leads.length})</CardTitle>
                <CardDescription className="text-sm font-medium">Gerencie seus leads e oportunidades de negócio</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-10 w-10 animate-spin text-primary/20" />
                  </div>
                ) : filteredLeads.length > 0 ? (
                  <div className="space-y-4">
                    {filteredLeads.map((lead) => (
                      <div key={lead.id} className="flex flex-col lg:flex-row lg:items-center justify-between p-5 rounded-[1.5rem] border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.01] hover:bg-primary/[0.03] transition-all gap-4 group">
                        <div className="flex items-center space-x-4">
                          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border-2 shadow-inner transition-transform group-hover:scale-105", getStatusColor(lead.status))}>
                            <UserCheck className="h-7 w-7" />
                          </div>
                          <div>
                            <div className="font-black text-lg text-foreground group-hover:text-primary transition-colors">{lead.nome}</div>
                            <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-40">
                              Desde {lead.created_at ? format(new Date(lead.created_at), "dd MMM yyyy", { locale: ptBR }) : '—'}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            {lead.email && (
                              <div className="flex items-center text-xs font-bold text-muted-foreground/60">
                                <Mail className="h-3.5 w-3.5 mr-2 text-primary/60" />
                                {lead.email}
                              </div>
                            )}
                            {lead.telefone && (
                              <div className="flex items-center text-xs font-bold text-muted-foreground/60">
                                <Phone className="h-3.5 w-3.5 mr-2 text-primary/60" />
                                {lead.telefone}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className={cn("px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg", getStatusColor(lead.status))}>
                              {lead.status}
                            </Badge>
                            <Button variant="ghost" size="sm" className="rounded-xl h-10 px-6 font-black text-xs uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-all" onClick={() => handleOpportunityClick(lead)}>
                              Detalhes
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                    <div className="p-4 rounded-full bg-primary/5 border border-primary/10">
                      <UserCheck className="h-10 w-10 text-primary/30" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-foreground">Nenhum lead encontrado</p>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        {searchQuery ? "Nenhum resultado para sua busca." : "Adicione seu primeiro lead para começar."}
                      </p>
                    </div>
                    {!searchQuery && (
                      <Button
                        size="sm"
                        className="rounded-xl font-bold mt-2"
                        onClick={() => setShowNovoLeadDialog(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Lead
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clientes">
            <Card className="glass-card border-black/5 dark:border-white/5 overflow-hidden rounded-[2rem]">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xl md:text-2xl font-black">Clientes Ativos ({convertedClients.length})</CardTitle>
                <CardDescription className="text-sm font-medium">Clientes que já contrataram seus serviços</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-10 w-10 animate-spin text-primary/20" />
                  </div>
                ) : filteredClients.length > 0 ? (
                  <div className="space-y-4">
                    {filteredClients.map((client) => (
                      <div key={client.id} className="flex flex-col lg:flex-row lg:items-center justify-between p-5 rounded-[1.5rem] border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.01] hover:bg-emerald-500/[0.03] transition-all gap-4 group">
                        <div className="flex items-center space-x-4">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center border-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-inner transition-transform group-hover:scale-105">
                            <UserCheck className="h-7 w-7" />
                          </div>
                          <div>
                            <div className="font-black text-lg text-foreground group-hover:text-emerald-500 transition-colors">{client.nome}</div>
                            <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-40">
                              Cliente desde {client.created_at ? format(new Date(client.created_at), "dd MMM yyyy", { locale: ptBR }) : '—'}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            {client.email && (
                              <div className="flex items-center text-xs font-bold text-muted-foreground/60">
                                <Mail className="h-3.5 w-3.5 mr-2 text-emerald-500/60" />
                                {client.email}
                              </div>
                            )}
                            {client.telefone && (
                              <div className="flex items-center text-xs font-bold text-muted-foreground/60">
                                <Phone className="h-3.5 w-3.5 mr-2 text-emerald-500/60" />
                                {client.telefone}
                              </div>
                            )}
                          </div>
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest">
                            Contratado
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                    <div className="p-4 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                      <UserCheck className="h-10 w-10 text-emerald-500/30" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-foreground">Nenhum cliente convertido</p>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        {searchQuery ? "Nenhum resultado para sua busca." : "Clientes convertidos a partir de leads aparecerão aqui."}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      
      {/* Dialog de Novo Lead */}
      <NovoLeadDialog
        open={showNovoLeadDialog}
        onOpenChange={setShowNovoLeadDialog}
        onSave={() => {
          refresh();
          console.log("Lead saved and refreshing");
        }}
      />
    </div>
  );
}
