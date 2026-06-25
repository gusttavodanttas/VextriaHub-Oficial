import { useState, useEffect } from "react";
import { AlertCircle, Clock, Plus, ArrowRight, Flag, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Prazo {
  id: string;
  titulo: string;
  data_fim_prazo: string | null;
  prioridade: string;
}

const prioMeta: Record<string, { color: string; bg: string; label: string }> = {
  alta:  { color: "text-rose-500",   bg: "bg-rose-500/10",   label: "Alta" },
  media: { color: "text-amber-500",  bg: "bg-amber-500/10",  label: "Média" },
  baixa: { color: "text-emerald-500",bg: "bg-emerald-500/5", label: "Baixa" },
};

export function DeadlinesCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prazos, setPrazos] = useState<Prazo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.office_id) return;
    const fetch = async () => {
      const today = new Date().toISOString().split("T")[0];
      const next7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("prazos")
        .select("id, titulo, data_fim_prazo, prioridade")
        .eq("office_id", user.office_id)
        .eq("status", "pendente")
        .gte("data_fim_prazo", today)
        .lte("data_fim_prazo", next7)
        .order("data_fim_prazo", { ascending: true })
        .limit(5);
      setPrazos((data || []) as Prazo[]);
      setLoading(false);
    };
    fetch();
  }, [user?.office_id]);

  const urgentes = prazos.filter(p => {
    const diff = differenceInDays(parseISO(p.data_fim_prazo!), new Date());
    return diff <= 2;
  });
  const hasUrgent = urgentes.length > 0;

  const getDaysLabel = (dateStr: string) => {
    const diff = differenceInDays(parseISO(dateStr), new Date());
    if (diff === 0) return { label: "Hoje", cls: "text-red-500 font-black" };
    if (diff === 1) return { label: "Amanhã", cls: "text-orange-500 font-black" };
    return { label: `em ${diff}d`, cls: "text-muted-foreground font-bold" };
  };

  return (
    <Card className={cn(
      "h-full flex flex-col border-black/5 dark:border-border bg-card/40 rounded-[2rem] overflow-hidden group hover:shadow-xl transition-all duration-300",
      hasUrgent && "border-rose-500/20"
    )}>
      {hasUrgent && <div className="h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shrink-0" />}

      <CardHeader className="pb-3 pt-5 px-5">
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-xl transition-transform duration-300 group-hover:scale-110", hasUrgent ? "bg-rose-500/15 text-rose-500" : "bg-rose-500/10 text-rose-500")}>
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight block">Prazos Urgentes</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" /> Próximos 7 dias
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm"
            className="text-xs font-bold text-primary hover:bg-primary/10 rounded-xl h-7 px-2.5 gap-1"
            onClick={() => navigate("/prazos")}
          >
            Ver todos <ArrowRight className="h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 pt-0 gap-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-black/[0.03] dark:bg-muted/20 animate-pulse" />
          ))
        ) : prazos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-3">
            <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-500">
              <CalendarDays className="h-8 w-8 opacity-70" />
            </div>
            <div>
              <p className="text-sm font-bold text-muted-foreground">Sem prazos urgentes</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Nenhum prazo nos próximos 7 dias</p>
            </div>
            <Button variant="outline" size="sm"
              className="rounded-xl h-9 px-5 text-[11px] font-black uppercase tracking-widest border-black/5 dark:border-border gap-1.5"
              onClick={() => navigate("/prazos")}
            >
              <Plus className="h-3.5 w-3.5" /> Novo Prazo
            </Button>
          </div>
        ) : (
          <>
            {prazos.map(p => {
              const m = prioMeta[p.prioridade] ?? prioMeta.media;
              const day = getDaysLabel(p.data_fim_prazo!);
              return (
                <button
                  key={p.id}
                  onClick={() => navigate("/prazos")}
                  className="flex items-center gap-3 p-3 rounded-xl bg-black/[0.02] dark:bg-background border border-black/5 dark:border-border hover:border-rose-500/20 hover:bg-rose-500/[0.02] transition-all text-left group/item"
                >
                  <div className={cn("p-1.5 rounded-lg shrink-0", m.bg)}>
                    <Flag className={cn("h-3 w-3", m.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{p.titulo}</p>
                    <p className={cn("text-[10px] mt-0.5", m.color)}>{m.label}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-[11px]", day.cls)}>{day.label}</p>
                    <p className="text-[9px] text-muted-foreground/50">
                      {format(parseISO(p.data_fim_prazo!), "dd/MM", { locale: ptBR })}
                    </p>
                  </div>
                </button>
              );
            })}
            {hasUrgent && (
              <Button
                className="mt-1 rounded-xl h-9 font-black text-[11px] uppercase tracking-widest bg-rose-500 hover:bg-rose-600 text-white gap-1.5 w-full"
                onClick={() => navigate("/prazos")}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {urgentes.length} prazo{urgentes.length > 1 ? "s" : ""} vencendo agora
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
