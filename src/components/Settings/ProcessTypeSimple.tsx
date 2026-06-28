import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useOfficeSettingList } from "@/hooks/useOfficeSettingList";

interface TipoProcesso { id: number; nome: string; descricao: string; area: string; }

const TIPOS_PROCESSO_DEFAULT: TipoProcesso[] = [
  { id: 1, nome: "BPC (Benefício de Prestação Continuada)", descricao: "Auxílio assistencial para pessoas com deficiência ou idosos em situação de vulnerabilidade", area: "Previdenciário" },
  { id: 2, nome: "Aposentadoria por Idade", descricao: "Benefício previdenciário por idade mínima e tempo de contribuição", area: "Previdenciário" },
  { id: 3, nome: "Planejamento Previdenciário", descricao: "Consultoria e estratégia para otimização de benefícios previdenciários", area: "Consultivo" },
  { id: 4, nome: "Assessoria Preventiva para Dentistas", descricao: "Consultoria jurídica preventiva especializada para profissionais da odontologia", area: "Consultivo" },
];

const AREAS = ["Previdenciário", "Trabalhista", "Civil", "Consultivo", "Outros"];

const areaColor = (area: string) => {
  switch (area) {
    case "Previdenciário": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    case "Trabalhista": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "Civil": return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    case "Consultivo": return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export function ProcessTypeSimple() {
  const { items: tiposProcesso, loading, saving, persist } = useOfficeSettingList<TipoProcesso>("tipos_processo", TIPOS_PROCESSO_DEFAULT);
  const [novoTipo, setNovoTipo] = useState({ nome: "", descricao: "", area: "Previdenciário" });

  const adicionarTipo = () => {
    if (novoTipo.nome.trim()) {
      persist([...tiposProcesso, { id: Date.now(), ...novoTipo }]);
      setNovoTipo({ nome: "", descricao: "", area: "Previdenciário" });
    }
  };
  const removerTipo = (id: number) => persist(tiposProcesso.filter((t) => t.id !== id));

  return (
    <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
      <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-black flex items-center gap-2">
              Tipos de Processo
              {(loading || saving) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </CardTitle>
            <CardDescription className="text-xs font-medium">Categorias usadas ao cadastrar processos</CardDescription>
          </div>
        </div>
        <Badge variant="secondary" className="rounded-full font-black shrink-0">{tiposProcesso.length}</Badge>
      </CardHeader>

      <CardContent className="p-5 md:p-6 space-y-5">
        <div className="grid gap-2.5">
          {!loading && tiposProcesso.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground font-medium">
              Nenhum tipo cadastrado. Adicione o primeiro abaixo.
            </div>
          )}
          {tiposProcesso.map((tipo) => (
            <div
              key={tipo.id}
              className="group flex items-start justify-between gap-3 p-4 rounded-2xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01] hover:border-primary/30 hover:bg-primary/[0.02] transition-all"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h4 className="font-bold text-sm truncate">{tipo.nome}</h4>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border", areaColor(tipo.area))}>
                    {tipo.area}
                  </span>
                </div>
                {tipo.descricao && <p className="text-xs text-muted-foreground leading-relaxed">{tipo.descricao}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removerTipo(tipo.id)}
                disabled={saving}
                aria-label={`Remover ${tipo.nome}`}
                className="h-8 w-8 shrink-0 rounded-xl text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Adicionar */}
        <div className="rounded-2xl border border-dashed border-black/10 dark:border-border bg-black/[0.01] dark:bg-white/[0.01] p-4 space-y-3">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">Adicionar novo tipo</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nomeProcesso" className="text-xs font-bold">Nome do tipo</Label>
              <Input
                id="nomeProcesso"
                value={novoTipo.nome}
                onChange={(e) => setNovoTipo({ ...novoTipo, nome: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && adicionarTipo()}
                placeholder="Ex: Auxílio Doença"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Área</Label>
              <Select value={novoTipo.area} onValueChange={(v) => setNovoTipo({ ...novoTipo, area: v })}>
                <SelectTrigger className="h-11 rounded-xl font-medium"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="descricao" className="text-xs font-bold">Descrição</Label>
            <Textarea
              id="descricao"
              value={novoTipo.descricao}
              onChange={(e) => setNovoTipo({ ...novoTipo, descricao: e.target.value })}
              placeholder="Descreva brevemente este tipo de processo…"
              rows={2}
              className="rounded-xl resize-none"
            />
          </div>
          <Button onClick={adicionarTipo} disabled={saving || !novoTipo.nome.trim()} className="w-full rounded-xl font-bold">
            <Plus className="h-4 w-4 mr-2" /> Adicionar Tipo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
