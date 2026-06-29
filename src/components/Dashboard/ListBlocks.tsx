import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, CheckSquare, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const pick = (o: any, keys: string[], fb: string) => { for (const k of keys) if (o?.[k]) return String(o[k]); return fb; };
const fmt = (d?: string) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";

function Shell({ icon: Icon, title, to, children }: { icon: any; title: string; to: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-black/5 dark:border-border bg-card/40 p-4 space-y-2.5 h-full">
      <button onClick={() => navigate(to)} className="flex items-center gap-1.5 w-full group">
        <Icon className="h-3 w-3 text-muted-foreground/50" />
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{title}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 ml-auto group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </button>
      {children}
    </div>
  );
}

export function PrazosBlock() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user?.office_id) { setLoading(false); return; }
    let cancel = false;
    supabase.from("prazos").select("*").eq("office_id", user.office_id).neq("status", "concluido")
      .order("data_fim_prazo", { ascending: true, nullsFirst: false }).limit(6)
      .then(({ data }) => { if (!cancel) { setItems(data || []); setLoading(false); } });
    return () => { cancel = true; };
  }, [user?.office_id]);

  return (
    <Shell icon={AlertCircle} title="Próximos Prazos" to="/prazos">
      {loading ? <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-primary/40" /></div>
        : items.length === 0 ? <p className="text-sm text-muted-foreground/50 font-medium py-6 text-center">Nenhum prazo pendente.</p>
          : <div className="space-y-1">
            {items.map((p) => (
              <button key={p.id} onClick={() => navigate(`/prazos?openId=${p.id}`)} className="group flex items-center gap-2.5 p-2 rounded-xl hover:bg-card/80 transition-all w-full text-left">
                <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                <span className="text-xs font-bold truncate flex-1 group-hover:text-primary transition-colors">{pick(p, ["titulo", "tipo_prazo", "numero_processo"], "Prazo")}</span>
                <span className="text-[10px] font-black text-muted-foreground/50 shrink-0">{fmt(p.data_fim_prazo)}</span>
              </button>
            ))}
          </div>}
    </Shell>
  );
}

export function TarefasBlock() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user?.office_id) { setLoading(false); return; }
    let cancel = false;
    supabase.from("tarefas").select("id, titulo, data_vencimento, prioridade").eq("office_id", user.office_id).eq("deletado", false).eq("concluida", false)
      .order("data_vencimento", { ascending: true, nullsFirst: false }).limit(6)
      .then(({ data }) => { if (!cancel) { setItems(data || []); setLoading(false); } });
    return () => { cancel = true; };
  }, [user?.office_id]);

  const cor = (p?: string) => p === "alta" ? "bg-rose-500" : p === "baixa" ? "bg-slate-400" : "bg-amber-500";

  return (
    <Shell icon={CheckSquare} title="Minhas Tarefas" to="/tarefas">
      {loading ? <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-primary/40" /></div>
        : items.length === 0 ? <p className="text-sm text-muted-foreground/50 font-medium py-6 text-center">Nenhuma tarefa pendente.</p>
          : <div className="space-y-1">
            {items.map((t) => (
              <button key={t.id} onClick={() => navigate(`/tarefas?openId=${t.id}`)} className="group flex items-center gap-2.5 p-2 rounded-xl hover:bg-card/80 transition-all w-full text-left">
                <span className={cn("h-2 w-2 rounded-full shrink-0", cor(t.prioridade))} />
                <span className="text-xs font-bold truncate flex-1 group-hover:text-primary transition-colors">{t.titulo || "Tarefa"}</span>
                <span className="text-[10px] font-black text-muted-foreground/50 shrink-0">{fmt(t.data_vencimento)}</span>
              </button>
            ))}
          </div>}
    </Shell>
  );
}
