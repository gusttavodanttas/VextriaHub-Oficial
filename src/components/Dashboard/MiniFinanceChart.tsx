import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, Loader2 } from "lucide-react";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

interface Bucket { mes: string; receita: number; despesa: number; }

export function MiniFinanceChart() {
  const { office } = useAuth();
  const [data, setData] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!office?.id) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const start = new Date();
      start.setMonth(start.getMonth() - 5);
      start.setDate(1);
      const { data: rows } = await supabase
        .from("financeiro")
        .select("tipo, valor, data_vencimento")
        .eq("office_id", office.id)
        .eq("deletado", false)
        .gte("data_vencimento", start.toISOString().slice(0, 10));
      if (cancel) return;

      // 6 buckets contínuos
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
  }, [office?.id]);

  const temDados = data.some((d) => d.receita > 0 || d.despesa > 0);

  return (
    <div className="rounded-2xl border border-black/5 dark:border-border bg-card/40 p-4 space-y-3 h-full">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3" /> Receita x Despesa · 6 meses
      </p>
      {loading ? (
        <div className="flex items-center justify-center h-[180px]"><Loader2 className="h-5 w-5 animate-spin text-primary/40" /></div>
      ) : !temDados ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground/50 font-medium">Sem lançamentos no período.</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} barGap={4} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
              contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
              formatter={(v: number, n: string) => [brl(v), n === "receita" ? "Receita" : "Despesa"]}
            />
            <Bar dataKey="receita" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="despesa" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
