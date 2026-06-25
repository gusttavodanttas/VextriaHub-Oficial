import { useState, useEffect } from "react";
import { Users, Calendar, MapPin, Clock, Plus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Audiencia {
  id: string;
  titulo: string | null;
  data_audiencia: string;
  local?: string | null;
}

export function HearingsCard({ onOpenSheet }: { onOpenSheet?: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [audiencias, setAudiencias] = useState<Audiencia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.office_id) return;
    const fetch = async () => {
      const now = new Date().toISOString();
      const next7 = new Date(Date.now() + 7 * 86400000).toISOString();
      const { data } = await supabase
        .from("audiencias")
        .select("id, titulo, data_audiencia, local")
        .eq("office_id", user.office_id)
        .eq("deletado", false)
        .gte("data_audiencia", now)
        .lte("data_audiencia", next7)
        .order("data_audiencia", { ascending: true })
        .limit(5);
      setAudiencias((data || []) as Audiencia[]);
      setLoading(false);
    };
    fetch();
  }, [user?.office_id]);

  const total = audiencias.length;

  return (
    <Card className="h-full flex flex-col border-black/5 dark:border-border bg-card/40 rounded-[2rem] overflow-hidden group hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-3 pt-5 px-5">
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform duration-300">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight block">Audiências</span>
              <span className={cn("text-[10px] flex items-center gap-1", total > 0 ? "text-orange-500 font-bold" : "text-muted-foreground")}>
                <Calendar className="h-2.5 w-2.5" />
                {total > 0 ? `${total} nos próximos 7 dias` : "Próximos 7 dias"}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm"
            className="text-xs font-bold text-primary hover:bg-primary/10 rounded-xl h-7 px-2.5 gap-1"
            onClick={onOpenSheet ?? (() => navigate("/agenda"))}
          >
            Ver agenda <ArrowRight className="h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 pt-0 gap-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-black/[0.03] dark:bg-muted/20 animate-pulse" />
          ))
        ) : audiencias.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-3">
            <div className="p-4 rounded-full bg-orange-500/10 text-orange-500">
              <Calendar className="h-8 w-8 opacity-70" />
            </div>
            <div>
              <p className="text-sm font-bold text-muted-foreground">Sem audiências na semana</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Nenhuma audiência agendada</p>
            </div>
            <Button variant="outline" size="sm"
              className="rounded-xl h-9 px-5 text-[11px] font-black uppercase tracking-widest border-black/5 dark:border-border gap-1.5"
              onClick={() => navigate("/agenda")}
            >
              <Plus className="h-3.5 w-3.5" /> Agendar
            </Button>
          </div>
        ) : (
          audiencias.map(a => {
            const dt = parseISO(a.data_audiencia);
            return (
              <button
                key={a.id}
                onClick={onOpenSheet ?? (() => navigate("/agenda"))}
                className="flex items-center gap-3 p-3 rounded-xl bg-black/[0.02] dark:bg-background border border-black/5 dark:border-border hover:border-orange-500/20 hover:bg-orange-500/[0.02] transition-all text-left"
              >
                <div className="text-center bg-orange-500/10 rounded-xl px-2.5 py-1.5 shrink-0 min-w-[40px]">
                  <p className="text-[10px] font-black text-orange-500 uppercase leading-none">
                    {format(dt, "MMM", { locale: ptBR })}
                  </p>
                  <p className="text-base font-black text-orange-600 leading-tight">
                    {format(dt, "dd")}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{a.titulo || "Audiência"}</p>
                  {a.local && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="h-2.5 w-2.5 shrink-0" /> {a.local}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-bold text-muted-foreground">
                    {format(dt, "HH:mm")}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
