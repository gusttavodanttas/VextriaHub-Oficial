import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, Loader2, ArrowRight } from "lucide-react";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

interface Bucket { mes: string; receita: number; despesa: number; }

export function MiniFinanceChart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.office_id) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const start = new Date();
      start.setMonth(start.getMonth() - 5);
      start.setDate(1);
      const { data: rows } = await supabase
        .from("financeiro")
        .select("tipo, valor, data_vencimento")
        .eq("office_id", user.office_id)
        .eq("deletado", false)
        .gte("data_vencimento", start.toISOString().slice(0, 10));
      if (cancel) return;

      const buckets: Record<string, Bucket> = {};
      const order: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        buckets[key] = { mes: MESES[d.getMonth()], receita: 0, despesa: 0 };
        order.push(key);
      }
      (rows || []).forEach((r: any) => {
        const d = new Date(r.data_vencimento);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (!buckets[key]) return;
        if (r.tipo === "receita") buckets[key].receita += Number(r.valor) || 0;
        else buckets[key].despesa += Number(r.valor) || 0;
      });
      setData(order.map((k) => buckets[k]));
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user?.office_id]);

  const totais = useMemo(() => {
    const receita = data.reduce((s, d) => s + d.receita, 0);
    const despesa = data.reduce((s, d) => s + d.despesa, 0);
    const mesAtual = data[data.length - 1];
    return { receita, despesa, saldo: receita - despesa, mesAtual };
  }, [data]);

  const temDados = data.some((d) => d.receita > 0 || d.despesa > 0);

  return (
    <div className="rounded-2xl border border-black/5 dark:border-border bg-card/40 p-4 flex flex-col h-full min-h-[320px]">
      <button onClick={() => navigate("/financeiro")} className="flex items-center gap-1.5 group w-full text-left">
        <TrendingUp className="h-3 w-3 text-muted-foreground/50" />
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Receita x Despesa · 6 meses</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 ml-auto group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </button>

      {/* Totais do período */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-2.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/60">Receita</p>
          <p className="text-sm md:text-base font-black text-emerald-600 truncate">{brl(totais.receita)}</p>
        </div>
        <div className="rounded-xl bg-rose-500/5 border border-rose-500/10 p-2.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-rose-600/60">Despesa</p>
          <p className="text-sm md:text-base font-black text-rose-600 truncate">{brl(totais.despesa)}</p>
        </div>
        <div className="rounded-xl bg-primary/5 border border-primary/10 p-2.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">Saldo</p>
          <p className={`text-sm md:text-base font-black truncate ${totais.saldo >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{brl(totais.saldo)}</p>
        </div>
      </div>

      {/* Gráfico — preenche o espaço restante */}
      <div className="flex-1 min-h-[160px] mt-3">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-primary/40" /></div>
        ) : !temDados ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/40">
            <TrendingUp className="h-7 w-7 opacity-40" />
            <p className="text-sm font-medium">Sem lançamentos no período</p>
            <button onClick={() => navigate("/financeiro")} className="text-[11px] font-black uppercase tracking-widest text-primary/70 hover:text-primary">Adicionar lançamento</button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={4} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                formatter={(v: number, n: string) => [brl(v), n === "receita" ? "Receita" : "Despesa"]}
              />
              <Bar dataKey="receita" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Bar dataKey="despesa" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
