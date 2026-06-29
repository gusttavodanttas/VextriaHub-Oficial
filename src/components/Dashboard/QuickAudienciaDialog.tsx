import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Gavel } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAudiencias } from "@/hooks/useAudiencias";
import { useAudienciaTipos } from "@/hooks/useAudienciaTipos";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onSuccess?: () => void; }

export function QuickAudienciaDialog({ open, onOpenChange, onSuccess }: Props) {
  const { user } = useAuth();
  const { create } = useAudiencias();
  const { tipos = [] } = useAudienciaTipos();
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ titulo: "", tipo: "", data: "", local: "", cliente_id: "", obs: "" });

  useEffect(() => {
    if (!open || !user?.office_id) return;
    supabase.from("clientes").select("id, nome").eq("office_id", user.office_id).eq("deletado", false).order("nome")
      .then(({ data }) => setClientes((data as any) || []));
    setForm({ titulo: "", tipo: "", data: "", local: "", cliente_id: "", obs: "" });
  }, [open, user?.office_id]);

  const salvar = () => {
    if (!form.titulo.trim() || !form.data) return;
    setSaving(true);
    create.mutate(
      {
        titulo: form.titulo.trim(),
        tipo: form.tipo || null,
        data_audiencia: form.data,
        local: form.local.trim() || null,
        status: "agendada",
        observacoes: form.obs.trim() || null,
        cliente_id: form.cliente_id || null,
        responsavel_id: user?.id || null,
      },
      {
        onSuccess: () => { setSaving(false); onSuccess?.(); onOpenChange(false); },
        onError: () => setSaving(false),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <span className="h-8 w-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center"><Gavel className="h-4 w-4" /></span>
            Nova Audiência
          </DialogTitle>
          <DialogDescription className="sr-only">Agendar audiência rápida</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Título *</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Audiência de conciliação" className="h-11 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Data e hora *</Label>
              <Input type="datetime-local" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>{tipos.map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Cliente</Label>
            <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent className="max-h-[240px]">{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Local</Label>
            <Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Fórum / vara" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Observações</Label>
            <Textarea value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} rows={2} className="rounded-xl resize-none" placeholder="Opcional" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={salvar} disabled={saving || !form.titulo.trim() || !form.data} className="flex-1 rounded-xl font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Agendar
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
