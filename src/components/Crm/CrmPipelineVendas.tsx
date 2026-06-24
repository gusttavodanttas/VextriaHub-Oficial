import { ArrowLeft, BarChart3, TrendingUp, DollarSign, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClienteComProcessos } from "@/types/database";
import { cn } from "@/lib/utils";

interface Props {
  onBack: () => void;
  data?: ClienteComProcessos[];
  loading?: boolean;
}

export function CrmPipelineVendas({ onBack, data = [], loading = false }: Props) {
  const leads = data.filter(c => ["lead", "quente", "morno", "frio"].includes((c.status || "").toLowerCase()));
  const confirmedValue = data.filter(c => (c.status || "").toLowerCase() === "convertido").length * 2.5; // Mock value per converted lead
  const potentialValue = leads.length * 1.5; // Mock value per lead
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="rounded-xl h-12 w-12 p-0 border border-black/5 dark:border-white/5 hover:bg-primary/10 transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Receita Potencial</h2>
            <p className="text-sm text-muted-foreground font-medium">Previsibilidade e ROI do pipeline</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
          <CardHeader className="border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
            <CardTitle className="text-xl font-extrabold tracking-tight">Pipeline Ativo</CardTitle>
            <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-60">Leads em negociação</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[400px] overflow-y-auto">
              {loading ? (
                 <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/20" /></div>
              ) : leads.length > 0 ? (
                leads.map((opp: any) => (
                  <div key={opp.id} className="flex items-center justify-between p-5 hover:bg-primary/[0.02] transition-all group">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
                          <BarChart3 className="h-5 w-5 text-primary" />
                       </div>
                       <div>
                        <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{opp.nome}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-medium">{opp.origem || 'Lead Direto'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-sm text-primary">R$ 1.500</div>
                      <div className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-tighter">Prob. 65%</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-muted-foreground text-sm font-medium">Nenhum lead no pipeline.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden flex flex-col">
          <CardHeader className="border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
            <CardTitle className="text-xl font-extrabold tracking-tight">Resumo Financeiro</CardTitle>
            <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-60">Projeção de faturamento</CardDescription>
          </CardHeader>
          <CardContent className="p-8 flex-1 flex flex-col justify-center space-y-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-emerald-500/20 rounded-lg"><DollarSign className="h-4 w-4 text-emerald-600" /></div>
                   <span className="text-xs font-black uppercase tracking-widest text-emerald-600/80">Receita Confirmada</span>
                </div>
                <span className="text-xl font-black text-emerald-600">R$ {confirmedValue.toFixed(1)}k</span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-blue-500/20 rounded-lg"><TrendingUp className="h-4 w-4 text-blue-600" /></div>
                   <span className="text-xs font-black uppercase tracking-widest text-blue-600/80">Receita Potencial</span>
                </div>
                <span className="text-xl font-black text-blue-600">R$ {potentialValue.toFixed(1)}k</span>
              </div>
            </div>

            <div className="pt-8 border-t border-black/5 dark:border-white/5">
              <div className="flex justify-between items-center px-2">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Pipeline</span>
                <span className="text-4xl font-black text-gradient">R$ {(confirmedValue + potentialValue).toFixed(1)}k</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

