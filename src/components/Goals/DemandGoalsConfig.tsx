import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Plus, Trash2, Save } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type MetaDemanda = {
  id: string;
  tipo: string;
  metaProcessos: number;
  processosAtuais: number; // calculado automaticamente
  metaFaturamento: number;
  faturamentoAtual: number;
  cor: string;
};

const cores = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-red-500", "bg-yellow-500", "bg-pink-500", "bg-indigo-500"];

export function DemandGoalsConfig() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [metasDemanda, setMetasDemanda] = useState<MetaDemanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [novaMeta, setNovaMeta] = useState({ tipo: "", metaProcessos: 0, metaFaturamento: 0, cor: "bg-blue-500" });

  // Conta processos ativos por tipo (tipo_processo) para preencher o progresso real
  const contarProcessos = useCallback(async (tipos: string[]): Promise<Record<string, number>> => {
    if (!user?.office_id || tipos.length === 0) return {};
    const { data } = await supabase.from("processos").select("tipo_processo")
      .eq("office_id", user.office_id).eq("deletado", false).neq("status", "encerrado");
    const counts: Record<string, number> = {};
    (data || []).forEach((p: any) => {
      const t = (p.tipo_processo || "").trim().toLowerCase();
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [user?.office_id]);

  // Carrega config salva em offices.settings.metas_demanda
  useEffect(() => {
    if (!user?.office_id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("offices").select("settings").eq("id", user.office_id).maybeSingle();
      const saved: MetaDemanda[] = ((data?.settings as any)?.metas_demanda) || [];
      const counts = await contarProcessos(saved.map(m => m.tipo));
      setMetasDemanda(saved.map(m => ({ ...m, processosAtuais: counts[(m.tipo || "").trim().toLowerCase()] || 0 })));
      setLoading(false);
    })();
  }, [user?.office_id, contarProcessos]);

  const persist = async (lista: MetaDemanda[]) => {
    if (!user?.office_id) return;
    setSaving(true);
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", user.office_id).maybeSingle();
    // Salva sem o campo calculado (processosAtuais é derivado)
    const toSave = lista.map(({ processosAtuais, ...rest }) => rest);
    const merged = { ...((cur?.settings as any) || {}), metas_demanda: toSave };
    const { error } = await supabase.from("offices").update({ settings: merged }).eq("id", user.office_id);
    setSaving(false);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else toast({ title: "Metas por demanda salvas" });
  };

  const adicionarMeta = async () => {
    if (!novaMeta.tipo.trim() || novaMeta.metaProcessos <= 0) return;
    const counts = await contarProcessos([novaMeta.tipo]);
    const nova: MetaDemanda = {
      id: crypto.randomUUID(), ...novaMeta,
      processosAtuais: counts[novaMeta.tipo.trim().toLowerCase()] || 0, faturamentoAtual: 0,
    };
    const lista = [...metasDemanda, nova];
    setMetasDemanda(lista);
    setNovaMeta({ tipo: "", metaProcessos: 0, metaFaturamento: 0, cor: "bg-blue-500" });
    persist(lista);
  };

  const removerMeta = (id: string) => {
    const lista = metasDemanda.filter(m => m.id !== id);
    setMetasDemanda(lista);
    persist(lista);
  };

  const atualizarMeta = (id: string, campo: keyof MetaDemanda, valor: any) => {
    setMetasDemanda(prev => prev.map(m => m.id === id ? { ...m, [campo]: valor } : m));
  };

  const calc = (atual: number, meta: number) => (meta > 0 ? Math.round((atual / meta) * 100) : 0);

  if (loading) {
    return <div className="space-y-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40 rounded-[2rem]" />)}</div>;
  }

  return (
    <div className="space-y-8">
      {/* Resumo */}
      <Card className="border-black/5 dark:border-border bg-card/40 rounded-[2rem] overflow-hidden shadow-premium">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="flex items-center gap-3 text-lg font-black tracking-tight">
            <div className="p-2 rounded-xl bg-primary/10"><Target className="h-5 w-5 text-primary" /></div>
            <span>Metas por Demanda — Resumo</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {metasDemanda.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma meta por demanda. Adicione abaixo.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {metasDemanda.map((meta) => (
                <div key={meta.id} className="p-5 border border-black/5 dark:border-border rounded-2xl bg-black/[0.01] dark:bg-white/[0.01] space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-xs uppercase tracking-widest text-muted-foreground/80">{meta.tipo}</h4>
                    <div className={`w-3 h-3 rounded-full ${meta.cor}`}></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-60">
                      <span>Processos</span><span>{meta.processosAtuais}/{meta.metaProcessos}</span>
                    </div>
                    <div className="w-full bg-black/5 dark:bg-muted/40 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full ${meta.cor} transition-all duration-700`} style={{ width: `${Math.min(calc(meta.processosAtuais, meta.metaProcessos), 100)}%` }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-60">
                      <span>Faturamento</span><span className="text-primary">R$ {meta.faturamentoAtual.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-black/5 dark:bg-muted/40 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full ${meta.cor} transition-all duration-700`} style={{ width: `${Math.min(calc(meta.faturamentoAtual, meta.metaFaturamento), 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuração */}
      <Card className="border-black/5 dark:border-border bg-card/40 rounded-[2rem] overflow-hidden shadow-premium">
        <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-black tracking-tight">Configurar Metas por Demanda</CardTitle>
          <Button onClick={() => persist(metasDemanda)} disabled={saving} className="rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest">
            <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}
          </Button>
        </CardHeader>
        <CardContent className="p-8 pt-0 space-y-6">
          {metasDemanda.map((meta) => (
            <div key={meta.id} className="border border-black/5 dark:border-border rounded-[1.5rem] p-6 space-y-6 bg-black/[0.01] dark:bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-5 h-5 rounded-full ${meta.cor}`}></div>
                  <h4 className="font-black text-lg tracking-tight">{meta.tipo}</h4>
                  <span className="text-xs text-muted-foreground">· {meta.processosAtuais} processos ativos (auto)</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removerMeta(meta.id)} className="text-red-500 hover:bg-red-500/10 rounded-xl">
                  <Trash2 className="h-4 w-4 mr-2" />Remover
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Meta de Processos</Label>
                  <Input type="number" value={meta.metaProcessos} onChange={(e) => atualizarMeta(meta.id, 'metaProcessos', parseInt(e.target.value) || 0)} className="h-12 rounded-xl" onBlur={() => persist(metasDemanda)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Meta Faturamento (R$)</Label>
                  <Input type="number" value={meta.metaFaturamento} onChange={(e) => atualizarMeta(meta.id, 'metaFaturamento', parseInt(e.target.value) || 0)} className="h-12 rounded-xl" onBlur={() => persist(metasDemanda)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Faturamento Atual (R$)</Label>
                  <Input type="number" value={meta.faturamentoAtual} onChange={(e) => atualizarMeta(meta.id, 'faturamentoAtual', parseInt(e.target.value) || 0)} className="h-12 rounded-xl" onBlur={() => persist(metasDemanda)} />
                </div>
              </div>
            </div>
          ))}

          <div className="border-t border-black/5 dark:border-border pt-8 mt-4">
            <h5 className="font-black text-xs uppercase tracking-widest text-muted-foreground/60 mb-6 flex items-center gap-2">
              <Plus className="h-4 w-4" />Adicionar Nova Meta
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Tipo de Demanda</Label>
                <Input value={novaMeta.tipo} onChange={(e) => setNovaMeta({ ...novaMeta, tipo: e.target.value })} placeholder="Ex: Pensão por Morte" className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Meta Processos</Label>
                <Input type="number" value={novaMeta.metaProcessos} onChange={(e) => setNovaMeta({ ...novaMeta, metaProcessos: parseInt(e.target.value) || 0 })} className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Meta Faturamento</Label>
                <Input type="number" value={novaMeta.metaFaturamento} onChange={(e) => setNovaMeta({ ...novaMeta, metaFaturamento: parseInt(e.target.value) || 0 })} className="h-12 rounded-xl" />
              </div>
              <Button onClick={adicionarMeta} className="h-12 rounded-xl font-black uppercase text-xs tracking-widest">
                <Plus className="h-4 w-4 mr-2" />Adicionar
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-3">
              O "Tipo de Demanda" deve bater com o <strong>tipo do processo</strong> para o progresso de processos ser contado automaticamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
