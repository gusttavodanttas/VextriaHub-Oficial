import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquareText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConsultivos } from "@/hooks/useConsultivos";
import { ClientSelect } from "@/components/Clientes/ClientSelect";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onSuccess?: () => void; }

const PRIORIDADES = [{ v: "baixa", l: "Baixa" }, { v: "media", l: "Média" }, { v: "alta", l: "Alta" }];

export function QuickConsultivoDialog({ open, onOpenChange, onSuccess }: Props) {
  const { user } = useAuth();
  const { create } = useConsultivos();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ titulo: "", categoria: "", prioridade: "media", cliente_id: "", descricao: "" });

  useEffect(() => {
    if (!open) return;
    setForm({ titulo: "", categoria: "", prioridade: "media", cliente_id: "", descricao: "" });
  }, [open]);

  const salvar = async () => {
    if (!form.titulo.trim()) return;
    setSaving(true);
    const ok = await create({
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      categoria: form.categoria.trim() || null,
      prioridade: form.prioridade,
      status: "novo",
      cliente_id: form.cliente_id || null,
    } as any);
    setSaving(false);
    if (ok) { onSuccess?.(); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <span className="h-8 w-8 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center"><MessageSquareText className="h-4 w-4" /></span>
            Novo Consultivo
          </DialogTitle>
          <DialogDescription className="sr-only">Criar demanda consultiva rápida</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Título *</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Parecer contratual" className="h-11 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Categoria</Label>
              <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Opcional" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORIDADES.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Cliente (opcional)</Label>
            <ClientSelect value={form.cliente_id} onValueChange={(id) => setForm({ ...form, cliente_id: id })} placeholder="Sem cliente" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} className="rounded-xl resize-none" placeholder="Opcional" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={salvar} disabled={saving || !form.titulo.trim()} className="flex-1 rounded-xl font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Criar
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
