import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTimesheet } from "@/hooks/useTimesheet";
import { TIMESHEET_CATEGORIAS, TimesheetCategoria } from "@/types/timesheet";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onSuccess?: () => void; }

const LABELS: Record<string, string> = {
  atendimento: "Atendimento", processo: "Processo", reuniao: "Reunião", administrativa: "Administrativa",
  audiencia: "Audiência", peticao: "Petição", consulta: "Consulta", pesquisa: "Pesquisa",
};

export function QuickTimesheetDialog({ open, onOpenChange, onSuccess }: Props) {
  const { user } = useAuth();
  const { startTimer } = useTimesheet();
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ descricao: string; categoria: TimesheetCategoria; cliente_id: string }>({ descricao: "", categoria: "atendimento", cliente_id: "" });

  useEffect(() => {
    if (!open || !user?.office_id) return;
    supabase.from("clientes").select("id, nome").eq("office_id", user.office_id).eq("deletado", false).order("nome")
      .then(({ data }) => setClientes((data as any) || []));
    setForm({ descricao: "", categoria: "atendimento", cliente_id: "" });
  }, [open, user?.office_id]);

  const iniciar = async () => {
    if (!form.descricao.trim()) return;
    setSaving(true);
    const res = await startTimer(form.descricao.trim(), form.categoria, form.cliente_id || undefined);
    setSaving(false);
    if (res) { onSuccess?.(); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <span className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Clock className="h-4 w-4" /></span>
            Iniciar Timer
          </DialogTitle>
          <DialogDescription className="sr-only">Iniciar cronômetro de tempo</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Descrição da atividade *</Label>
            <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="O que você vai fazer?" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Categoria</Label>
            <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v as TimesheetCategoria })}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{TIMESHEET_CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{LABELS[c] || c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Cliente (opcional)</Label>
            <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Sem cliente" /></SelectTrigger>
              <SelectContent className="max-h-[240px]">{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={iniciar} disabled={saving || !form.descricao.trim()} className="flex-1 rounded-xl font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />} Iniciar
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
