import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Audiencia, AudienciaInput } from "@/hooks/useAudiencias";

interface ClienteOption { id: string; nome: string; }

interface NovaAudienciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: ClienteOption[];
  audiencia?: Audiencia | null;
  onSubmit: (input: AudienciaInput, id?: string) => Promise<void>;
}

const tiposAudiencia = [
  "Conciliação", "Instrução", "Una", "Julgamento",
  "Trabalhista", "Família", "Previdenciário", "Cível", "Criminal", "Tributário",
];

const statusOptions = [
  { value: "agendada", label: "Agendada" },
  { value: "confirmada", label: "Confirmada" },
  { value: "pendente", label: "Pendente" },
  { value: "realizada", label: "Realizada" },
  { value: "cancelada", label: "Cancelada" },
];

const empty = { titulo: "", cliente_id: "", data: "", hora: "", tipo: "", local: "", observacao: "", status: "agendada" };

export const NovaAudienciaDialog = ({ open, onOpenChange, clientes, audiencia, onSubmit }: NovaAudienciaDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(empty);

  const isEdit = !!audiencia;

  useEffect(() => {
    if (!open) return;
    if (audiencia) {
      const dt = audiencia.data_audiencia ? new Date(audiencia.data_audiencia) : null;
      setFormData({
        titulo: audiencia.titulo || "",
        cliente_id: audiencia.cliente_id || "",
        data: dt ? dt.toISOString().split("T")[0] : "",
        hora: dt ? dt.toTimeString().slice(0, 5) : "",
        tipo: audiencia.tipo || "",
        local: audiencia.local || "",
        observacao: audiencia.observacoes || "",
        status: audiencia.status || "agendada",
      });
    } else {
      setFormData(empty);
    }
  }, [open, audiencia]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.data || !formData.hora || !formData.tipo) {
      toast({ title: "Campos obrigatórios", description: "Preencha título, data, horário e tipo.", variant: "destructive" });
      return;
    }
    const data_audiencia = new Date(`${formData.data}T${formData.hora}:00`).toISOString();
    const input: AudienciaInput = {
      titulo: formData.titulo,
      tipo: formData.tipo,
      data_audiencia,
      local: formData.local || null,
      status: formData.status,
      observacoes: formData.observacao || null,
      cliente_id: formData.cliente_id || null,
    };
    setSaving(true);
    try {
      await onSubmit(input, audiencia?.id);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500"><CalendarPlus className="h-5 w-5" /></div>
            {isEdit ? "Editar Audiência" : "Nova Audiência"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input id="titulo" value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Audiência de Conciliação" className="rounded-xl" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente</Label>
              <Select value={formData.cliente_id} onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {clientes.length === 0 && <SelectItem value="none" disabled>Nenhum cliente cadastrado</SelectItem>}
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data">Data *</Label>
              <Input id="data" type="date" value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })} className="rounded-xl" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora">Horário *</Label>
              <Input id="hora" type="time" value={formData.hora}
                onChange={(e) => setFormData({ ...formData, hora: e.target.value })} className="rounded-xl" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {tiposAudiencia.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="local">Local</Label>
              <Input id="local" value={formData.local}
                onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                placeholder="Ex: Sala 205 - Fórum Central" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">Observações</Label>
            <Textarea id="observacao" placeholder="Observações sobre a audiência..." value={formData.observacao}
              onChange={(e) => setFormData({ ...formData, observacao: e.target.value })} rows={3} className="rounded-xl" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl" disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 rounded-xl font-bold" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar Audiência"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
