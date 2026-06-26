import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, Loader2, Repeat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addDays, addWeeks, addMonths, format } from "date-fns";
import type { Tarefa, TarefaInput } from "@/hooks/useTarefas";

interface Option { id: string; label: string; }

interface NovaTarefaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: Option[];
  processos: Option[];
  atendimentos: Option[];
  tarefa?: Tarefa | null;
  onSubmit: (input: TarefaInput, id?: string) => Promise<void>;
  onSubmitMany: (inputs: TarefaInput[]) => Promise<void>;
}

const prioridades = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

const recorrencias = [
  { value: "nenhuma", label: "Não repetir" },
  { value: "diaria", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
];

const NONE = "__none__";
const empty = { titulo: "", descricao: "", data_vencimento: "", prioridade: "media", cliente_id: NONE, processo_id: NONE, atendimento_id: NONE, recorrencia: "nenhuma", ocorrencias: "4" };

function addByRule(base: Date, rule: string, i: number): Date {
  switch (rule) {
    case "diaria": return addDays(base, i);
    case "semanal": return addWeeks(base, i);
    case "quinzenal": return addDays(base, i * 14);
    case "mensal": return addMonths(base, i);
    default: return base;
  }
}

export const NovaTarefaDialog = ({ open, onOpenChange, clientes, processos, atendimentos, tarefa, onSubmit, onSubmitMany }: NovaTarefaDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(empty);
  const isEdit = !!tarefa;

  useEffect(() => {
    if (!open) return;
    if (tarefa) {
      setFormData({
        titulo: tarefa.titulo || "",
        descricao: tarefa.descricao || "",
        data_vencimento: tarefa.data_vencimento || "",
        prioridade: tarefa.prioridade || "media",
        cliente_id: tarefa.cliente_id || NONE,
        processo_id: tarefa.processo_id || NONE,
        atendimento_id: tarefa.atendimento_id || NONE,
        recorrencia: "nenhuma",
        ocorrencias: "4",
      });
    } else {
      setFormData(empty);
    }
  }, [open, tarefa]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe o título da tarefa.", variant: "destructive" });
      return;
    }
    const recorrente = !isEdit && formData.recorrencia !== "nenhuma";
    if (recorrente && !formData.data_vencimento) {
      toast({ title: "Data necessária", description: "Defina o vencimento para gerar a recorrência.", variant: "destructive" });
      return;
    }

    const base: TarefaInput = {
      titulo: formData.titulo.trim(),
      descricao: formData.descricao || null,
      data_vencimento: formData.data_vencimento || null,
      prioridade: formData.prioridade,
      cliente_id: formData.cliente_id === NONE ? null : formData.cliente_id,
      processo_id: formData.processo_id === NONE ? null : formData.processo_id,
      atendimento_id: formData.atendimento_id === NONE ? null : formData.atendimento_id,
    };

    setSaving(true);
    try {
      if (recorrente) {
        const n = Math.max(1, Math.min(52, parseInt(formData.ocorrencias) || 1));
        const baseDate = new Date(`${formData.data_vencimento}T12:00:00`);
        const inputs: TarefaInput[] = Array.from({ length: n }, (_, i) => ({
          ...base,
          data_vencimento: format(addByRule(baseDate, formData.recorrencia, i), "yyyy-MM-dd"),
        }));
        await onSubmitMany(inputs);
      } else {
        await onSubmit(base, tarefa?.id);
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500"><CheckSquare className="h-5 w-5" /></div>
            {isEdit ? "Editar Tarefa" : "Nova Tarefa"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Atualize os dados da tarefa." : "Preencha os dados para criar uma nova tarefa."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ex: Protocolar petição inicial" className="rounded-xl" required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data">Vencimento</Label>
              <Input id="data" type="date" value={formData.data_vencimento}
                onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select value={formData.prioridade} onValueChange={(v) => setFormData({ ...formData, prioridade: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {prioridades.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vínculos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={formData.cliente_id} onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Processo</Label>
              <Select value={formData.processo_id} onValueChange={(v) => setFormData({ ...formData, processo_id: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {processos.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Atendimento</Label>
              <Select value={formData.atendimento_id} onValueChange={(v) => setFormData({ ...formData, atendimento_id: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {atendimentos.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" placeholder="Detalhes da tarefa..." value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={2} className="rounded-xl" />
          </div>

          {/* Recorrência (só ao criar) */}
          {!isEdit && (
            <div className="rounded-2xl border border-black/5 dark:border-border bg-card/40 p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/70">
                <Repeat className="h-3.5 w-3.5" /> Recorrência
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select value={formData.recorrencia} onValueChange={(v) => setFormData({ ...formData, recorrencia: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {recorrencias.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formData.recorrencia !== "nenhuma" && (
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={52} value={formData.ocorrencias}
                      onChange={(e) => setFormData({ ...formData, ocorrencias: e.target.value })}
                      className="rounded-xl" />
                    <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap">ocorrências</span>
                  </div>
                )}
              </div>
              {formData.recorrencia !== "nenhuma" && (
                <p className="text-[11px] text-muted-foreground">Serão criadas {Math.max(1, Math.min(52, parseInt(formData.ocorrencias) || 1))} tarefas a partir do vencimento.</p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl" disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 rounded-xl font-bold" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar Tarefa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
