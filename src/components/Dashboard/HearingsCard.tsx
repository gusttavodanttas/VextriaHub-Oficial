
import { Users, Calendar, MapPin, Clock, Plus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useStats } from "@/hooks/useStats";

const getWeekRange = () => {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${fmt(now)} – ${fmt(end)}`;
};

export function HearingsCard() {
  const navigate = useNavigate();
  const { stats } = useStats();
  const audiencias: any[] = []; // Conectar ao hook real futuramente
  const weekRange = getWeekRange();

  return (
    <Card className="h-full flex flex-col border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-[2rem] overflow-hidden group hover:shadow-xl transition-all duration-500">
      <CardHeader className="pb-3 pt-5 px-6">
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform duration-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight block">Audiências</span>
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {weekRange}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] font-bold px-2 py-0.5 rounded-xl border-orange-500/30 ${
                stats.audienciasProximas === 0
                  ? "text-muted-foreground"
                  : "text-orange-500 bg-orange-500/10"
              }`}
            >
              {stats.audienciasProximas} esta semana
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-bold text-primary hover:bg-primary/10 rounded-xl h-8 px-3 gap-1"
              onClick={() => navigate("/agenda")}
            >
              Ver <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-center items-center p-6 text-center space-y-4">
        {audiencias.length === 0 ? (
          <div className="entry-animate fade-in zoom-in duration-700 w-full">
            <div className="relative mb-5 mx-auto w-fit">
              <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full" />
              <div className="relative p-5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500">
                <Calendar className="h-10 w-10 opacity-80" />
              </div>
            </div>

            {/* Stat similar ao eLaw */}
            <div className="bg-black/[0.03] dark:bg-background/40 rounded-2xl p-4 border border-black/5 dark:border-white/5 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-medium">Próximas Audiências</span>
                <span className="text-2xl font-black text-orange-500">{stats.audienciasProximas}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" /> Entre {weekRange}
              </div>
            </div>

            <h4 className="text-sm font-bold text-muted-foreground">Nenhuma audiência agendada</h4>
            <p className="text-xs text-muted-foreground max-w-[200px] mx-auto leading-relaxed mt-1 mb-4">
              Audiências dos seus processos aparecerão aqui automaticamente.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 font-black uppercase text-[10px] tracking-widest h-10 px-6 gap-2"
              onClick={() => navigate("/agenda")}
            >
              <Plus className="h-3.5 w-3.5" /> Agendar Audiência
            </Button>
          </div>
        ) : (
          <div className="w-full space-y-2">
            {audiencias.map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-black/[0.02] dark:bg-background/40 border border-black/5 dark:border-white/5 hover:border-orange-500/20 transition-colors cursor-pointer">
                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                  <Users className="h-4 w-4" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold truncate">{a.titulo}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {a.local}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold">{a.hora}</p>
                  <p className="text-[10px] text-muted-foreground">{a.data}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
