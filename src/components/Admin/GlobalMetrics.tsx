import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOfficeManagement } from '@/hooks/useOfficeManagement';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useAuth } from '@/contexts/AuthContext';
import {
  Building2, Users, CreditCard, TrendingUp, Activity,
  DollarSign, Star, Zap, ShieldCheck, ArrowUpRight, Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

interface MetricCardProps {
  title: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  badge?: string;
  badgeColor?: string;
  trend?: string;
}

function MetricCard({ title, value, sub, icon: Icon, color, bg, badge, badgeColor, trend }: MetricCardProps) {
  return (
    <Card className="relative overflow-hidden group border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-[2rem] hover:shadow-2xl transition-all duration-500 hover:-translate-y-0.5">
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500", bg)} />
      <CardContent className="p-5 relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("p-2.5 rounded-2xl border border-black/5 dark:border-white/10 group-hover:scale-110 transition-transform duration-300", bg, color)}>
            <Icon className="h-5 w-5" />
          </div>
          {badge && (
            <Badge className={cn("text-[10px] font-bold rounded-xl border px-2 py-0.5", badgeColor)}>
              {badge}
            </Badge>
          )}
        </div>
        <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">{title}</div>
        <div className="text-3xl font-black tracking-tight mb-1">{value}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
          <span>{sub}</span>
          {trend && (
            <span className="flex items-center gap-0.5 text-emerald-500 font-bold">
              <ArrowUpRight className="h-3 w-3" />{trend}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const GlobalMetrics: React.FC = () => {
  const { offices, loading: officesLoading } = useOfficeManagement();
  const { subscriptions, loading: subscriptionsLoading } = useSubscriptions();
  const { user } = useAuth();
  const loading = officesLoading || subscriptionsLoading;

  const totalOffices = offices.length;
  const activeOffices = offices.filter(o => o.active).length;
  const totalUsers = offices.reduce((sum, o) => {
    const officeUsers = (o as any).office_users || [];
    return sum + officeUsers.filter((u: any) => u.active).length;
  }, 0);
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;
  const monthlyRevenue = subscriptions.filter(s => s.status === 'active').reduce((s, sub) => s + (sub.price || 0), 0);
  const conversionRate = totalOffices > 0 ? ((activeSubscriptions / totalOffices) * 100).toFixed(1) : '0.0';
  const activationRate = totalOffices > 0 ? ((offices.filter(o => o.plan !== 'trial').length / totalOffices) * 100).toFixed(1) : '0';

  const planNames: Record<string, string> = {
    trial: 'Trial', basico: 'Básico', intermediario: 'Intermediário',
    avancado: 'Avançado', premium: 'Premium', vitalicio: 'Vitalício', cortesia: 'Cortesia'
  };
  const planColors: Record<string, string> = {
    trial: 'text-muted-foreground', basico: 'text-blue-500',
    intermediario: 'text-purple-500', avancado: 'text-orange-500',
    premium: 'text-primary', vitalicio: 'text-amber-500', cortesia: 'text-emerald-600'
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-3xl bg-card/20 animate-pulse border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary/10 via-card/80 to-background border border-black/5 dark:border-white/10 p-8 shadow-premium">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-secondary/10 rounded-full blur-[60px] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="h-3 w-3" /> Super Admin · Modo CEO
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              Centro de{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                Controle Global
              </span>
            </h1>
            <p className="text-sm text-muted-foreground font-medium">
              Gestão centralizada de escritórios, planos e integridade sistêmica.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <div className="text-xs text-muted-foreground">Receita Mensal</div>
              <div className="text-2xl font-black text-emerald-500">{formatCurrency(monthlyRevenue)}</div>
              <div className="text-[10px] text-muted-foreground">ARR: {formatCurrency(monthlyRevenue * 12)}</div>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
              <DollarSign className="h-8 w-8" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          title="Escritórios"
          value={totalOffices}
          sub={`${activeOffices} ativos`}
          icon={Building2}
          color="text-blue-500"
          bg="from-blue-500/15 to-blue-500/5"
          badge={`+0%`}
          badgeColor="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
        />
        <MetricCard
          title="Usuários Totais"
          value={totalUsers}
          sub={`em ${activeOffices} escritórios`}
          icon={Users}
          color="text-purple-500"
          bg="from-purple-500/15 to-purple-500/5"
          badge={`+0%`}
          badgeColor="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
        />
        <MetricCard
          title="Assinaturas Ativas"
          value={activeSubscriptions}
          sub={`${conversionRate}% de conversão`}
          icon={CreditCard}
          color="text-orange-500"
          bg="from-orange-500/15 to-orange-500/5"
          badge={activeSubscriptions > 0 ? "OK" : "Atenção"}
          badgeColor={activeSubscriptions > 0 ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" : "text-amber-500 bg-amber-500/10 border-amber-500/20"}
        />
        <MetricCard
          title="Receita Mensal"
          value={formatCurrency(monthlyRevenue)}
          sub={`ARR: ${formatCurrency(monthlyRevenue * 12)}`}
          icon={TrendingUp}
          color="text-emerald-500"
          bg="from-emerald-500/15 to-emerald-500/5"
          trend="ativo"
        />
        <MetricCard
          title="Média Usuários"
          value={totalOffices > 0 ? (totalUsers / totalOffices).toFixed(1) : '0'}
          sub="por escritório"
          icon={Activity}
          color="text-cyan-500"
          bg="from-cyan-500/15 to-cyan-500/5"
        />
        <MetricCard
          title="Taxa de Ativação"
          value={`${activationRate}%`}
          sub="planos pagos"
          icon={Zap}
          color="text-amber-500"
          bg="from-amber-500/15 to-amber-500/5"
          badge={Number(activationRate) > 50 ? "Bom" : "Crescer"}
          badgeColor={Number(activationRate) > 50 ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" : "text-amber-500 bg-amber-500/10 border-amber-500/20"}
        />
      </div>

      {/* Plans Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Distribuição de planos */}
        <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-[2rem] overflow-hidden shadow-premium">
          <div className="p-6 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-black">Distribuição de Planos</h3>
                <p className="text-[11px] text-muted-foreground">Visão por tipo de assinatura</p>
              </div>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-3">
              {['trial', 'basico', 'intermediario', 'avancado', 'premium', 'vitalicio', 'cortesia'].map((plan) => {
                const count = plan === 'vitalicio'
                  ? offices.filter(o => o.is_lifetime).length
                  : plan === 'cortesia'
                  ? offices.filter(o => o.access_type === 'courtesy').length
                  : offices.filter(o => o.plan === plan && !o.is_lifetime && o.access_type !== 'courtesy').length;
                return (
                  <div key={plan} className="bg-black/[0.02] dark:bg-background/40 rounded-2xl p-3 border border-black/5 dark:border-white/5 text-center hover:border-primary/20 transition-colors">
                    <div className={cn("text-2xl font-black mb-1", planColors[plan] || 'text-foreground')}>
                      {count}
                    </div>
                    <p className="text-xs font-bold text-muted-foreground">{planNames[plan]}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Últimos escritórios */}
        <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-[2rem] overflow-hidden shadow-premium">
          <div className="p-6 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-black">Escritórios Recentes</h3>
                <p className="text-[11px] text-muted-foreground">Últimos cadastros na plataforma</p>
              </div>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="space-y-2">
              {offices.length > 0 ? (
                offices.slice(0, 5).map((office, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-black/[0.02] dark:bg-background/40 border border-black/5 dark:border-white/5 hover:border-primary/20 transition-colors group">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{office.name}</p>
                      <p className="text-[10px] text-muted-foreground">{office.plan || 'trial'}</p>
                    </div>
                    <Badge
                      className={cn(
                        "text-[10px] font-bold rounded-lg border",
                        office.active
                          ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                          : "text-muted-foreground bg-muted/20 border-white/5"
                      )}
                    >
                      {office.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum escritório cadastrado</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Debug strip (CEO only) */}
      <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 text-xs text-muted-foreground flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-1.5 font-bold text-primary">
          <ShieldCheck className="h-3.5 w-3.5" /> Diagnóstico CEO
        </div>
        <div>Admin: <span className="text-emerald-500 font-bold">Ativo</span></div>
        <div>Escritórios: <span className="font-mono font-bold">{offices.length}</span></div>
        <div>Usuários: <span className="font-mono font-bold">{totalUsers}</span></div>
        <div>Assinaturas: <span className="font-mono font-bold">{subscriptions.length}</span></div>
        <div>Sessão: <span className="font-mono font-bold text-[10px]">{user?.email}</span></div>
      </div>
    </div>
  );
};