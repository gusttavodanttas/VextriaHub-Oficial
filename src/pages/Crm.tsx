import { useState, useMemo, useDeferredValue } from "react";
import { Search, Plus, Loader2, LayoutList, Trello, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NovoLeadDialog } from "@/components/Crm/NovoLeadDialog";
import { useCrmBase } from "@/hooks/useCrmBase";
import { CarregarMaisHistorico } from "@/components/shared/CarregarMaisHistorico";
import type { ClienteComProcessos } from "@/types/database";
import { cn } from "@/lib/utils";

// Importações dos novos componentes modularizados
import { CrmLeadsList } from "@/components/Crm/CrmLeadsList";
import { CrmKanban } from "@/components/Crm/CrmKanban";
import { CrmRoboBox } from "@/components/Crm/CrmRoboBox";
import { CrmPipelineVendas } from "@/components/Crm/CrmPipelineVendas";
import { CrmFunilVendas } from "@/components/Crm/CrmFunilVendas";
import { CrmOportunidades } from "@/components/Crm/CrmOportunidades";
import { CrmOportunidadeDetail } from "@/components/Crm/CrmOportunidadeDetail";
import { CrmRelatorios, CrmMetas } from "@/components/Crm/CrmDashboards";
import { assertRowsAffected, getErrorMessage } from "@/lib/errors";
import { CrmHeaderNav } from "@/components/Crm/CrmHeaderNav";
import { CrmStatsCards } from "@/components/Crm/CrmStatsCards";
import { CrmLeadRow } from "@/components/Crm/CrmLeadRow";
import { CrmClienteRow } from "@/components/Crm/CrmClienteRow";
import { CrmEmptyState } from "@/components/Crm/CrmEmptyState";
import { calcularKpisCrm } from "@/components/Crm/crmKpis";

export default function Crm() {
  const {
    leads, convertidos, resumoConvertidos, convertidosRestantes, carregarMaisConvertidos, carregandoMaisConvertidos,
    loading, error, refresh, todos: allClientes,
  } = useCrmBase();
  const { user, profile } = useAuth();
  const { canManageCRM } = usePermissions();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("leads");
  const [currentView, setCurrentView] = useState("main");
  const [selectedOpportunity, setSelectedOpportunity] = useState<ClienteComProcessos | null>(null);
  const [showNovoLeadDialog, setShowNovoLeadDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dSearch = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  // KPIs do topo (ver calcularKpisCrm — convertidos vêm paginados, o resumo do
  // servidor cobre taxa de conversão e valor ganho).
  const { convertedClients, hotLeadsCount, conversionRate, pipelineValue, totalConvertidos } = useMemo(
    () => calcularKpisCrm(leads, convertidos, resumoConvertidos), [leads, convertidos, resumoConvertidos]);

  const matchSearch = (c: ClienteComProcessos) =>
    c.nome.toLowerCase().includes(dSearch.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(dSearch.toLowerCase()));

  const filteredLeads = useMemo(
    () => leads.filter(l => matchSearch(l) && (statusFilter === "todos" || l.status === statusFilter)),
    [leads, dSearch, statusFilter]
  );
  const filteredClients = useMemo(() => convertedClients.filter(matchSearch), [convertedClients, dSearch]);

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

  const handleOpportunityClick = (opportunity: ClienteComProcessos) => {
    setSelectedOpportunity(opportunity);
    setCurrentView("opportunity-detail");
  };

  // Muda a temperatura/status do lead direto na tela (persiste). Encadeia
  // .select('id') porque a RLS pode bloquear o UPDATE sem lançar erro (só
  // casa 0 linhas) — sem checar, a UI ficaria "muda" quando isso acontece.
  const updateLeadStatus = async (id: string, status: string) => {
    if (!canManageCRM || !user?.office_id) return;
    try {
      const { data, error } = await supabase.from("clientes").update({ status }).eq("id", id).eq("office_id", user.office_id).select("id");
      assertRowsAffected(data, error, 1);
      refresh();
    } catch (e) {
      toast({ title: "Não foi possível mudar a temperatura", description: getErrorMessage(e), variant: "destructive" });
    }
  };

  // Define a data do próximo contato (follow-up) do cliente.
  const setFollowup = async (id: string, date: string) => {
    if (!canManageCRM || !user?.office_id) return;
    try {
      const { data, error } = await supabase.from("clientes").update({ proximo_contato: date || null }).eq("id", id).eq("office_id", user.office_id).select("id");
      assertRowsAffected(data, error, 1);
      refresh();
    } catch (e) {
      toast({ title: "Não foi possível salvar o follow-up", description: getErrorMessage(e), variant: "destructive" });
    }
  };

  const hojeStr = new Date().toISOString().slice(0, 10);

  const renderSpecificView = () => {
    switch (currentView) {
      case "leads":
        return <CrmLeadsList onBack={handleBackToMain} tipo="todos" data={leads} refresh={refresh} onManage={handleOpportunityClick} />;
      case "leads-quentes":
        return <CrmLeadsList onBack={handleBackToMain} tipo="quentes" data={leads.filter(l => l.status === "quente")} refresh={refresh} onManage={handleOpportunityClick} />;
      case "receita-potencial":
        return <CrmPipelineVendas onBack={handleBackToMain} data={allClientes} loading={loading} />;
      case "funil-vendas":
        return <CrmFunilVendas onBack={handleBackToMain} data={allClientes} loading={loading} />;
      case "oportunidades":
        return <CrmOportunidades onBack={handleBackToMain} onOpportunityClick={handleOpportunityClick} data={leads} />;
      case "opportunity-detail":
        return <CrmOportunidadeDetail onBack={() => setCurrentView("oportunidades")} opportunity={selectedOpportunity} />;
      case "relatorios":
        return <CrmRelatorios onBack={handleBackToMain} data={allClientes} loading={loading} />;
      case "metas":
        return <CrmMetas onBack={handleBackToMain} data={allClientes} loading={loading} />;
      default:
        return null;
    }
  };

  if (currentView !== "main") {
    return (
      <PermissionGuard permission="canViewCRM" showDeniedMessage>
        <div className="p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {renderSpecificView()}
          </div>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="canViewCRM" showDeniedMessage>
    <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-12 overflow-x-hidden entry-animate">
      <CrmHeaderNav onNovoLead={() => setShowNovoLeadDialog(true)} onMenuClick={handleMenuClick} />

      {error && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center glass-card rounded-[2rem] border-black/5 dark:border-border">
          <div className="p-4 rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive/60" />
          </div>
          <div>
            <p className="font-bold text-foreground">Não foi possível carregar a base de leads/clientes</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
          <Button variant="outline" onClick={refresh} className="rounded-xl font-black">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Stats Premium Row */}
      <CrmStatsCards loading={loading} erro={!!error} leadsCount={leads.length} hotLeadsCount={hotLeadsCount}
        conversionRate={conversionRate} pipelineValue={pipelineValue}
        onCardClick={handleCardClick} onConvertidos={() => setActiveTab("clientes")} />

      {/* Robô do CRM — contatos de hoje + leads esfriando (oculto se a base não carregou:
          com lista vazia ele diria "CRM em dia"). */}
      {!loading && !error && (
        <CrmRoboBox data={allClientes} refresh={refresh} remetente={profile?.full_name ?? undefined} onOpenLead={handleOpportunityClick} />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 px-4">
          <div className="glass-card p-2 rounded-[1.5rem] inline-flex h-auto">
            <TabsList className="bg-transparent h-auto p-0 gap-1">
              <TabsTrigger value="leads" className="rounded-xl px-6 md:px-8 py-3 font-black uppercase text-xs tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-premium transition-all gap-1.5">
                <LayoutList className="h-3.5 w-3.5" /> Lista
              </TabsTrigger>
              <TabsTrigger value="kanban" className="rounded-xl px-6 md:px-8 py-3 font-black uppercase text-xs tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-premium transition-all gap-1.5">
                <Trello className="h-3.5 w-3.5" /> Kanban
              </TabsTrigger>
              <TabsTrigger value="clientes" className="rounded-xl px-6 md:px-8 py-3 font-black uppercase text-xs tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-premium transition-all">
                Convertidos
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
                className="pl-12 h-12 bg-black/[0.03] dark:bg-white/[0.03] border-black/5 dark:border-border rounded-xl font-bold"
              />
            </div>
          </div>
        </div>

        <TabsContent value="leads">
            <Card className="glass-card border-black/5 dark:border-border overflow-hidden rounded-[2rem]">
              <CardHeader className="p-6 md:p-8 pb-4 space-y-4">
                <div>
                  <CardTitle className="text-xl md:text-2xl font-black">Leads Ativos ({filteredLeads.length})</CardTitle>
                  <CardDescription className="text-sm font-medium">Gerencie seus leads e oportunidades de negócio</CardDescription>
                </div>
                {/* Filtro por temperatura */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: "todos", label: "Todos", n: leads.length },
                    { v: "quente", label: "Quentes", n: leads.filter(l => l.status === "quente").length },
                    { v: "morno", label: "Mornos", n: leads.filter(l => l.status === "morno").length },
                    { v: "frio", label: "Frios", n: leads.filter(l => l.status === "frio").length },
                    { v: "lead", label: "Novos", n: leads.filter(l => l.status === "lead").length },
                  ].map(f => (
                    <button key={f.v} type="button" onClick={() => setStatusFilter(f.v)}
                      className={cn("px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                        statusFilter === f.v ? "bg-primary text-primary-foreground shadow" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>
                      {f.label} <span className="opacity-60">({f.n})</span>
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-0">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-10 w-10 animate-spin text-primary/20" />
                  </div>
                ) : filteredLeads.length > 0 ? (
                  <div className="space-y-4">
                    {filteredLeads.map((lead) => (
                      <CrmLeadRow key={lead.id} lead={lead} canManageCRM={canManageCRM} hojeStr={hojeStr}
                        onFollowup={setFollowup} onStatusChange={updateLeadStatus} onDetalhes={handleOpportunityClick} />
                    ))}
                  </div>
                ) : (
                  <CrmEmptyState tom="primary" titulo="Nenhum lead encontrado"
                    descricao={searchQuery ? "Nenhum resultado para sua busca." : "Adicione seu primeiro lead para começar."}>
                    {!searchQuery && (
                      <PermissionGuard permission="canManageCRM">
                        <Button
                          size="sm"
                          className="rounded-xl font-bold mt-2"
                          onClick={() => setShowNovoLeadDialog(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Lead
                        </Button>
                      </PermissionGuard>
                    )}
                  </CrmEmptyState>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kanban">
            <Card className="glass-card border-black/5 dark:border-border overflow-hidden rounded-[2rem]">
              <CardHeader className="p-6 md:p-8 pb-4">
                <CardTitle className="text-xl md:text-2xl font-black">Pipeline (Kanban)</CardTitle>
                <CardDescription className="text-sm font-medium">Arraste os leads entre as colunas para mudar a temperatura.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-10 w-10 animate-spin text-primary/20" /></div>
                ) : (
                  <CrmKanban data={allClientes} refresh={refresh} onCardClick={handleOpportunityClick} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clientes">
            <Card className="glass-card border-black/5 dark:border-border overflow-hidden rounded-[2rem]">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xl md:text-2xl font-black">Clientes Ativos ({totalConvertidos})</CardTitle>
                <CardDescription className="text-sm font-medium">Clientes que já contrataram seus serviços</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-10 w-10 animate-spin text-primary/20" />
                  </div>
                ) : filteredClients.length > 0 ? (
                  <div className="space-y-4">
                    {filteredClients.map((client) => <CrmClienteRow key={client.id} client={client} />)}
                  </div>
                ) : (
                  <CrmEmptyState tom="emerald" titulo="Nenhum cliente convertido"
                    descricao={searchQuery ? "Nenhum resultado para sua busca." : "Clientes convertidos a partir de leads aparecerão aqui."} />
                )}
                {/* Convertidos vêm paginados — rodapé com o que falta carregar */}
                <CarregarMaisHistorico restantes={convertidosRestantes} carregando={carregandoMaisConvertidos}
                  onClick={carregarMaisConvertidos} rotulo="clientes convertidos" />
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
        }}
      />
    </div>
    </PermissionGuard>
  );
}
