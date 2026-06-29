import { ArrowLeft, TrendingUp, Mail, Phone, MessageCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "@/components/Crm/CrmUtils";
import { formatPhone } from "@/lib/phone";
import { onlyDigits } from "@/lib/document";
import { cn } from "@/lib/utils";
import type { ClienteComProcessos } from "@/types/database";

interface Props {
  onBack: () => void;
  onOpportunityClick: (opportunity: any) => void;
  data?: ClienteComProcessos[];
}

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export function CrmOportunidades({ onBack, onOpportunityClick, data = [] }: Props) {
  // Oportunidades = leads qualificados (quente/morno), ordenados por valor estimado
  const oportunidades = data
    .filter(c => ["quente", "morno"].includes((c.status || "").toLowerCase()))
    .sort((a, b) => (Number((b as any).valor_estimado) || 0) - (Number((a as any).valor_estimado) || 0));

  const totalValor = oportunidades.reduce((s, o) => s + (Number((o as any).valor_estimado) || 0), 0);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="outline" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao CRM
        </Button>
        <div>
          <h2 className="text-xl md:text-2xl font-black">Oportunidades Ativas</h2>
          <p className="text-sm text-muted-foreground">Leads qualificados (quentes e mornos) — {brl(totalValor)} em potencial</p>
        </div>
      </div>

      <Card className="glass-card border-black/5 dark:border-border rounded-[2rem]">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl font-black">Oportunidades em Andamento ({oportunidades.length})</CardTitle>
          <CardDescription>Leads com maior potencial de fechamento</CardDescription>
        </CardHeader>
        <CardContent>
          {oportunidades.length > 0 ? (
            <div className="space-y-3">
              {oportunidades.map((op: any) => (
                <div
                  key={op.id}
                  className="flex flex-col lg:flex-row lg:items-center justify-between p-4 rounded-2xl border border-black/5 dark:border-border bg-black/[0.02] dark:bg-white/[0.01] hover:bg-primary/[0.03] transition-all gap-3 cursor-pointer group"
                  onClick={() => onOpportunityClick(op)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border-2 shrink-0", getStatusColor(op.status))}>
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-foreground group-hover:text-primary transition-colors truncate">{op.nome}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-0.5">
                        {op.email && <span className="flex items-center text-[11px] font-bold text-muted-foreground/60"><Mail className="h-3 w-3 mr-1 text-primary/50" />{op.email}</span>}
                        {op.telefone && <span className="flex items-center text-[11px] font-bold text-muted-foreground/60"><Phone className="h-3 w-3 mr-1 text-primary/50" />{formatPhone(op.telefone)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {Number(op.valor_estimado) > 0 && (
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{brl(Number(op.valor_estimado))}</span>
                    )}
                    <Badge variant="outline" className={cn("px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg", getStatusColor(op.status))}>{op.status}</Badge>
                    {op.telefone && (
                      <a href={`https://wa.me/55${onlyDigits(op.telefone)}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-emerald-600 dark:text-emerald-400 hover:scale-110 transition-transform" title="WhatsApp">
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto">
                <TrendingUp className="h-7 w-7 text-primary/30" />
              </div>
              <p className="font-bold">Nenhuma oportunidade qualificada</p>
              <p className="text-sm text-muted-foreground">Marque leads como <strong>quente</strong> ou <strong>morno</strong> para vê-los aqui.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
