import { useState, useEffect } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useExclusoesPendentes } from "@/hooks/useExclusoesPendentes";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useUserRole } from "@/hooks/useUserRole";
import { Shield } from "lucide-react";
import { OfficeControlPanel } from "@/components/SuperAdmin/OfficeControlPanel";
import CobrancaAsaas from "@/components/Admin/CobrancaAsaas";
import { GlobalMetrics } from "@/components/Admin/GlobalMetrics";
import { PlanManagement } from "@/components/Admin/PlanManagement";
import { ExclusoesPendentesSection } from "@/components/Admin/ExclusoesPendentesSection";

import { useSearchParams } from "react-router-dom";

const Admin = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || "dashboard";
  const [activeTab, setActiveTab] = useState(initialTab);
  const { canViewAdminFeatures, isSuperAdmin, isLoading: authLoading } = useUserRole();

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

  // Admin do escritório (canManage) entra para gerenciar as exclusões do próprio
  // escritório — cai na "Non-super admin view" (só Solicitações de Exclusão). (v11)
  if (!canViewAdminFeatures && !canManage) {
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
        {isSuperAdmin ? (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            {/* TabsList removido — navegação feita pelo sidebar */}

            <TabsContent value="dashboard" className="entry-animate slide-in-from-bottom-4 duration-500 mt-0">
              <GlobalMetrics />
            </TabsContent>

            <TabsContent value="offices" className="entry-animate slide-in-from-bottom-4 duration-500 mt-0">
              <OfficeControlPanel />
            </TabsContent>

            <TabsContent value="subscriptions" className="space-y-6 entry-animate slide-in-from-bottom-4 duration-500 mt-0">
              <PlanManagement />
              <CobrancaAsaas />
            </TabsContent>

            <TabsContent value="requests" className="space-y-6 entry-animate slide-in-from-bottom-4 duration-500 mt-0">
              <ExclusoesPendentesSection
                exclusoesPendentes={exclusoesPendentes}
                requestsLoading={requestsLoading}
                isEmpty={isEmpty}
                multiSelect={multiSelect}
                processando={processando}
                onAprovar={handleAprovar}
                onRejeitar={handleRejeitar}
                onAprovarSelecionados={handleAprovarSelecionados}
                dense
              />
            </TabsContent>
          </Tabs>
        ) : (
          // Non-super admin view (existing deletion requests view)
          <div className="animate-in fade-in duration-700">
            <ExclusoesPendentesSection
              exclusoesPendentes={exclusoesPendentes}
              requestsLoading={requestsLoading}
              isEmpty={isEmpty}
              multiSelect={multiSelect}
              processando={processando}
              onAprovar={handleAprovar}
              onRejeitar={handleRejeitar}
              onAprovarSelecionados={handleAprovarSelecionados}
              header={{
                title: "Solicitações de Exclusão",
                description: "Gerencie os pedidos de remoção de dados do seu escritório.",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
