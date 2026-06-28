
import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Plus, Edit, Trash2, CheckCircle2, AlertTriangle, Clock, Flame } from "lucide-react";
import { DemandGoalsConfig } from "@/components/Goals/DemandGoalsConfig";
import { CreateGoalDialog } from "@/components/Goals/CreateGoalDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { useMetas, type Meta } from "@/hooks/useMetas";
import { cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtMeta = (value: number, tipo: string) =>
  tipo === "receita"
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value)
    : String(value);

type MetaStatus = {
  pct: number; expectedPct: number; daysLeft: number; totalDays: number;
  kind: "achieved" | "ontrack" | "behind";
  label: string; color: string; ring: string; bg: string;
};

function computeStatus(m: Meta): MetaStatus {
  const pct = m.valorMeta > 0 ? Math.round((m.valorAtual / m.valorMeta) * 100) : 0;
  const start = new Date(m.dataInicio).getTime();
  const end = new Date(m.dataFim).getTime();
  const now = Date.now();
  const total = Math.max(end - start, 1);
  const elapsed = Math.min(Math.max(now - start, 0), total);
  const expectedPct = Math.round((elapsed / total) * 100);
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86_400_000));
  const totalDays = Math.max(1, Math.ceil(total / 86_400_000));

  let kind: MetaStatus["kind"] = "behind";
  if (pct >= 100) kind = "achieved";
  else if (pct >= expectedPct) kind = "ontrack";

  const map = {
    achieved: { label: "Atingida", color: "text-emerald-500", ring: "stroke-emerald-500", bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    ontrack: { label: "No ritmo", color: "text-blue-500", ring: "stroke-blue-500", bg: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    behind: { label: "Atrasada", color: "text-amber-500", ring: "stroke-amber-500", bg: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  }[kind];

  return { pct, expectedPct, daysLeft, totalDays, kind, ...map };
}

// Anel de progresso (SVG) com marcador do ritmo esperado
function MetaRing({ pct, expectedPct, ringClass }: { pct: number; expectedPct: number; ringClass: string }) {
  const r = 36, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(pct, 100) / 100);
  const expAngle = (Math.min(expectedPct, 100) / 100) * 360 - 90;
  const ex = 50 + r * Math.cos((expAngle * Math.PI) / 180);
  const ey = 50 + r * Math.sin((expAngle * Math.PI) / 180);
  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0 -rotate-90">
      <circle cx="50" cy="50" r={r} className="fill-none stroke-muted/40" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} className={cn("fill-none transition-all duration-700", ringClass)}
        strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      {/* marcador do ritmo esperado */}
      <circle cx={ex} cy={ey} r="3.5" className="fill-foreground/40" />
    </svg>
  );
}

const STATUS_ICON = { achieved: CheckCircle2, ontrack: Flame, behind: AlertTriangle };

function MetaCard({ meta, onEdit, onDelete }: { meta: Meta; onEdit: (m: Meta) => void; onDelete: (id: string) => void }) {
  const s = computeStatus(meta);
  const Icon = STATUS_ICON[s.kind];
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-black/5 dark:border-border bg-card/50 p-5 md:p-6 shadow-premium transition-all hover:shadow-lg hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h4 className="text-lg font-black tracking-tight truncate">{meta.titulo}</h4>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className={cn("inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider", s.bg)}>
              <Icon className="h-3 w-3" /> {s.label}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground uppercase tracking-wider">{meta.periodo}</span>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button size="icon" variant="ghost" onClick={() => onEdit(meta)} className="h-8 w-8 rounded-lg hover:bg-primary/10"><Edit className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(meta.id)} className="h-8 w-8 rounded-lg hover:bg-red-500/10 hover:text-red-500"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <MetaRing pct={s.pct} expectedPct={s.expectedPct} ringClass={s.ring} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-xl font-black leading-none", s.color)}>{s.pct}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="text-2xl font-black tracking-tight leading-none">{fmtMeta(meta.valorAtual, meta.tipo)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">de {fmtMeta(meta.valorMeta, meta.tipo)}</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {s.daysLeft}d restantes</span>
            <span>·</span>
            <span>ritmo esperado {s.expectedPct}%</span>
          </div>
          <p className="text-[11px] font-bold">
            Faltam <span className={s.color}>{fmtMeta(Math.max(meta.valorMeta - meta.valorAtual, 0), meta.tipo)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

const Metas = () => {
  const [activeTab, setActiveTab] = useState("individuais");
  const [createGoalOpen, setCreateGoalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<any | null>(null);
  const { metas, loading, create, update, remove } = useMetas();

  const handleSaveGoal = (m: any) => {
    const payload = { titulo: m.titulo, tipo: m.tipo, periodo: m.periodo, valorMeta: m.valorMeta, dataInicio: m.dataInicio, dataFim: m.dataFim };
    if (editGoal?.id) update(editGoal.id, payload);
    else create(payload);
    setEditGoal(null);
  };

  const handleDeleteGoal = (goalId: string) => {
    remove(goalId);
  };

  const openEdit = (meta: any) => { setEditGoal(meta); setCreateGoalOpen(true); };

  // Consolidação por tipo (visão do escritório) — usa as metas reais (RLS define o escopo)
  const TIPO_LABEL: Record<string, string> = {
    receita: "Receita", clientes: "Novos Clientes", processos: "Processos Finalizados",
    audiencias: "Audiências", atendimentos: "Atendimentos", prazos: "Prazos Cumpridos",
  };
  const resumo = useMemo(() => {
    const total = metas.length;
    let soma = 0, ontrack = 0, achieved = 0, behind = 0;
    metas.forEach(m => {
      const s = computeStatus(m);
      soma += Math.min(s.pct, 100);
      if (s.kind === "achieved") achieved++;
      else if (s.kind === "ontrack") ontrack++;
      else behind++;
    });
    return { total, media: total > 0 ? Math.round(soma / total) : 0, ontrack, achieved, behind };
  }, [metas]);

  const consolidado = useMemo(() => {
    const map: Record<string, { meta: number; atual: number; qtd: number }> = {};
    metas.forEach(m => {
      if (!map[m.tipo]) map[m.tipo] = { meta: 0, atual: 0, qtd: 0 };
      map[m.tipo].meta += m.valorMeta;
      map[m.tipo].atual += m.valorAtual;
      map[m.tipo].qtd += 1;
    });
    return Object.entries(map).map(([tipo, v]) => ({ tipo, ...v, pct: v.meta > 0 ? Math.round((v.atual / v.meta) * 100) : 0 }));
  }, [metas]);

  const formatValue = (value: number, tipo: string) => {
    if (tipo === "receita") {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    }
    return value.toString();
  };

  return (
    <PermissionGuard permission="canViewMetas" showDeniedMessage>
    <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-12 overflow-x-hidden entry-animate">
      {/* Page Header Moderno */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Target className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 drop-shadow-sm">
              Metas & Objetivos
            </h1>
          </div>
          <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl">
            Visualize o progresso em tempo real e impulsione a performance do seu escritório.
          </p>
        </div>
        
        <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl border border-black/5 dark:border-border bg-black/[0.02] dark:bg-muted/30 shadow-premium">
          <Button 
            onClick={() => { setEditGoal(null); setCreateGoalOpen(true); }}
            size="lg"
            className="rounded-xl h-12 shadow-premium bg-primary hover:bg-primary/90 font-black uppercase text-xs tracking-widest px-8"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nova Meta
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="glass-card p-2 rounded-3xl inline-flex w-full md:w-auto h-auto border border-black/5 dark:border-border bg-black/[0.02] dark:bg-muted/30 shadow-inner">
          <TabsList className="bg-transparent h-auto p-0 flex flex-nowrap gap-1">
            <TabsTrigger value="individuais" className="rounded-2xl px-10 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-foreground data-[state=active]:shadow-lg shadow-primary/20 transition-all">
              Individuais
            </TabsTrigger>
            <TabsTrigger value="demandas" className="rounded-2xl px-10 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-foreground data-[state=active]:shadow-lg shadow-primary/20 transition-all">
              Demandas
            </TabsTrigger>
            <TabsTrigger value="escritorio" className="rounded-2xl px-10 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-foreground data-[state=active]:shadow-lg shadow-primary/20 transition-all">
              Escritório
            </TabsTrigger>
          </TabsList>
        </div>

          <TabsContent value="individuais" className="space-y-6 entry-animate slide-in-from-bottom-4 duration-500">
            {/* Resumo */}
            {!loading && metas.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Metas ativas", value: resumo.total, icon: Target, color: "text-primary", bg: "bg-primary/10" },
                  { label: "Progresso médio", value: `${resumo.media}%`, icon: TrendingUp, color: "text-violet-500", bg: "bg-violet-500/10" },
                  { label: "No ritmo", value: resumo.ontrack + resumo.achieved, icon: Flame, color: "text-blue-500", bg: "bg-blue-500/10" },
                  { label: "Atrasadas", value: resumo.behind, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-black/5 dark:border-border bg-card/40 p-4">
                    <div className={cn("p-2.5 rounded-xl shrink-0", s.bg)}><s.icon className={cn("h-5 w-5", s.color)} /></div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{s.label}</p>
                      <p className="text-xl font-black tracking-tight">{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {loading && metas.length === 0 && (
                [...Array(2)].map((_, i) => <Skeleton key={i} className="h-48 rounded-3xl" />)
              )}
              {metas.map((meta) => (
                <MetaCard key={meta.id} meta={meta} onEdit={openEdit} onDelete={handleDeleteGoal} />
              ))}

              {!loading && metas.length === 0 && (
                <div className="col-span-full py-20 text-center glass-card rounded-[3rem] space-y-6">
                  <div className="p-8 bg-muted/30 rounded-full inline-block">
                    <Target className="h-16 w-16 text-muted-foreground/20" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-extrabold">Nenhuma meta ativa</h3>
                    <p className="text-muted-foreground font-medium max-w-sm mx-auto">
                      Comece a transformar sua produtividade criando sua primeira meta estratégica hoje.
                    </p>
                  </div>
                  <Button onClick={() => { setEditGoal(null); setCreateGoalOpen(true); }} size="lg" className="rounded-2xl h-14 px-10 font-bold shadow-premium">
                    <Plus className="h-6 w-6 mr-2" />
                    Criar Primeira Meta
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="demandas" className="space-y-4">
            <DemandGoalsConfig />
          </TabsContent>

          <TabsContent value="escritorio" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Metas do Escritório (consolidado)
                </CardTitle>
                <CardDescription>
                  Soma de todas as metas por tipo. Progresso calculado automaticamente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {consolidado.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Target className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Nenhuma meta cadastrada ainda. Crie metas na aba "Individuais".</p>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2">
                    {consolidado.map((c) => (
                      <div key={c.tipo} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-bold">{TIPO_LABEL[c.tipo] || c.tipo}</span>
                          <span className="text-muted-foreground">
                            {c.tipo === "receita" ? formatValue(c.atual, "receita") : c.atual}
                            {" / "}
                            {c.tipo === "receita" ? formatValue(c.meta, "receita") : c.meta}
                            <span className="ml-2 font-bold text-foreground">{c.pct}%</span>
                          </span>
                        </div>
                        <Progress value={Math.min(c.pct, 100)} className="mt-1" />
                        <p className="text-[10px] text-muted-foreground/60">{c.qtd} meta{c.qtd > 1 ? "s" : ""} deste tipo</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <CreateGoalDialog
          open={createGoalOpen}
          onOpenChange={(o) => { setCreateGoalOpen(o); if (!o) setEditGoal(null); }}
          onSave={handleSaveGoal}
          initial={editGoal}
        />
      </div>
    </PermissionGuard>
  );
};

export default Metas;
