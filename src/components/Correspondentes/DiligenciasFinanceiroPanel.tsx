import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Handshake, CircleDollarSign, MapPin, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBRL } from '@/lib/currency';
import { useCorrespondentes } from '@/hooks/useCorrespondentes';

// Painel-resumo das diligências (custo com correspondentes) para a tela Financeiro.
// Some quando não há diligências, para não poluir.
export const DiligenciasFinanceiroPanel: React.FC = () => {
  const navigate = useNavigate();
  const { correspondentes, diligencias, patchDiligencia } = useCorrespondentes();

  const corrById = useMemo(() => new Map(correspondentes.map((c) => [c.id, c.nome])), [correspondentes]);

  const resumo = useMemo(() => {
    const mesAtual = new Date().toISOString().slice(0, 7); // YYYY-MM
    const aPagar = diligencias.filter((d) => d.status === 'realizada' && !d.pago);
    const pagasMes = diligencias.filter((d) => d.pago && (d.data_pagamento || '').slice(0, 7) === mesAtual);
    const realizadas = diligencias.filter((d) => d.status === 'realizada');
    const sum = (arr: typeof diligencias) => arr.reduce((s, d) => s + Number(d.valor || 0), 0);
    return {
      aPagarValor: sum(aPagar), aPagarCount: aPagar.length,
      pagasMesValor: sum(pagasMes),
      totalRealizadasValor: sum(realizadas),
      pendentes: aPagar.slice(0, 5),
      temDados: diligencias.length > 0,
    };
  }, [diligencias]);

  if (!resumo.temDados) return null;

  return (
    <div className="glass-card p-6 rounded-3xl shadow-premium border border-black/5 dark:border-border bg-card/40 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary"><Handshake className="h-5 w-5" /></div>
          <div>
            <p className="font-black tracking-tight">Diligências de correspondentes</p>
            <p className="text-[11px] text-muted-foreground">Custos com correspondentes jurídicos.</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/correspondentes')} className="rounded-xl text-xs font-bold gap-1">
          Ver todas <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'A pagar', value: formatBRL(resumo.aPagarValor), sub: `${resumo.aPagarCount} diligência(s)`, tone: 'text-amber-600 dark:text-amber-400' },
          { label: 'Pagas no mês', value: formatBRL(resumo.pagasMesValor), sub: 'correspondentes', tone: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Total realizadas', value: formatBRL(resumo.totalRealizadasValor), sub: 'acumulado', tone: 'text-foreground' },
        ].map((k) => (
          <div key={k.label} className="p-4 rounded-2xl border border-border bg-background/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{k.label}</p>
            <p className={`text-2xl font-black tracking-tighter mt-1 ${k.tone}`}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {resumo.pendentes.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Pagamentos pendentes</p>
          {resumo.pendentes.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-background/40">
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{d.correspondente_id ? (corrById.get(d.correspondente_id) || 'Correspondente') : 'Sem correspondente'}</p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  {(d.comarca || d.uf) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[d.comarca, d.uf].filter(Boolean).join(' / ')}</span>}
                  <span className="flex items-center gap-1 font-semibold text-foreground/70"><CircleDollarSign className="h-3 w-3" />{formatBRL(d.valor || 0)}</span>
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-8 rounded-xl text-[11px] font-bold gap-1 shrink-0"
                onClick={() => patchDiligencia(d.id, { pago: true, data_pagamento: new Date().toISOString().slice(0, 10) })}>
                <Check className="h-3.5 w-3.5" /> Marcar pago
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
