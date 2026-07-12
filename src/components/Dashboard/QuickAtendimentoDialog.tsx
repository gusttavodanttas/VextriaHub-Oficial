import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ClientSelect } from "@/components/Clientes/ClientSelect";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onSuccess?: () => void; }

const TIPOS = ["Consulta", "Reunião", "Ligação", "E-mail", "Presencial", "Outro"];

export function QuickAtendimentoDialog({ open, onOpenChange, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ cliente_id: "", tipo: "Consulta", data: today, hora: "09:00", obs: "" });

  useEffect(() => {
    if (!open) return;
    setForm({ cliente_id: "", tipo: "Consulta", data: today, hora: "09:00", obs: "" });
  }, [open]);

  const salvar = async () => {
    if (!user?.office_id) return;
    setSaving(true);
    const payload = {
      tipo_atendimento: form.tipo || null,
      data_atendimento: `${form.data}T${form.hora || "09:00"}:00`,
      observacoes: form.obs.trim() || null,
      status: "agendado",
      cliente_id: form.cliente_id || null,
      processo_id: null as string | null,
      user_id: user.id,
      office_id: user.office_id,
      deletado: false,
      responsavel_id: user.id,
    };
    const { error } = await supabase.from("atendimentos").insert(payload);
    setSaving(false);
    if (error) { toast({ variant: "destructive", title: "Erro ao registrar", description: error.message }); return; }
    toast({ title: "Atendimento registrado!" });
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <span className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><MessageSquare className="h-4 w-4" /></span>
            Novo Atendimento
          </DialogTitle>
          <DialogDescription className="sr-only">Registrar atendimento rápido</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Cliente</Label>
            <ClientSelect value={form.cliente_id} onValueChange={(id) => setForm({ ...form, cliente_id: id })} placeholder="Selecione o cliente" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Hora</Label>
              <Input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Observações</Label>
            <Textarea value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} rows={2} className="rounded-xl resize-none" placeholder="Opcional" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={salvar} disabled={saving} className="flex-1 rounded-xl font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Registrar
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
