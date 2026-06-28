import React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { OfficeSettings } from "@/components/Office/OfficeSettings";
import { UserManagement } from "@/components/Office/UserManagement";
import { Building2, Users, Settings, FileText, UserCheck } from "lucide-react";
import { useStats } from "@/hooks/useStats";
import { cn } from "@/lib/utils";

const Escritorio = () => {
  const { stats, loading } = useStats();
  const kpis = [
    { label: "Colaboradores", value: stats.colaboradores, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Processos ativos", value: stats.processosAtivos, icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Clientes", value: stats.clientes, icon: UserCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];
  return (
    <PermissionGuard permission="canManageOffice">
      <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-10 overflow-x-hidden entry-animate">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Building2 className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              </div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight text-foreground">
                Gestão do Escritório
              </h1>
            </div>
            <p className="text-sm md:text-lg text-muted-foreground font-medium">
              Ajuste as configurações globais e controle o acesso de usuários.
            </p>
          </div>
        </div>

        {/* KPIs do escritório */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="flex items-center gap-3 rounded-2xl border border-black/5 dark:border-border bg-card/40 p-4">
              <div className={cn("p-2.5 rounded-xl shrink-0", k.bg)}><k.icon className={cn("h-5 w-5", k.color)} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{k.label}</p>
                <p className="text-2xl font-black tracking-tight">{loading ? "…" : k.value}</p>
              </div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="configuracoes" className="space-y-8">
          <div className="border-b border-black/5 dark:border-border bg-black/[0.01] dark:bg-background/30 backdrop-blur-sm p-1.5 rounded-2xl w-fit">
            <TabsList className="h-11 gap-1 bg-transparent border-none">
              <TabsTrigger value="configuracoes" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-foreground data-[state=active]:shadow-lg shadow-primary/20 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all">
                <Settings className="h-3.5 w-3.5" />
                Configurações
              </TabsTrigger>
              <TabsTrigger value="usuarios" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-foreground data-[state=active]:shadow-lg shadow-primary/20 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all">
                <Users className="h-3.5 w-3.5" />
                Usuários
              </TabsTrigger>
            </TabsList>
          </div>

                <TabsContent value="configuracoes" className="space-y-6">
                  <OfficeSettings />
                </TabsContent>

                <TabsContent value="usuarios" className="space-y-6">
                  <UserManagement />
                </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
};

export default Escritorio;
