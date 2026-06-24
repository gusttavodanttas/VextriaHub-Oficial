
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, Trash2, TrendingUp, DollarSign } from "lucide-react";
import { useState } from "react";

type MetaDemanda = {
  id: number;
  tipo: string;
  metaProcessos: number;
  processosAtuais: number;
  metaFaturamento: number;
  faturamentoAtual: number;
  cor: string;
};

export function DemandGoalsConfig() {
  const [metasDemanda, setMetasDemanda] = useState<MetaDemanda[]>([]);

  const [novaMeta, setNovaMeta] = useState({
    tipo: "",
    metaProcessos: 0,
    metaFaturamento: 0,
    cor: "bg-blue-500"
  });

  const cores = [
    "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500",
    "bg-red-500", "bg-yellow-500", "bg-pink-500", "bg-indigo-500"
  ];

  const adicionarMeta = () => {
    if (novaMeta.tipo.trim() && novaMeta.metaProcessos > 0) {
      setMetasDemanda([
        ...metasDemanda,
        {
          id: metasDemanda.length + 1,
          ...novaMeta,
          processosAtuais: 0,
          faturamentoAtual: 0
        }
      ]);
      setNovaMeta({ tipo: "", metaProcessos: 0, metaFaturamento: 0, cor: "bg-blue-500" });
    }
  };

  const removerMeta = (id: number) => {
    setMetasDemanda(metasDemanda.filter(meta => meta.id !== id));
  };

  const atualizarMeta = (id: number, campo: keyof MetaDemanda, valor: any) => {
    setMetasDemanda(metasDemanda.map(meta => 
      meta.id === id ? { ...meta, [campo]: valor } : meta
    ));
  };

  const calcularPercentual = (atual: number, meta: number) => {
    return meta > 0 ? Math.round((atual / meta) * 100) : 0;
  };

  return (
    <div className="space-y-8">
      {/* Resumo Geral */}
      <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-[2rem] overflow-hidden shadow-premium">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="flex items-center gap-3 text-lg font-black tracking-tight">
            <div className="p-2 rounded-xl bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <span>Metas por Demanda - Resumo</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {metasDemanda.map((meta) => (
              <div key={meta.id} className="p-5 border border-black/5 dark:border-white/5 rounded-2xl bg-black/[0.01] dark:bg-white/[0.01] space-y-4 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xs uppercase tracking-widest text-muted-foreground/80">{meta.tipo}</h4>
                  <div className={`w-3 h-3 rounded-full ${meta.cor} shadow-lg shadow-black/10`}></div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-60">
                    <span>Processos</span>
                    <span>{meta.processosAtuais}/{meta.metaProcessos}</span>
                  </div>
                  <div className="w-full bg-black/5 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${meta.cor} transition-all duration-1000 shadow-[0_0_10px_rgba(0,0,0,0.1)]`} 
                      style={{ width: `${Math.min(calcularPercentual(meta.processosAtuais, meta.metaProcessos), 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-60">
                    <span>Faturamento</span>
                    <span className="text-primary">R$ {meta.faturamentoAtual.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-black/5 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${meta.cor} transition-all duration-1000 shadow-[0_0_10px_rgba(0,0,0,0.1)]`} 
                      style={{ width: `${Math.min(calcularPercentual(meta.faturamentoAtual, meta.metaFaturamento), 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuração Detalhada */}
      <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-[2rem] overflow-hidden shadow-premium">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="text-xl font-black tracking-tight">Configurar Metas por Demanda</CardTitle>
        </CardHeader>
        <CardContent className="p-8 pt-0 space-y-6">
          {metasDemanda.map((meta) => (
            <div key={meta.id} className="border border-black/5 dark:border-white/10 rounded-[1.5rem] p-6 space-y-6 bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-5 h-5 rounded-full ${meta.cor} shadow-lg shadow-black/10`}></div>
                  <h4 className="font-black text-lg tracking-tight">{meta.tipo}</h4>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removerMeta(meta.id)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-xl h-10 px-4 font-black uppercase text-[10px] tracking-widest"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Meta de Processos</Label>
                  <Input
                    type="number"
                    value={meta.metaProcessos}
                    onChange={(e) => atualizarMeta(meta.id, 'metaProcessos', parseInt(e.target.value))}
                    className="h-12 rounded-xl border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Processos Atuais</Label>
                  <Input
                    type="number"
                    value={meta.processosAtuais}
                    onChange={(e) => atualizarMeta(meta.id, 'processosAtuais', parseInt(e.target.value))}
                    className="h-12 rounded-xl border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Meta Faturamento (R$)</Label>
                  <Input
                    type="number"
                    value={meta.metaFaturamento}
                    onChange={(e) => atualizarMeta(meta.id, 'metaFaturamento', parseInt(e.target.value))}
                    className="h-12 rounded-xl border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Faturamento Atual (R$)</Label>
                  <Input
                    type="number"
                    value={meta.faturamentoAtual}
                    onChange={(e) => atualizarMeta(meta.id, 'faturamentoAtual', parseInt(e.target.value))}
                    className="h-12 rounded-xl border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 font-bold"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="border-t border-black/5 dark:border-white/5 pt-8 mt-4">
            <h5 className="font-black text-xs uppercase tracking-widest text-muted-foreground/60 mb-6 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Nova Meta Estratégica
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
              <div className="space-y-2 col-span-1 md:col-span-1">
                <Label htmlFor="tipoMeta" className="text-[10px] font-black uppercase tracking-widest opacity-60">Tipo de Demanda</Label>
                <Input
                  id="tipoMeta"
                  value={novaMeta.tipo}
                  onChange={(e) => setNovaMeta({...novaMeta, tipo: e.target.value})}
                  placeholder="Ex: Pensão por Morte"
                  className="h-12 rounded-xl border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaProc" className="text-[10px] font-black uppercase tracking-widest opacity-60">Meta Processos</Label>
                <Input
                  id="metaProc"
                  type="number"
                  value={novaMeta.metaProcessos}
                  onChange={(e) => setNovaMeta({...novaMeta, metaProcessos: parseInt(e.target.value)})}
                  className="h-12 rounded-xl border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaFat" className="text-[10px] font-black uppercase tracking-widest opacity-60">Meta Faturamento</Label>
                <Input
                  id="metaFat"
                  type="number"
                  value={novaMeta.metaFaturamento}
                  onChange={(e) => setNovaMeta({...novaMeta, metaFaturamento: parseInt(e.target.value)})}
                  className="h-12 rounded-xl border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Identidade Visual</Label>
                <div className="flex space-x-2 h-12 items-center px-4 bg-black/[0.02] dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/10">
                  {cores.slice(0, 4).map((cor) => (
                    <button
                      key={cor}
                      className={`w-6 h-6 rounded-full ${cor} transition-all duration-300 ${novaMeta.cor === cor ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-40 hover:opacity-100'}`}
                      onClick={() => setNovaMeta({...novaMeta, cor})}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Button onClick={adicionarMeta} className="w-full h-12 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-primary/20">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
