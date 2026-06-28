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
      <div className="flex-1 p-4 md:p-8 space-y-8 overflow-x-hidden entry-animate">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 shadow-premium">
            <Building2 className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight">Meu Escritório</h1>
            <p className="text-xs md:text-sm text-muted-foreground font-medium">
              Dados do escritório e controle de acesso da equipe
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="glass-card flex items-center gap-4 rounded-[1.5rem] border border-black/5 dark:border-border p-5 shadow-premium hover:border-primary/20 transition-all"
            >
              <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shrink-0", k.bg)}>
                <k.icon className={cn("h-6 w-6", k.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{k.label}</p>
                <p className="text-3xl font-black tracking-tight leading-none mt-1">{loading ? "…" : k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="configuracoes" className="space-y-6">
          <div className="glass-card p-1.5 rounded-2xl border border-black/5 dark:border-border w-fit shadow-premium">
            <TabsList className="h-11 gap-1 bg-transparent border-none p-0">
              <TabsTrigger
                value="configuracoes"
                className="rounded-xl px-5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-premium font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all"
              >
                <Settings className="h-3.5 w-3.5" /> Dados
              </TabsTrigger>
              <TabsTrigger
                value="usuarios"
                className="rounded-xl px-5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-premium font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all"
              >
                <Users className="h-3.5 w-3.5" /> Usuários
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="configuracoes" className="space-y-6 mt-0">
            <OfficeSettings />
          </TabsContent>

          <TabsContent value="usuarios" className="space-y-6 mt-0">
            <UserManagement />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
};

export default Escritorio;
