import { useState, useEffect } from "react";
import { CheckSquare, CheckCircle2, ArrowRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Tarefa {
  id: string;
  titulo: string;
  prioridade?: string | null;
  data_vencimento?: string | null;
  concluida: boolean;
}

export function PriorityTasks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [concluindo, setConcluindo] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.office_id) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("id, titulo, prioridade, data_vencimento, concluida")
        .eq("office_id", user.office_id)
        .eq("deletado", false)
        .eq("concluida", false)
        .order("data_vencimento", { ascending: true, nullsFirst: false })
        .limit(5);
      setTarefas((data || []) as Tarefa[]);
      setLoading(false);
    };
    fetch();
  }, [user?.office_id]);

  const concluir = async (id: string) => {
    setConcluindo(id);
    await supabase.from("tarefas").update({ concluida: true }).eq("id", id);
    setTarefas(prev => prev.filter(t => t.id !== id));
    setConcluindo(null);
  };

  const prioColor: Record<string, string> = {
    alta:  "bg-rose-500/10 text-rose-500 border-rose-500/20",
    media: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    baixa: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  };

  return (
    <Card className="border-black/5 dark:border-border bg-card/40 rounded-2xl overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
              <CheckSquare className="h-4 w-4" />
            </div>
            <span className="text-sm font-black">Tarefas Pendentes</span>
          </div>
          <Button variant="ghost" size="sm"
            className="text-xs font-bold text-primary hover:bg-primary/10 rounded-xl h-7 px-2.5 gap-1"
            onClick={() => navigate("/tarefas")}
          >
            Ver todas <ArrowRight className="h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="px-5 pb-4 pt-1">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-black/[0.03] dark:bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : tarefas.length === 0 ? (
          <div className="flex items-center justify-between py-3 px-1">
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold">Nenhuma tarefa pendente</span>
            </div>
            <Button variant="outline" size="sm"
              className="h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-black/5 dark:border-border gap-1"
              onClick={() => navigate("/tarefas")}
            >
              <Plus className="h-3 w-3" /> Nova tarefa
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {tarefas.map(t => {
              const p = t.prioridade || 'media';
              return (
                <div key={t.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-muted/10 hover:bg-muted/20 transition-all group"
                >
                  <button
                    onClick={() => concluir(t.id)}
                    disabled={concluindo === t.id}
                    className="shrink-0 h-4 w-4 rounded border border-muted-foreground/30 hover:border-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center justify-center group-hover:border-emerald-500/50"
                  >
                    {concluindo === t.id && (
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    )}
                  </button>
                  <span className="flex-1 text-xs font-semibold truncate">{t.titulo}</span>
                  {t.data_vencimento && (
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">
                      {new Date(t.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })}
                    </span>
                  )}
                  <span className={cn("text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border shrink-0", prioColor[p] || prioColor.media)}>
                    {p}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
