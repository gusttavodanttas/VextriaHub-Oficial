
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  FileText,
  CreditCard,
  AlertCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getInitialData } from "@/utils/initialData";
import { cn } from "@/lib/utils";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";

const Financeiro = () => {
  const { isFirstLogin } = useAuth();
  
  const mockContasReceber = [
    { id: 1, cliente: "João Silva", valor: 2500, vencimento: "2025-01-15", status: "pendente" },
    { id: 2, cliente: "Maria Santos", valor: 1800, vencimento: "2025-01-20", status: "vencido" },
    { id: 3, cliente: "Empresa ABC", valor: 5000, vencimento: "2025-01-25", status: "pendente" },
  ];

  const mockContasPagar = [
    { id: 1, fornecedor: "Escritório Virtual", valor: 800, vencimento: "2025-01-10", status: "pago" },
    { id: 2, fornecedor: "Material de Escritório", valor: 350, vencimento: "2025-01-18", status: "pendente" },
    { id: 3, fornecedor: "Software Jurídico", valor: 1200, vencimento: "2025-01-22", status: "pendente" },
  ];

  const contasReceber = getInitialData(mockContasReceber, isFirstLogin);
  const contasPagar = getInitialData(mockContasPagar, isFirstLogin);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pago': return 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10 font-bold';
      case 'pendente': return 'border-yellow-500/50 text-yellow-500 bg-yellow-500/10 font-bold';
      case 'vencido': return 'border-red-500/50 text-red-500 bg-red-500/10 font-bold';
      default: return 'border-muted/30 text-muted-foreground bg-muted/10';
    }
  };

  return (
    <PermissionGuard permission="canViewFinanceiro" showDeniedMessage>
    <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-12 overflow-x-hidden entry-animate">
      {/* Page Header Moderno */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <DollarSign className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">
              Gestão Financeira
            </h1>
          </div>
          <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl">
            Visualize o fluxo de caixa, honários e a saúde financeira estratégica do seu escritório.
          </p>
        </div>
        
        <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 shadow-premium">
          <Button 
            size="lg"
            className="rounded-xl shadow-premium h-12 px-8 font-black uppercase text-xs tracking-widest bg-primary hover:bg-primary/90"
          >
            <TrendingUp className="mr-2 h-5 w-5" />
            Exportar Fluxo
          </Button>
        </div>
      </div>

      {/* Cards de Resumo Premium */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-3xl shadow-premium border border-black/5 dark:border-white/10 bg-card/40 backdrop-blur-xl hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Receita Mensal</p>
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
          <p className="text-3xl font-black text-foreground tracking-tighter">R$ 28.500</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-widest">+12% vs mês anterior</span>
          </div>
        </div>
        
        <div className="glass-card p-6 rounded-3xl shadow-premium border border-black/5 dark:border-white/10 bg-card/40 backdrop-blur-xl hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">A Receber</p>
            <div className="p-2 bg-primary/10 rounded-xl">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-3xl font-black text-foreground tracking-tighter">R$ 9.300</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mt-2">3 faturas pendentes</p>
        </div>

        <div className="glass-card p-6 rounded-3xl shadow-premium border border-black/5 dark:border-white/10 bg-card/40 backdrop-blur-xl hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">A Pagar</p>
            <div className="p-2 bg-orange-500/10 rounded-xl">
              <TrendingDown className="h-5 w-5 text-orange-500" />
            </div>
          </div>
          <p className="text-3xl font-black text-foreground tracking-tighter">R$ 1.550</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mt-2">2 vencimentos próximos</p>
        </div>

        <div className="glass-card p-6 rounded-3xl shadow-premium border border-black/5 dark:border-white/10 bg-card/40 backdrop-blur-xl hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Saldo Líquido</p>
            <div className="p-2 bg-primary/10 rounded-xl">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-3xl font-black text-primary tracking-tighter">R$ 26.950</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-primary/60 mt-2">Eficiência de 94.6%</p>
        </div>
      </div>

      {/* Tabs para Contas */}
      <Tabs defaultValue="receber" className="w-full space-y-8">
        <div className="glass-card p-2 rounded-3xl inline-flex h-auto border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 shadow-inner">
          <TabsList className="bg-transparent h-auto p-0 gap-1">
            <TabsTrigger value="receber" className="rounded-2xl px-10 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg shadow-primary/20 transition-all">
              Contas a Receber
            </TabsTrigger>
            <TabsTrigger value="pagar" className="rounded-2xl px-10 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg shadow-primary/20 transition-all">
              Contas a Pagar
            </TabsTrigger>
          </TabsList>
        </div>

          <TabsContent value="receber" className="space-y-6 entry-animate slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-2xl font-black tracking-tight">Contas a Receber</h3>
              <Button className="rounded-xl font-black uppercase text-[10px] tracking-widest px-6 h-11 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all">
                Nova Cobrança
              </Button>
            </div>
            
            <div className="grid gap-6">
              {contasReceber.map((conta) => (
                <div key={conta.id} className="glass-card hover-lift p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl shadow-premium group">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div className="flex items-center gap-6">
                      <div className="h-16 w-16 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/10 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500">
                        <TrendingUp className="h-8 w-8" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-black text-2xl group-hover:text-primary transition-colors duration-500 tracking-tight">{conta.cliente}</p>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-bold">
                          <span className="flex items-center gap-2 bg-black/[0.03] dark:bg-white/5 px-3 py-1.5 rounded-xl border border-black/5 dark:border-white/10 uppercase tracking-widest text-[9px]">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            Vence {conta.vencimento}
                          </span>
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                          <span className="uppercase tracking-widest text-[9px] font-black opacity-40">Honorários Contratuais</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between w-full lg:w-auto gap-10 border-t lg:border-t-0 border-black/5 dark:border-white/5 pt-6 lg:pt-0">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-40">Valor Total</p>
                        <p className="text-3xl font-black tracking-tighter">R$ {conta.valor.toLocaleString()}</p>
                      </div>
                      <Badge className={cn("px-6 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm", getStatusColor(conta.status))}>
                        {conta.status === 'vencido' && <AlertCircle className="h-3.5 w-3.5 mr-2" />}
                        {conta.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pagar" className="space-y-6 entry-animate slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-2xl font-black tracking-tight">Contas a Pagar</h3>
              <Button className="rounded-xl font-black uppercase text-[10px] tracking-widest px-6 h-11 bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 transition-all">
                Nova Despesa
              </Button>
            </div>
            
            <div className="grid gap-6">
              {contasPagar.map((conta) => (
                <div key={conta.id} className="glass-card hover-lift p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl shadow-premium group">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div className="flex items-center gap-6">
                      <div className="h-16 w-16 rounded-3xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/10 group-hover:bg-orange-500 group-hover:text-white transition-all duration-500">
                        <TrendingDown className="h-8 w-8" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-black text-2xl group-hover:text-primary transition-colors duration-500 tracking-tight">{conta.fornecedor}</p>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-bold">
                          <span className="flex items-center gap-2 bg-black/[0.03] dark:bg-white/5 px-3 py-1.5 rounded-xl border border-black/5 dark:border-white/10 uppercase tracking-widest text-[9px]">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            Vence {conta.vencimento}
                          </span>
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                          <span className="uppercase tracking-widest text-[9px] font-black opacity-40">Custos Operacionais</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between w-full lg:w-auto gap-10 border-t lg:border-t-0 border-black/5 dark:border-white/5 pt-6 lg:pt-0">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-40">Valor Saída</p>
                        <p className="text-3xl font-black tracking-tighter text-orange-500">- R$ {conta.valor.toLocaleString()}</p>
                      </div>
                      <Badge className={cn("px-6 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm", getStatusColor(conta.status))}>
                        {conta.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
};

export default Financeiro;
