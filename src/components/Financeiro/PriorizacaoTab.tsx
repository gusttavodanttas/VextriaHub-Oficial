// Aba "Priorização" (extraída de pages/Financeiro.tsx): despesas em aberto
// agrupadas pelos grupos de prioridade configurados pelo escritório.
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  NONE, fmt, statusConfig, escopoConfig, prioridadeAccentClassName, valorPago, saldoRestante,
  type FinanceiroItem, type PrioridadeGrupo,
} from "./shared";
import { EmptyState, LoadingSkeleton, RegistrarPagamentoPopover } from "./FinanceiroRow";
import { SEM_CLASSIFICACAO, somaGrupo } from "./calculos";

interface Props {
  loading: boolean;
  pendentesPagar: FinanceiroItem[];
  pendentesPorGrupo: Record<string, FinanceiroItem[]>;
  gruposPrioridade: PrioridadeGrupo[];
  loadingId: string | null;
  onNovaDespesa: () => void;
  onPrioridadeChange: (id: string, prioridade: string | null) => void;
  onRegistrarPagamento: (item: FinanceiroItem, valor: number) => void;
}

export function PriorizacaoTab({
  loading, pendentesPagar, pendentesPorGrupo, gruposPrioridade, loadingId, onNovaDespesa, onPrioridadeChange, onRegistrarPagamento,
}: Props) {
  if (loading) return <LoadingSkeleton />;
  if (pendentesPagar.length === 0) {
    return <EmptyState label="Nenhuma despesa pendente para priorizar" onNew={onNovaDespesa} />;
  }
  const grupos = [
    ...gruposPrioridade.map((g, i) => ({ key: g.id, label: g.label, accent: prioridadeAccentClassName(i) })),
    { key: SEM_CLASSIFICACAO, label: "Sem Classificação", accent: "border-muted/40 bg-muted/10" },
  ];
  return (
    <>
      {grupos.map(({ key, label, accent }) => {
        const grupoItens = pendentesPorGrupo[key] ?? [];
        return (
          <div key={key} className={cn("rounded-3xl border p-5 space-y-3", accent)}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs font-black uppercase tracking-widest">{label}</p>
              <span className="text-sm font-black tabular-nums">{fmt(somaGrupo(grupoItens))} · {grupoItens.length} conta{grupoItens.length === 1 ? "" : "s"}</span>
            </div>
            {grupoItens.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/60 py-2">Vazio.</p>
            ) : (
              <div className="space-y-2">
                {grupoItens.map((item) => {
                  const escopoCfg = escopoConfig[item.escopo] ?? escopoConfig.pj;
                  return (
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-card/60 rounded-2xl p-3.5 border border-black/5 dark:border-border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm truncate">{item.descricao}</p>
                          <Badge className={cn("px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-widest", escopoCfg.className)}>{escopoCfg.label}</Badge>
                          {item.status === "vencido" && (
                            <Badge className="px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-widest border-red-500/50 text-red-500 bg-red-500/10 font-bold">
                              <AlertCircle className="h-3 w-3 mr-1" />Vencido
                            </Badge>
                          )}
                          {item.status === "parcial" && (
                            <Badge className={cn("px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-widest", statusConfig.parcial.className)}>
                              {fmt(valorPago(item))} de {fmt(item.valor)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Vence em {format(parseISO(item.data_vencimento), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black tabular-nums text-orange-500">{fmt(saldoRestante(item))}</span>
                        <PermissionGuard permission="canManageFinanceiro">
                          <Select value={item.prioridade ?? NONE} onValueChange={(v) => onPrioridadeChange(item.id, v === NONE ? null : v)}>
                            <SelectTrigger className="w-[132px] h-8 rounded-lg text-[10px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Não classificada</SelectItem>
                              {gruposPrioridade.map((g) => (
                                <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <RegistrarPagamentoPopover item={item} loading={loadingId === item.id}
                            onConfirm={(valor) => onRegistrarPagamento(item, valor)}>
                            <Button size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase tracking-wide bg-emerald-500 hover:bg-emerald-600 text-white"
                              disabled={loadingId === item.id}>
                              {loadingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Pagar</>}
                            </Button>
                          </RegistrarPagamentoPopover>
                        </PermissionGuard>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
