import { useAuth } from "@/contexts/AuthContext";
import { Gift, CheckCircle2 } from "lucide-react";

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

const getTodayStr = () =>
  new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

export function DashboardHero() {
  const { profile, isLoading } = useAuth();
  const firstName = profile?.full_name ? profile.full_name.split(" ")[0] : null;
  const greeting = getGreeting();
  const today = getTodayStr();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card/90 via-card/60 to-background border border-black/5 dark:border-border px-6 py-5 shadow-sm">
      {/* Background orbs */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-primary/8 rounded-full blur-[60px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-36 h-36 bg-secondary/8 rounded-full blur-[50px] pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Saudação */}
        <div className="space-y-0.5">
          <h1 className="text-xl md:text-3xl font-black tracking-tight leading-tight">
            {greeting},{" "}
            {isLoading || !firstName ? (
              <span className="inline-block align-middle ml-1">
                <span className="inline-block h-7 md:h-9 w-28 md:w-40 rounded-xl bg-primary/10 animate-pulse" />
              </span>
            ) : (
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-secondary">
                {firstName}!
              </span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground font-medium capitalize">{today}</p>
        </div>

        {/* Direita: plano + status */}
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          {/* Badge plano de cortesia */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400">
            <Gift className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest">Plano Cortesia</span>
          </div>

          {/* Status escritório */}
          <div className="hidden sm:flex items-center gap-1.5 text-emerald-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold">Operando normalmente</span>
          </div>
        </div>
      </div>
    </div>
  );
}
