import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Clock, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useOfficeSettingList } from "@/hooks/useOfficeSettingList";
import { CreatableSelect } from "@/components/Settings/CreatableSelect";

interface TipoPrazo { id: number; nome: string; diasPadrao: number; categoria: string; }

const PRAZOS_DEFAULT: TipoPrazo[] = [
  { id: 1, nome: "Contestação", diasPadrao: 15, categoria: "Defesa" },
  { id: 2, nome: "Recurso Ordinário", diasPadrao: 30, categoria: "Recurso" },
  { id: 3, nome: "Recurso Especial", diasPadrao: 15, categoria: "Recurso" },
  { id: 4, nome: "Recurso Extraordinário", diasPadrao: 15, categoria: "Recurso" },
  { id: 5, nome: "Contrarrazões", diasPadrao: 15, categoria: "Defesa" },
  { id: 6, nome: "Manifestação sobre Laudo", diasPadrao: 10, categoria: "Perícia" },
  { id: 7, nome: "Alegações Finais", diasPadrao: 15, categoria: "Defesa" },
];

const CATEGORIAS_DEFAULT = ["Defesa", "Recurso", "Perícia", "Outros"];

const catColor = (c: string) => {
  switch (c) {
    case "Defesa": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    case "Recurso": return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    case "Perícia": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export function DeadlineConfig() {
  const { items: prazos, loading, saving, persist } = useOfficeSettingList<TipoPrazo>("tipos_prazo", PRAZOS_DEFAULT);
  const { items: categorias, persist: persistCategorias } = useOfficeSettingList<string>("categorias_prazo", CATEGORIAS_DEFAULT);
  const [novoPrazo, setNovoPrazo] = useState({ nome: "", diasPadrao: 15, categoria: "Defesa" });

  const adicionarPrazo = () => {
    if (novoPrazo.nome.trim()) {
      persist([...prazos, { id: Date.now(), ...novoPrazo }]);
      setNovoPrazo({ nome: "", diasPadrao: 15, categoria: "Defesa" });
    }
  };
  const removerPrazo = (id: number) => persist(prazos.filter((p) => p.id !== id));

  return (
    <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
      <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-black flex items-center gap-2">
              Tipos de Prazo
              {(loading || saving) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </CardTitle>
            <CardDescription className="text-xs font-medium">Prazos padrão e categorias dos atos</CardDescription>
          </div>
        </div>
        <Badge variant="secondary" className="rounded-full font-black shrink-0">{prazos.length}</Badge>
      </CardHeader>

      <CardContent className="p-5 md:p-6 space-y-5">
        <div className="grid gap-2.5">
          {!loading && prazos.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground font-medium">
              Nenhum tipo de prazo cadastrado.
            </div>
          )}
          {prazos.map((prazo) => (
            <div
              key={prazo.id}
              className="group flex items-center justify-between gap-3 p-4 rounded-2xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01] hover:border-primary/30 hover:bg-primary/[0.02] transition-all"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h4 className="font-bold text-sm truncate">{prazo.nome}</h4>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border", catColor(prazo.categoria))}>
                    {prazo.categoria}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Prazo padrão: <span className="font-bold text-foreground/70">{prazo.diasPadrao} dias</span></p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removerPrazo(prazo.id)}
                disabled={saving}
                aria-label={`Remover ${prazo.nome}`}
                className="h-8 w-8 shrink-0 rounded-xl text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Adicionar */}
        <div className="rounded-2xl border border-dashed border-black/10 dark:border-border bg-black/[0.01] dark:bg-white/[0.01] p-4 space-y-3">
          <h5 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">Adicionar novo prazo</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-1 sm:col-span-2">
              <Label htmlFor="nomePrazo" className="text-xs font-bold">Nome do prazo</Label>
              <Input
                id="nomePrazo"
                value={novoPrazo.nome}
                onChange={(e) => setNovoPrazo({ ...novoPrazo, nome: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && adicionarPrazo()}
                placeholder="Ex: Embargos de Declaração"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="diasPadrao" className="text-xs font-bold">Dias padrão</Label>
              <Input
                id="diasPadrao"
                type="number"
                min={1}
                value={novoPrazo.diasPadrao}
                onChange={(e) => setNovoPrazo({ ...novoPrazo, diasPadrao: parseInt(e.target.value) || 0 })}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Categoria</Label>
              <CreatableSelect
                value={novoPrazo.categoria}
                onChange={(v) => setNovoPrazo({ ...novoPrazo, categoria: v })}
                options={categorias}
                onCreate={(v) => persistCategorias([...categorias, v])}
                placeholder="Selecione a categoria"
              />
            </div>
          </div>
          <Button onClick={adicionarPrazo} disabled={saving || !novoPrazo.nome.trim()} className="w-full rounded-xl font-bold">
            <Plus className="h-4 w-4 mr-2" /> Adicionar Prazo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
