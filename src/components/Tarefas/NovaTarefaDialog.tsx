import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tarefa, TarefaInput } from "@/hooks/useTarefas";

interface ClienteOption { id: string; nome: string; }

interface NovaTarefaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: ClienteOption[];
  tarefa?: Tarefa | null;
  onSubmit: (input: TarefaInput, id?: string) => Promise<void>;
}

const prioridades = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

const empty = { titulo: "", descricao: "", data_vencimento: "", prioridade: "media", cliente_id: "" };

export const NovaTarefaDialog = ({ open, onOpenChange, clientes, tarefa, onSubmit }: NovaTarefaDialogProps) => {
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
        cliente_id: tarefa.cliente_id || "",
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
    const input: TarefaInput = {
      titulo: formData.titulo.trim(),
      descricao: formData.descricao || null,
      data_vencimento: formData.data_vencimento || null,
      prioridade: formData.prioridade,
      cliente_id: formData.cliente_id || null,
    };
    setSaving(true);
    try {
      await onSubmit(input, tarefa?.id);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-3xl">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente</Label>
              <Select value={formData.cliente_id} onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {clientes.length === 0 && <SelectItem value="none" disabled>Nenhum cliente</SelectItem>}
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" placeholder="Detalhes da tarefa..." value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={3} className="rounded-xl" />
          </div>

          <div className="flex gap-2 pt-2">
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
