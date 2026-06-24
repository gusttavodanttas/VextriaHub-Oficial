
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles } from "lucide-react";

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
    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-card/80 via-card/40 to-background border border-black/5 dark:border-white/10 px-8 py-7 shadow-premium entry-animate fade-in slide-in-from-bottom-4 duration-700">
      {/* Background orbs */}
      <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-primary/10 rounded-full blur-[80px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-48 h-48 bg-secondary/10 rounded-full blur-[60px] pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: greeting */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
            <Sparkles className="h-3 w-3" />
            Vextria AI Hub
          </div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight">
            {greeting},{" "}
            {isLoading || !firstName ? (
              /* Skeleton while profile loads — prevents "Doutor(a)" flash */
              <span className="inline-block align-middle ml-1">
                <span className="inline-block h-8 md:h-10 w-32 md:w-44 rounded-xl bg-primary/10 animate-pulse" />
              </span>
            ) : (
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-secondary">
                {firstName}!
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground font-medium capitalize">{today}</p>
        </div>

        {/* Right: motivational badge */}
        <div className="hidden md:flex flex-col items-end gap-1 text-right">
          <div className="text-xs text-muted-foreground font-medium">Seu escritório está</div>
          <div className="text-lg font-black text-emerald-500 flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            Operando normalmente
          </div>
          <div className="text-[10px] text-muted-foreground/60">Todos os sistemas ativos</div>
        </div>
      </div>
    </div>
  );
}
