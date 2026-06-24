import { ArrowLeft, UserCheck, Mail, Phone, Calendar, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "./CrmUtils";
import { ClienteComProcessos } from "@/types/database";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onBack: () => void;
  tipo: "todos" | "quentes";
  data?: ClienteComProcessos[];
  refresh?: () => Promise<void>;
}

export function CrmLeadsList({ onBack, tipo, data = [], refresh }: Props) {
  const isQuentes = tipo === "quentes";
  const { user } = useAuth();
  const { toast } = useToast();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="rounded-xl h-12 w-12 p-0 border border-black/5 dark:border-white/5 hover:bg-primary/10 hover:text-primary transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">
              {isQuentes ? 'Leads Quentes' : 'Explorar Leads'}
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              {isQuentes ? 'Prioridade alta para conversão' : 'Gestão completa da base de prospecção'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 p-1.5 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
          <Badge variant="outline" className="rounded-xl border-none font-bold px-4 py-2 bg-background shadow-sm">
            {data.length} Registros
          </Badge>
        </div>
      </div>
      
      <Card className="glass-card border-black/5 dark:border-white/5 overflow-hidden rounded-[2rem]">
        <CardHeader className="border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
          <div className="flex items-center gap-3">
             <div className={cn("p-2 rounded-xl", isQuentes ? "bg-red-500/10 text-red-600" : "bg-primary/10 text-primary")}>
                <Target className="h-5 w-5" />
             </div>
             <div>
                <CardTitle className="text-xl font-extrabold tracking-tight">
                  {isQuentes ? 'Leads Prioritários' : 'Base de Leads'}
                </CardTitle>
                <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-60">
                  {isQuentes ? 'Atenção imediata recomendada' : 'Acompanhamento do pipeline'}
                </CardDescription>
             </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {data.length > 0 ? (
              data.map((lead: any) => (
                <div key={lead.id} className="flex flex-col lg:flex-row lg:items-center justify-between p-6 hover:bg-primary/[0.02] transition-all gap-6 group">
                  <div className="flex items-center space-x-4">
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all group-hover:scale-105", getStatusColor(lead.status))}>
                      <UserCheck className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                      <div className="font-black text-lg text-foreground group-hover:text-primary transition-colors">{lead.nome}</div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">{lead.origem || 'Origem não informada'}</div>
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                        <div className="text-xs font-medium text-muted-foreground/60">
                          Criado em {lead.created_at ? format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR }) : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-4 lg:gap-8">
                      {lead.email && (
                        <div className="flex items-center text-sm font-bold text-muted-foreground/80">
                          <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 mr-3 group-hover:text-primary transition-colors">
                            <Mail className="h-4 w-4" />
                          </div>
                          <span className="truncate max-w-[150px]">{lead.email}</span>
                        </div>
                      )}
                      {lead.telefone && (
                        <div className="flex items-center text-sm font-bold text-muted-foreground/80">
                          <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 mr-3 group-hover:text-primary transition-colors">
                            <Phone className="h-4 w-4" />
                          </div>
                          {lead.telefone}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between lg:justify-end gap-4 min-w-[120px]">
                      <Badge className={cn("px-4 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest border-2", getStatusColor(lead.status))}>
                        {lead.status}
                      </Badge>
                      <div className="flex gap-2">
                        {lead.status !== "convertido" && (
                          <Button 
                            onClick={async () => {
                              try {
                                if (!user?.office_id) throw new Error("Escritório não identificado");
                                
                                const { supabase } = await import("@/integrations/supabase/client");
                                const { error } = await supabase
                                  .from('clientes')
                                  .update({ status: 'convertido' })
                                  .eq('id', lead.id)
                                  .eq('office_id', user.office_id);
                                
                                if (error) throw error;
                                
                                toast({
                                  title: "Lead convertido!",
                                  description: `${lead.nome} agora é um cliente.`,
                                });
                                
                                if (refresh) await refresh();
                              } catch (err) {
                                console.error(err);
                                toast({
                                  title: "Erro na conversão",
                                  description: "Não foi possível converter o lead.",
                                  variant: "destructive"
                                });
                              }
                            }}
                            variant="ghost" 
                            size="sm" 
                            className="rounded-xl border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all font-bold"
                          >
                            Converter
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="rounded-xl border-black/5 dark:border-white/5 hover:bg-primary hover:text-white transition-all font-bold">
                          Gerenciar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-20 text-center space-y-4">
                <div className="w-20 h-20 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <UserCheck className="h-10 w-10 text-muted-foreground/20" />
                </div>
                <h3 className="text-xl font-bold">Nenhum registro encontrado</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  Não existem leads correspondentes a esta categoria no momento.
                </p>
                <Button variant="outline" onClick={onBack} className="rounded-xl mt-4">
                  Voltar ao Dashboard
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

