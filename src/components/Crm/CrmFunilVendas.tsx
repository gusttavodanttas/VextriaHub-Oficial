import { ArrowLeft, UserCheck, Target, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "./CrmUtils";
import { ClienteComProcessos } from "@/types/database";
import { cn } from "@/lib/utils";

interface Props {
  onBack: () => void;
  data?: ClienteComProcessos[];
  loading?: boolean;
}

export function CrmFunilVendas({ onBack, data = [], loading = false }: Props) {
  const prospeccaoCount = data.filter(c => (c.status || "").toLowerCase() === "lead").length;
  const qualificacaoCount = data.filter(c => ["frio", "morno"].includes((c.status || "").toLowerCase())).length;
  const negociacaoCount = data.filter(c => (c.status || "").toLowerCase() === "quente").length;
  const fechamentoCount = data.filter(c => (c.status || "").toLowerCase() === "convertido").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="rounded-xl h-12 w-12 p-0 border border-black/5 dark:border-white/5 hover:bg-primary/10 transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Funil de Vendas</h2>
            <p className="text-sm text-muted-foreground font-medium">Fluxo de conversão e pipeline estratégico</p>
          </div>
        </div>
      </div>
      
      <Card className="glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
        <CardHeader className="border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
          <CardTitle className="text-xl font-extrabold tracking-tight text-center">Pipeline de Conversão</CardTitle>
          <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-60 text-center">Acompanhe o progresso dos leads pelo funil</CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 relative">
            {/* Visual connector for desktop */}
            <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500/10 via-orange-500/10 to-emerald-500/10 -translate-y-1/2 -z-10" />

            <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 text-center hover:bg-blue-500/10 transition-colors group">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Prospecção</h4>
              <div className="text-4xl font-black text-blue-600 group-hover:scale-110 transition-transform">
                {loading ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> : prospeccaoCount}
              </div>
              <p className="text-[10px] font-bold text-blue-400 mt-1 uppercase">Novos Leads</p>
            </div>

            <div className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 text-center hover:bg-indigo-500/10 transition-colors group">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2">Qualificação</h4>
              <div className="text-4xl font-black text-indigo-600 group-hover:scale-110 transition-transform">
                 {loading ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> : qualificacaoCount}
              </div>
              <p className="text-[10px] font-bold text-indigo-400 mt-1 uppercase">Em análise</p>
            </div>

            <div className="p-6 rounded-3xl bg-orange-500/5 border border-orange-500/10 text-center hover:bg-orange-500/10 transition-colors group">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-2">Negociação</h4>
              <div className="text-4xl font-black text-orange-600 group-hover:scale-110 transition-transform">
                 {loading ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> : negociacaoCount}
              </div>
              <p className="text-[10px] font-bold text-orange-400 mt-1 uppercase">Propostas Ativas</p>
            </div>

            <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 text-center hover:bg-emerald-500/10 transition-colors group">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">Fechamento</h4>
              <div className="text-4xl font-black text-emerald-600 group-hover:scale-110 transition-transform">
                 {loading ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> : fechamentoCount}
              </div>
              <p className="text-[10px] font-bold text-emerald-400 mt-1 uppercase">Convertidos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
        <CardHeader className="border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
          <CardTitle className="text-xl font-extrabold tracking-tight">Leads por Estágio</CardTitle>
          <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-60">Visualização detalhada das fases de venda</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {['lead', 'morno', 'quente', 'convertido'].map((stage) => {
              const stageLeads = data.filter(c => (c.status || "").toLowerCase() === stage);
              const stageNames: Record<string, string> = {
                lead: 'Prospecção Inicial',
                morno: 'Qualificação / Interesse',
                quente: 'Negociação Avançada',
                convertido: 'Clientes Convertidos'
              };
              
              if (stageLeads.length > 0) {
                return (
                  <div key={stage} className="border border-black/5 dark:border-white/5 rounded-2xl p-4 bg-black/[0.01] dark:bg-white/[0.01]">
                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                       <div className={cn("w-2 h-2 rounded-full", getStatusColor(stage))} />
                       {stageNames[stage]} ({stageLeads.length})
                    </h4>
                    <div className="space-y-2">
                      {stageLeads.map((lead: any) => (
                        <div key={lead.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-background border border-black/5 dark:border-white/5 rounded-xl gap-2 group hover:border-primary/30 transition-all">
                          <div className="flex items-center space-x-3">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", getStatusColor(lead.status))}>
                              <UserCheck className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{lead.nome}</div>
                              <div className="text-[10px] text-muted-foreground uppercase font-medium">{lead.email || 'Sem email'}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className={cn("px-3 py-0.5 text-[9px] font-black uppercase tracking-widest", getStatusColor(lead.status))}>
                              {lead.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

