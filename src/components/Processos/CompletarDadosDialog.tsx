import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { tribunalFromCNJ } from "@/utils/tribunalCNJ";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  processoId: string;
  numeroProcesso: string;
  onApplied?: () => void;
}

const brl = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

// Campos que o robô pode completar (coluna no banco ↔ valor vindo do tribunal)
const FIELDS: { col: string; label: string; get: (d: any) => any; fmt?: (v: any) => string }[] = [
  { col: "tribunal", label: "Tribunal", get: (d) => d.tribunal },
  { col: "vara", label: "Vara", get: (d) => d.vara },
  { col: "comarca", label: "Comarca", get: (d) => d.comarca },
  { col: "classe_judicial", label: "Classe judicial", get: (d) => d.classe || d.classeJudicial },
  { col: "tipo_processo", label: "Tipo de processo", get: (d) => d.tipoProcesso || d.classe },
  { col: "assunto_principal", label: "Assunto", get: (d) => d.assunto || d.assuntoPrincipal },
  { col: "fase_processual", label: "Fase processual", get: (d) => d.faseProcessual },
  { col: "instancia", label: "Instância", get: (d) => d.instancia },
  { col: "parte_autora", label: "Parte autora", get: (d) => d.autor || d.parteAutora },
  { col: "requerido", label: "Réu / Requerido", get: (d) => d.reu || d.requerido },
  { col: "valor_causa", label: "Valor da causa", get: (d) => d.valorCausa || d.valor_causa, fmt: brl },
];

const isEmpty = (v: any) => v === null || v === undefined || v === "" || v === 0 || v === "0";

export function CompletarDadosDialog({ open, onOpenChange, processoId, numeroProcesso, onApplied }: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [diffs, setDiffs] = useState<{ col: string; label: string; current: any; novo: any; display: string }[] | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const buscar = async () => {
    setLoading(true);
    setDiffs(null);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-processo", {
        body: { numeroProcesso, oab: (profile as any)?.oab, uf: (profile as any)?.oab_uf },
      });
      if (error || !data) throw new Error(error?.message || "Processo não localizado no tribunal.");

      // Estado atual do processo (só as colunas que podemos completar)
      const cols = FIELDS.map((f) => f.col).join(", ");
      const { data: atual } = await supabase.from("processos").select(cols).eq("id", processoId).maybeSingle();

      const found = FIELDS
        .map((f) => {
          // Tribunal: deriva a sigla certa do número CNJ (evita "TJ" genérico)
          const novo = f.col === "tribunal" ? (tribunalFromCNJ(numeroProcesso) || f.get(data)) : f.get(data);
          const current = (atual as any)?.[f.col];
          if (isEmpty(current) && !isEmpty(novo)) {
            return { col: f.col, label: f.label, current, novo, display: f.fmt ? f.fmt(novo) : String(novo) };
          }
          return null;
        })
        .filter(Boolean) as any[];

      setDiffs(found);
      setChecked(Object.fromEntries(found.map((d) => [d.col, true])));
      if (found.length === 0) {
        toast({ title: "Nada a completar", description: "Todos os campos disponíveis já estão preenchidos." });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na busca", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const aplicar = async () => {
    if (!diffs) return;
    const payload: Record<string, any> = {};
    diffs.forEach((d) => { if (checked[d.col]) payload[d.col] = d.novo; });
    if (Object.keys(payload).length === 0) { onOpenChange(false); return; }
    setSaving(true);
    const { error } = await supabase.from("processos").update(payload).eq("id", processoId);
    setSaving(false);
    if (error) { toast({ variant: "destructive", title: "Erro ao salvar", description: error.message }); return; }
    toast({ title: "Dados completados", description: `${Object.keys(payload).length} campo(s) preenchido(s).` });
    onApplied?.();
    onOpenChange(false);
    setDiffs(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setDiffs(null); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <span className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Sparkles className="h-4 w-4" /></span>
            Completar dados pelo tribunal
          </DialogTitle>
          <DialogDescription className="text-xs">Busca os dados oficiais e preenche só os campos vazios — você confirma antes.</DialogDescription>
        </DialogHeader>

        {diffs === null ? (
          <div className="py-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Vamos consultar o processo <span className="font-bold text-foreground">{numeroProcesso}</span> e mostrar o que pode ser completado.</p>
            <Button onClick={buscar} disabled={loading} className="rounded-xl font-bold gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Buscando…" : "Buscar dados"}
            </Button>
          </div>
        ) : diffs.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Nada a completar — os campos já estão preenchidos.</div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pt-1">
            {diffs.map((d) => (
              <label key={d.col} className="flex items-start gap-3 p-3 rounded-xl border border-black/5 dark:border-border cursor-pointer hover:bg-muted/30">
                <Checkbox checked={checked[d.col]} onCheckedChange={(v) => setChecked((c) => ({ ...c, [d.col]: !!v }))} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{d.label}</p>
                  <p className="text-sm font-bold flex items-center gap-1.5 flex-wrap">
                    <span className="text-muted-foreground/40 line-through">vazio</span>
                    <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-foreground">{d.display}</span>
                  </p>
                </div>
              </label>
            ))}
            <div className="flex gap-2 pt-2">
              <Button onClick={aplicar} disabled={saving} className="flex-1 rounded-xl font-bold">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Aplicar selecionados
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
