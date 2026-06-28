import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Target } from "lucide-react";
import type { PontosConfig, MetaConfig } from "@/hooks/useChartsData";

export function ChartsConfigDialog({
  open, onClose, officeId, pontos, meta, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  officeId: string;
  pontos: PontosConfig;
  meta: MetaConfig;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<PontosConfig>(pontos);
  const [metaForm, setMetaForm] = useState({ area: meta?.area || "", alvo: meta?.alvo || 0, label: meta?.label || "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(pontos);
      setMetaForm({ area: meta?.area || "", alvo: meta?.alvo || 0, label: meta?.label || "" });
    }
  }, [open, pontos, meta]);

  const handleSave = async () => {
    setSaving(true);
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", officeId).maybeSingle();
    const merged = {
      ...((cur?.settings as any) || {}),
      chart_pontos: {
        tarefa: Number(form.tarefa) || 0, prazo: Number(form.prazo) || 0,
        audiencia: Number(form.audiencia) || 0, processo: Number(form.processo) || 0,
      },
      chart_meta: metaForm.area.trim() && metaForm.alvo > 0
        ? { area: metaForm.area.trim(), alvo: Number(metaForm.alvo), label: metaForm.label.trim() || metaForm.area.trim() }
        : null,
    };
    const { error } = await supabase.from("offices").update({ settings: merged }).eq("id", officeId);
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Configuração salva" });
    onSaved();
    onClose();
  };

  const pontoFields: { key: keyof PontosConfig; label: string }[] = [
    { key: "tarefa", label: "Tarefa concluída" },
    { key: "prazo", label: "Prazo cumprido" },
    { key: "audiencia", label: "Audiência realizada" },
    { key: "processo", label: "Processo encerrado" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden max-h-[88vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base font-black">Configurar Gráficos</DialogTitle>
          <DialogDescription className="text-xs">Pontuação de produtividade e meta de contratos.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Pontuação */}
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-500" /> Pontuação por finalização
            </p>
            <div className="grid grid-cols-2 gap-3">
              {pontoFields.map(f => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
                  <Input type="number" min={0} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                    className="h-9 rounded-xl" />
                </div>
              ))}
            </div>
          </div>

          {/* Meta de contratos */}
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-primary" /> Meta de contratos por produto
            </p>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Produto / Área de atuação (igual ao "tipo" do processo)</Label>
              <Input placeholder="Ex: Trabalhista, Previdenciário…" value={metaForm.area}
                onChange={e => setMetaForm(m => ({ ...m, area: e.target.value }))} className="h-9 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Meta (qtde no período)</Label>
                <Input type="number" min={0} value={metaForm.alvo}
                  onChange={e => setMetaForm(m => ({ ...m, alvo: Number(e.target.value) }))} className="h-9 rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Rótulo (opcional)</Label>
                <Input placeholder="Ex: Foco 2026" value={metaForm.label}
                  onChange={e => setMetaForm(m => ({ ...m, label: e.target.value }))} className="h-9 rounded-xl" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60">Conta os processos criados no período cujo "tipo" é igual ao produto. Deixe a meta em 0 para desativar.</p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs font-bold" disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} className="rounded-xl text-xs font-black" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
