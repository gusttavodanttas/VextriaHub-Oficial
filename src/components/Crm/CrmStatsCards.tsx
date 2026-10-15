// Os 4 cards de resumo do CRM (extraídos de pages/Crm.tsx).
import { UserCheck, Phone, TrendingUp, BarChart3, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/currency";

interface Props {
  loading: boolean;
  /** Com erro na base os números viram "—". */
  erro: boolean;
  leadsCount: number;
  hotLeadsCount: number;
  conversionRate: number;
  pipelineValue: number;
  /** Abre a tela específica (leads, leads-quentes, receita-potencial). */
  onCardClick: (view: string) => void;
  /** Card "Sucesso Conversão" leva à aba de convertidos. */
  onConvertidos: () => void;
}

export function CrmStatsCards({ loading, erro, leadsCount, hotLeadsCount, conversionRate, pipelineValue, onCardClick, onConvertidos }: Props) {
  const brl = (v: number) => formatBRL(v, { decimals: 0 });
  const valor = (v: React.ReactNode) => (loading ? <Loader2 className="h-8 w-8 animate-spin" /> : erro ? "—" : v);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="glass-card p-6 rounded-[2rem] shadow-premium border-black/5 dark:border-border hover-lift group cursor-pointer" onClick={() => onCardClick("leads")}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Base Total</p>
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <UserCheck className="h-5 w-5 text-primary" />
          </div>
        </div>
        <p className="text-4xl font-black text-foreground">{valor(leadsCount)}</p>
        <p className="text-xs font-bold text-muted-foreground/40 mt-2 uppercase tracking-tighter">Leads em observação</p>
      </div>
      
      <div className="glass-card p-6 rounded-[2rem] shadow-premium border-black/5 dark:border-border hover-lift group cursor-pointer" onClick={() => onCardClick("leads-quentes")}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Leads Quentes</p>
          <div className="p-2.5 bg-orange-500/10 rounded-xl">
            <Phone className="h-5 w-5 text-orange-500" />
          </div>
        </div>
        <p className="text-4xl font-black text-orange-500">{valor(hotLeadsCount)}</p>
        <p className="text-xs font-bold text-muted-foreground/40 mt-2 uppercase tracking-tighter">Potencial de contrato imediato</p>
      </div>

      <div className="glass-card p-6 rounded-[2rem] shadow-premium border-black/5 dark:border-border hover-lift group cursor-pointer" onClick={onConvertidos}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Sucesso Conversão</p>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
        </div>
        <p className="text-4xl font-black text-emerald-500">{valor(`${conversionRate}%`)}</p>
        <p className="text-xs font-bold text-muted-foreground/40 mt-2 uppercase tracking-tighter">Convertidos sobre o total da base</p>
      </div>

      <div className="glass-card p-6 rounded-[2rem] shadow-premium border-black/5 dark:border-border hover-lift group cursor-pointer" onClick={() => onCardClick("receita-potencial")}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Valor Pipeline</p>
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
        </div>
        <p className="text-3xl font-black text-gradient truncate">{valor(brl(pipelineValue))}</p>
        <p className="text-xs font-bold text-muted-foreground/40 mt-2 uppercase tracking-tighter">Soma do valor estimado dos leads</p>
      </div>
    </div>
  );
}
