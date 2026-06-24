
import { StatsCards } from "@/components/Dashboard/StatsCards";
import { RecentActivity } from "@/components/Dashboard/RecentActivity";
import { PriorityTasks } from "@/components/Dashboard/PriorityTasks";
import { DeadlinesCard } from "@/components/Dashboard/DeadlinesCard";
import { HearingsCard } from "@/components/Dashboard/HearingsCard";
import { ScoreCard } from "@/components/Gamification/ScoreCard";
import { CalendarWidget } from "@/components/Dashboard/CalendarWidget";
import { DashboardHero } from "@/components/Dashboard/DashboardHero";
import { QuickStatsBar } from "@/components/Dashboard/QuickStatsBar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const isMobile = useIsMobile();
  const { isSuperAdmin, validatePayment } = useAuth();
  const navigate = useNavigate();
  const [trialInfo, setTrialInfo] = useState<{daysLeft: number; isTrial: boolean} | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('success')) {
      setTimeout(async () => {
        await validatePayment();
      }, 1000);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [validatePayment]);

  useEffect(() => {
    if (isSuperAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [isSuperAdmin, navigate]);

  useEffect(() => {
    const checkTrialStatus = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (user) {
          const createdAt = new Date(user.created_at);
          const trialEndDate = new Date(createdAt);
          trialEndDate.setDate(trialEndDate.getDate() + 7);
          const now = new Date();
          const diffMs = trialEndDate.getTime() - now.getTime();
          const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          setTrialInfo({ daysLeft: Math.max(0, daysLeft), isTrial: true });
        }
      } catch (error) {
        console.error('Error checking trial status:', error);
      }
    };
    checkTrialStatus();
  }, []);

  if (isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="ml-3 text-muted-foreground">Redirecionando para Administração Global...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 md:space-y-8 overflow-x-hidden entry-animate fade-in duration-700">

      {/* 1. Hero compacto */}
      <DashboardHero />

      {/* 2. Trial Alert */}
      {trialInfo?.isTrial && trialInfo.daysLeft > 0 && (
        <Alert className="bg-primary/5 border-primary/20 text-foreground py-4 rounded-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
          <Clock className="h-4 w-4 text-primary" />
          <AlertTitle className="font-bold">Período de Teste Ativo</AlertTitle>
          <AlertDescription className="text-muted-foreground text-sm">
            Você tem <span className="font-bold text-primary">{trialInfo.daysLeft} dia{trialInfo.daysLeft > 1 ? 's' : ''}</span> restante{trialInfo.daysLeft > 1 ? 's' : ''} no seu período premium.
          </AlertDescription>
        </Alert>
      )}

      {/* 3. Barra de controle rápido (estilo eLaw mas premium) */}
      <QuickStatsBar />

      {/* 4. KPIs financeiros e estratégicos */}
      <div className="space-y-3">
        <h2 className="text-base font-black tracking-tight text-muted-foreground uppercase text-[11px] tracking-widest">
          Panorama Financeiro
        </h2>
        <StatsCards />
      </div>

      {/* 5. Grid Bento Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Coluna esquerda (8 cols) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Audiências + Prazos lado a lado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="hover-lift">
              <HearingsCard />
            </div>
            <div className="hover-lift">
              <DeadlinesCard />
            </div>
          </div>

          {/* Atividades Recentes */}
          <div className="hover-lift">
            <RecentActivity />
          </div>

          {/* Tarefas Prioritárias */}
          <div className="hover-lift">
            <PriorityTasks />
          </div>
        </div>

        {/* Coluna direita (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="sticky top-24 space-y-6">

            {/* Calendário */}
            <div className="hover-lift glass-morphism rounded-[2rem] overflow-hidden shadow-premium">
              <CalendarWidget />
            </div>

            {/* Score de gamificação */}
            <div className="hover-lift">
              <ScoreCard
                userName="Membro"
                totalScore={0}
                monthlyScore={0}
                weeklyScore={0}
                rank={0}
                completedTasks={0}
                totalTasks={0}
              />
            </div>

            {/* AI Insight Card */}
            <Card className="bg-gradient-to-br from-primary/20 to-secondary/10 border-primary/20 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group hover-lift">
              <div className="absolute -top-8 -right-8 w-28 h-28 bg-primary/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
              <div className="relative z-10 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary text-white rounded-xl w-fit shadow-lg">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-primary">Vextria AI</span>
                </div>
                <h3 className="text-lg font-black leading-tight">Insight de Hoje</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  "Detectamos um padrão de produtividade alto nas manhãs de terça. Que tal agendar seus peticionamentos mais complexos para esse período?"
                </p>
                <Button variant="link" className="p-0 text-primary font-bold h-auto hover:no-underline flex items-center gap-1.5 text-sm group/btn">
                  Ver Análise Completa
                  <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
                </Button>
              </div>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
