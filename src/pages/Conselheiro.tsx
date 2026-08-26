import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useAiAdvisor, AdvisorError, type AdvisorPeriod, type AdvisorInsights, type AdvisorSnapshot } from '@/hooks/useAiAdvisor';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatBRL } from '@/lib/currency';
import {
  Sparkles, Brain, AlertTriangle, Lightbulb, TrendingUp, ListChecks, RotateCw, Crown, Settings, ArrowRight,
} from 'lucide-react';

const PERIODS: Array<{ key: AdvisorPeriod; label: string }> = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
  { key: 'ano', label: 'Ano' },
];

const SnapshotGrid: React.FC<{ s: AdvisorSnapshot }> = ({ s }) => {
  const cards = [
    { label: 'Processos ativos', value: s.processos_ativos, tone: 'text-foreground' },
    { label: 'Prazos vencendo', value: s.prazos_vencendo, tone: 'text-amber-600 dark:text-amber-400' },
    { label: 'Prazos vencidos', value: s.prazos_vencidos, tone: 'text-rose-600 dark:text-rose-400' },
    { label: 'Audiências próximas', value: s.audiencias_proximas, tone: 'text-blue-600 dark:text-blue-400' },
    { label: 'Publicações novas', value: s.publicacoes_nao_tratadas, tone: 'text-violet-600 dark:text-violet-400' },
    { label: 'Tarefas atrasadas', value: s.tarefas_atrasadas, tone: 'text-rose-600 dark:text-rose-400' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="p-3 rounded-2xl border border-border bg-card/60">
          <div className={cn('text-2xl font-black leading-none', c.tone)}>{c.value}</div>
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mt-1">{c.label}</div>
        </div>
      ))}
    </div>
  );
};

const Section: React.FC<{ title: string; icon: React.ElementType; items?: string[]; tone: string; numbered?: boolean }> = ({ title, icon: Icon, items, tone, numbered }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-3">
      <div className={cn('flex items-center gap-2 text-[11px] font-black uppercase tracking-widest', tone)}>
        <Icon className="h-4 w-4" /> {title}
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            {numbered
              ? <span className="shrink-0 h-5 w-5 rounded-lg bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center mt-0.5">{i + 1}</span>
              : <span className={cn('shrink-0 h-1.5 w-1.5 rounded-full mt-2', tone.replace('text-', 'bg-'))} />}
            <span className="text-foreground/90 leading-relaxed">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Conselheiro: React.FC = () => {
  const navigate = useNavigate();
  const { hasIAModule } = usePlanFeatures();
  const advisor = useAiAdvisor();

  const [period, setPeriod] = useState<AdvisorPeriod>('semana');
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AdvisorInsights | null>(null);
  const [snapshot, setSnapshot] = useState<AdvisorSnapshot | null>(null);
  const [error, setError] = useState<{ msg: string; code: string } | null>(null);

  const run = async (p: AdvisorPeriod) => {
    setPeriod(p);
    setLoading(true);
    setError(null);
    try {
      const res = await advisor.insights(p);
      setInsights(res.data);
      setSnapshot(res.snapshot);
    } catch (e) {
      const err = e as AdvisorError;
      setError({ msg: err.message, code: err.code || 'erro' });
      setInsights(null);
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  };

  // Gate premium
  if (!hasIAModule) {
    return (
      <div className="p-4 md:p-6">
        <div className="max-w-xl mx-auto mt-10 text-center space-y-5 p-8 rounded-3xl border border-primary/20 bg-primary/5">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto"><Crown className="h-7 w-7" /></div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black">Conselheiro IA</h1>
            <p className="text-muted-foreground">Um conselheiro com IA que analisa seu escritório e sugere o que priorizar — disponível no plano <span className="font-bold text-foreground">Premium</span>.</p>
          </div>
          <Button onClick={() => navigate('/configuracoes')} className="rounded-xl gap-2">
            Ver planos <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 md:p-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20"><Brain className="h-5 w-5" /></div>
            Conselheiro IA
          </h1>
          <p className="text-muted-foreground mt-1 text-sm ml-1">Análise inteligente do escritório com recomendações e plano de ação.</p>
        </div>
      </div>

      {/* Período + Analisar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1.5 bg-muted/40 p-1 rounded-2xl w-fit">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={cn('px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
                period === p.key ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}>
              {p.label}
            </button>
          ))}
        </div>
        <Button onClick={() => run(period)} disabled={loading} className="rounded-xl h-10 gap-2 font-bold shadow-md shadow-primary/20">
          {loading ? <RotateCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Analisando…' : 'Analisar com IA'}
        </Button>
      </div>

      {/* Erros */}
      {error && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
            {error.code === 'openai-nao-configurada' ? <Settings className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </div>
          <div className="text-sm">
            <p className="font-bold text-foreground">{error.code === 'openai-nao-configurada' ? 'IA ainda não configurada' : 'Não foi possível analisar'}</p>
            <p className="text-muted-foreground mt-0.5">{error.msg}</p>
          </div>
        </div>
      )}

      {/* Estado inicial */}
      {!insights && !loading && !error && (
        <div className="py-16 flex flex-col items-center justify-center text-center gap-3 opacity-70">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><Sparkles className="h-7 w-7" /></div>
          <p className="font-bold">Escolha o período e clique em <span className="text-primary">Analisar com IA</span></p>
          <p className="text-sm text-muted-foreground max-w-md">O conselheiro lê seus processos, prazos, audiências, publicações e tarefas e devolve um panorama com o que priorizar.</p>
        </div>
      )}

      {/* Resultado */}
      {insights && (
        <div className="space-y-5">
          {snapshot && <SnapshotGrid s={snapshot} />}

          {insights.resumo && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-primary mb-2">
                <Sparkles className="h-4 w-4" /> Panorama
              </div>
              <p className="text-[15px] leading-relaxed text-foreground/90">{insights.resumo}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Alertas" icon={AlertTriangle} items={insights.alertas} tone="text-rose-600 dark:text-rose-400" />
            <Section title="Recomendações" icon={Lightbulb} items={insights.recomendacoes} tone="text-amber-600 dark:text-amber-400" />
            <Section title="Produtividade" icon={TrendingUp} items={insights.produtividade} tone="text-emerald-600 dark:text-emerald-400" />
            <Section title="Plano de ação" icon={ListChecks} items={insights.plano_acao} tone="text-blue-600 dark:text-blue-400" numbered />
          </div>

          <p className="text-[10px] text-muted-foreground/50 text-center pt-2">
            Gerado por IA a partir dos dados do seu escritório. Revise antes de agir — a IA pode errar.
          </p>
        </div>
      )}
    </div>
  );
};

export default Conselheiro;
