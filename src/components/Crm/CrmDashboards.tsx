import { ArrowLeft, UserCheck, Target, TrendingUp, BarChart3, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "./CrmUtils";
import { ClienteComProcessos } from "@/types/database";
import { cn } from "@/lib/utils";
import { format, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BaseProps {
  onBack: () => void;
  data?: ClienteComProcessos[];
  loading?: boolean;
}

export function CrmRelatorios({ onBack, data = [], loading = false }: BaseProps) {
  const leadsStatuses = ["lead", "quente", "morno", "frio"];
  const conversionStatuses = ["convertido"];
  
  const leads = data.filter(c => leadsStatuses.includes((c.status || "").toLowerCase()));
  const clients = data.filter(c => conversionStatuses.includes((c.status || "").toLowerCase()));
  
  const crmTotal = leads.length + clients.length;
  const conversionRate = crmTotal > 0 ? Math.round((clients.length / crmTotal) * 100) : 0;
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="rounded-xl h-12 w-12 p-0 border border-black/5 dark:border-white/5 hover:bg-primary/10 transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Relatórios de Performance</h2>
            <p className="text-sm text-muted-foreground font-medium">Análise inteligente da sua base comercial</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground opacity-60">Performance Geral</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Loader2 className="h-8 w-8 animate-spin text-primary/20" /> : (
              <>
                <div className="text-4xl font-black text-emerald-500">{conversionRate}%</div>
                <p className="text-xs font-bold text-muted-foreground mt-1">Taxa de conversão atual</p>
                <div className="mt-4 flex items-center gap-4 pt-4 border-t border-black/5 dark:border-white/5">
                  <div className="text-[10px] font-black uppercase tracking-tighter bg-primary/5 text-primary px-2 py-1 rounded-lg">
                    {leads.length} LEADS ATIVOS
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-tighter bg-emerald-500/5 text-emerald-600 px-2 py-1 rounded-lg">
                    {clients.length} CLIENTES
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground opacity-60">Volume de Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
             {loading ? <Loader2 className="h-8 w-8 animate-spin text-primary/20" /> : (
              <>
                <div className="text-4xl font-black text-primary">R$ {leads.length * 1.5}k</div>
                <p className="text-xs font-bold text-muted-foreground mt-1">Ticket médio estimado</p>
                <div className="mt-4 flex items-center gap-2 pt-4 border-t border-black/5 dark:border-white/5">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase">Crescimento constante</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground opacity-60">Tempo de Resposta</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-4xl font-black text-blue-500">2.4h</div>
             <p className="text-xs font-bold text-muted-foreground mt-1">Média de atendimento</p>
             <div className="mt-4 flex items-center gap-2 pt-4 border-t border-black/5 dark:border-white/5">
               <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
               <span className="text-[10px] font-bold text-blue-500 uppercase">Benchmark setado</span>
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
        <CardHeader className="border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
          <CardTitle className="text-xl font-extrabold tracking-tight">Desempenho de Aquisição</CardTitle>
          <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-60">Últimos leads integrados ao sistema</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {loading ? (
               <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/20" /></div>
            ) : leads.length > 0 ? (
              leads.slice(0, 5).map((lead: any) => (
                <div key={lead.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-primary/[0.02] transition-all gap-4 group">
                  <div className="flex items-center space-x-4">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border-2", getStatusColor(lead.status))}>
                      <UserCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-black text-base text-foreground group-hover:text-primary transition-colors">{lead.nome}</div>
                      <div className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">{lead.origem || 'Indireta'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className={cn("px-3 py-1 text-[10px] font-black uppercase tracking-widest", getStatusColor(lead.status))}>
                      {lead.status}
                    </Badge>
                    <div className="text-[10px] font-bold text-muted-foreground/40 text-right">
                      {lead.created_at ? format(new Date(lead.created_at), "dd MMM HH:mm", { locale: ptBR }) : '—'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-muted-foreground text-sm font-medium">Nenhum dado disponível para análise.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function CrmMetas({ onBack, data = [], loading = false }: BaseProps) {
  const now = new Date();
  const leadsThisMonth = data.filter(c => 
    c.status && 
    ["lead", "quente", "morno", "frio"].includes(c.status.toLowerCase()) && 
    c.created_at && 
    isSameMonth(new Date(c.created_at), now)
  ).length;
  
  const conversionsThisMonth = data.filter(c => 
    c.status && 
    c.status.toLowerCase() === "convertido" && 
    c.created_at && 
    isSameMonth(new Date(c.created_at), now)
  ).length;
  
  const leadTarget = 20;
  const convTarget = 10;
  
  const leadProgress = Math.min(100, Math.round((leadsThisMonth / leadTarget) * 100));
  const convProgress = Math.min(100, Math.round((conversionsThisMonth / convTarget) * 100));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="rounded-xl h-12 w-12 p-0 border border-black/5 dark:border-white/5 hover:bg-primary/10 transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Metas Comerciais</h2>
            <p className="text-sm text-muted-foreground font-medium">Acompanhamento do progresso mensal</p>
          </div>
        </div>
      </div>
      
      <Card className="glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
        <CardHeader className="border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
          <CardTitle className="text-xl font-extrabold tracking-tight">Objetivos de {format(now, "MMMM", { locale: ptBR })}</CardTitle>
          <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-60">Status de aquisição e fechamento</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-10">
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-60">Novos Leads</span>
                <p className="text-2xl font-black text-primary">{leadsThisMonth} <span className="text-sm text-muted-foreground/40 font-bold">/ {leadTarget}</span></p>
              </div>
              <span className="text-sm font-black text-primary">{leadProgress}%</span>
            </div>
            <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-4 p-1 overflow-hidden border border-black/5 dark:border-white/5">
              <div 
                className="bg-primary h-full rounded-full shadow-[0_0_15px_rgba(var(--primary),0.5)] transition-all duration-1000" 
                style={{ width: `${leadProgress}%` }}
              ></div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-60">Conversões Ativas</span>
                <p className="text-2xl font-black text-emerald-500">{conversionsThisMonth} <span className="text-sm text-muted-foreground/40 font-bold">/ {convTarget}</span></p>
              </div>
              <span className="text-sm font-black text-emerald-500">{convProgress}%</span>
            </div>
            <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-4 p-1 overflow-hidden border border-black/5 dark:border-white/5">
              <div 
                className="bg-emerald-500 h-full rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-1000" 
                style={{ width: `${convProgress}%` }}
              ></div>
            </div>
          </div>

          <div className="pt-6 border-t border-black/5 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 relative overflow-hidden group">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">ROI Projetado (Volume x 1.2)</p>
                <p className="text-2xl font-black">{(leadsThisMonth * 1.2).toFixed(1)}x</p>
                <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:opacity-10 transition-opacity">
                  <TrendingUp className="h-12 w-12" />
                </div>
             </div>
             <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 relative overflow-hidden group">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500/60">Tempo Médio Resposta</p>
                <p className="text-2xl font-black">2.4h</p>
                <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:opacity-10 transition-opacity">
                  <TrendingUp className="h-12 w-12" />
                </div>
             </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


export function CrmEmailMarketing({ onBack }: BaseProps) {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao CRM
        </Button>
        <div className="w-full sm:w-auto">
          <h2 className="text-xl md:text-2xl font-bold">E-mail Marketing</h2>
          <p className="text-sm md:text-base text-muted-foreground">Campanhas automatizadas</p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Campanhas Ativas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-3">
              <div className="flex-1">
                <div className="font-medium text-sm md:text-base">Campanha de Nutrição</div>
                <div className="text-xs md:text-sm text-muted-foreground">Taxa de abertura: 24%</div>
              </div>
              <Badge className="bg-green-100 text-green-800 w-fit">Ativo</Badge>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-3">
              <div className="flex-1">
                <div className="font-medium text-sm md:text-base">Newsletter Semanal</div>
                <div className="text-xs md:text-sm text-muted-foreground">Taxa de abertura: 18%</div>
              </div>
              <Badge className="bg-blue-100 text-blue-800 w-fit">Agendado</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function CrmFollowUp({ onBack }: BaseProps) {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao CRM
        </Button>
        <div className="w-full sm:w-auto">
          <h2 className="text-xl md:text-2xl font-bold">Follow-up</h2>
          <p className="text-sm md:text-base text-muted-foreground">Lembretes automáticos</p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Próximos Follow-ups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-3">
              <div className="flex-1">
                <div className="font-medium text-sm md:text-base">João Silva - Tech Corp</div>
                <div className="text-xs md:text-sm text-muted-foreground">Agendar reunião de apresentação</div>
              </div>
              <div className="text-xs md:text-sm text-muted-foreground">Hoje, 14:00</div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-3">
              <div className="flex-1">
                <div className="font-medium text-sm md:text-base">Maria Santos - Legal Firm</div>
                <div className="text-xs md:text-sm text-muted-foreground">Enviar proposta comercial</div>
              </div>
              <div className="text-xs md:text-sm text-muted-foreground">Amanhã, 09:00</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
