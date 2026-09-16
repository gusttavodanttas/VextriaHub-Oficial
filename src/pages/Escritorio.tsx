import React from "react";
import { Link } from "react-router-dom";

import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { OfficeSettings } from "@/components/Office/OfficeSettings";
import { Building2, Users, FileText, UserCheck, Clock, CalendarDays, DollarSign } from "lucide-react";
import { useStats } from "@/hooks/useStats";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/currency";

const Escritorio = () => {
  const { stats, loading } = useStats();
  const brl = (v: number) => formatBRL(v, { decimals: 0 });
  const kpis = [
    { label: "Colaboradores", value: stats.colaboradores, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Processos ativos", value: stats.processosAtivos, icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Clientes", value: stats.clientes, icon: UserCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Prazos a vencer", value: stats.prazosVencendo, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Audiências próximas", value: stats.audienciasProximas, icon: CalendarDays, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Receita do mês", value: brl(stats.receitaMensal), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-500/10" },
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
              Dados do escritório. Para gerenciar usuários e equipes, acesse{" "}
              <Link to="/equipe" className="text-primary hover:underline font-bold">Equipe</Link>.
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="glass-card flex items-center gap-3 md:gap-4 rounded-[1.5rem] border border-black/5 dark:border-border p-4 md:p-5 shadow-premium hover:border-primary/20 transition-all"
            >
              <div className={cn("h-11 w-11 md:h-12 md:w-12 rounded-2xl flex items-center justify-center shrink-0", k.bg)}>
                <k.icon className={cn("h-5 w-5 md:h-6 md:w-6", k.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 truncate">{k.label}</p>
                <p className="text-2xl md:text-3xl font-black tracking-tight leading-none mt-1 truncate">{loading ? "…" : k.value}</p>
              </div>
            </div>
          ))}
        </div>

        <OfficeSettings />
      </div>
    </PermissionGuard>
  );
};

export default Escritorio;
