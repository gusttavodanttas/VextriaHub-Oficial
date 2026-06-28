import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface NovoCompromissoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  onCreated?: () => void;
}

interface FormData {
  titulo: string;
  cliente_id: string;
  processo_id: string;
  data: Date | undefined;
  horario: string;
  tipo: string;
  local: string;
  descricao: string;
  status: string;
}

const tipos = [
  { value: "audiencia", label: "Audiência" },
  { value: "reuniao", label: "Reunião / Atendimento" },
  { value: "consulta", label: "Consulta" },
  { value: "tarefa", label: "Tarefa" },
  { value: "prazo", label: "Prazo" },
  { value: "outro", label: "Outro" },
];

const SEM_HORARIO = ["tarefa", "prazo"];

const statusOptions = [
  { value: "agendado", label: "Agendado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "pendente", label: "Pendente" },
];

const NONE = "__none__";

const emptyForm = (date?: Date): FormData => ({
  titulo: "",
  cliente_id: NONE,
  processo_id: NONE,
  data: date || new Date(),
  horario: "",
  tipo: "",
  local: "",
  descricao: "",
  status: "agendado",
});

export const NovoCompromissoDialog: React.FC<NovoCompromissoDialogProps> = ({
  open,
  onOpenChange,
  selectedDate,
  onCreated,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm(selectedDate));
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [processos, setProcessos] = useState<{ id: string; titulo: string; numero: string }[]>([]);
  const [calOpen, setCalOpen] = useState(false);

  useEffect(() => {
    if (open) setFormData(emptyForm(selectedDate));
  }, [open, selectedDate]);

  // Busca clientes ao abrir
  useEffect(() => {
    if (!open || !user?.office_id) return;
    supabase
      .from("clientes")
      .select("id, nome")
      .eq("office_id", user.office_id)
      .eq("deletado", false)
      .order("nome")
      .then(({ data }) => setClientes(data || []));
  }, [open, user]);

  // Busca processos quando cliente muda
  useEffect(() => {
    if (!user?.office_id) return;
    const clienteId = formData.cliente_id === NONE ? null : formData.cliente_id;
    let q = supabase
      .from("processos")
      .select("id, titulo, numero_processo")
      .eq("office_id", user.office_id)
      .eq("deletado", false)
      .order("titulo");
    if (clienteId) q = (q as any).eq("cliente_id", clienteId);
    q.then(({ data }) =>
      setProcessos(
        (data || []).map((p: any) => ({
          id: p.id,
          titulo: p.titulo || p.numero_processo || p.id,
          numero: p.numero_processo || "",
        }))
      )
    );
  }, [formData.cliente_id, user]);

  const precisaHorario = !SEM_HORARIO.includes(formData.tipo);

  const set = (field: keyof FormData, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titulo || !formData.data || !formData.tipo || (precisaHorario && !formData.horario)) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    if (!user) return;
    setLoading(true);

    try {
      const datetime = new Date(formData.data);
      if (precisaHorario && formData.horario) {
        const [h, m] = formData.horario.split(":").map(Number);
        datetime.setHours(h, m);
      }
      const dataYmd = format(formData.data, "yyyy-MM-dd");
      const clienteId = formData.cliente_id === NONE ? null : formData.cliente_id;
      const processoId = formData.processo_id === NONE ? null : formData.processo_id;

      let error: any;

      if (formData.tipo === "audiencia") {
        ({ error } = await supabase.from("audiencias").insert({
          user_id: user.id, office_id: user.office_id,
          cliente_id: clienteId, processo_id: processoId,
          titulo: formData.titulo,
          data_audiencia: datetime.toISOString(),
          local: formData.local,
          observacoes: formData.descricao,
          status: formData.status,
        }));
      } else if (formData.tipo === "tarefa") {
        ({ error } = await supabase.from("tarefas").insert({
          user_id: user.id, office_id: user.office_id,
          cliente_id: clienteId, processo_id: processoId,
          titulo: formData.titulo,
          descricao: formData.descricao || null,
          data_vencimento: dataYmd,
          prioridade: "media",
          concluida: false,
          deletado: false,
        }));
      } else if (formData.tipo === "prazo") {
        ({ error } = await supabase.from("prazos").insert({
          user_id: user.id, office_id: user.office_id,
          processo_id: processoId,
          titulo: formData.titulo,
          descricao: formData.descricao || null,
          data_fim_prazo: dataYmd,
          prioridade: "media",
          status: "pendente",
        }));
      } else {
        ({ error } = await supabase.from("atendimentos").insert({
          user_id: user.id, office_id: user.office_id,
          cliente_id: clienteId, processo_id: processoId,
          tipo_atendimento: formData.tipo,
          data_atendimento: datetime.toISOString(),
          observacoes: formData.descricao,
          status: formData.status,
        }));
      }

      if (error) throw error;

      toast({
        title: "Compromisso criado",
        description: `${formData.titulo} • ${format(formData.data, "d 'de' MMMM", { locale: ptBR })}${precisaHorario && formData.horario ? ` às ${formData.horario}` : ""}.`,
      });

      onCreated?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao salvar compromisso:", err);
      toast({ title: "Erro", description: err?.message || "Falha ao salvar no banco de dados.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Novo Compromisso
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              placeholder="Ex: Reunião com cliente"
              required
            />
          </div>

          {/* Tipo + Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data + Horário */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !formData.data && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.data ? format(formData.data, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" side="bottom" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.data}
                    onSelect={(d) => { set("data", d); setCalOpen(false); }}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {precisaHorario && (
              <div className="space-y-2">
                <Label htmlFor="horario">Horário *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="horario"
                    type="time"
                    value={formData.horario}
                    onChange={(e) => set("horario", e.target.value)}
                    className="pl-10"
                    required={precisaHorario}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cliente + Processo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select
                value={formData.cliente_id}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, cliente_id: v, processo_id: NONE }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Processo</Label>
              <Select
                value={formData.processo_id}
                onValueChange={(v) => set("processo_id", v)}
                disabled={processos.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    formData.cliente_id === NONE
                      ? "Selecione um cliente primeiro"
                      : processos.length === 0
                      ? "Nenhum processo encontrado"
                      : "Selecionar processo..."
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {processos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex flex-col">
                        <span>{p.titulo}</span>
                        {p.numero && p.numero !== p.titulo && (
                          <span className="text-xs text-muted-foreground">{p.numero}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Local (oculto para tarefa/prazo) */}
          {precisaHorario && (
            <div className="space-y-2">
              <Label htmlFor="local">Local</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="local"
                  value={formData.local}
                  onChange={(e) => set("local", e.target.value)}
                  placeholder="Ex: Escritório, Fórum, Online"
                  className="pl-10"
                />
              </div>
            </div>
          )}

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Salvando..." : "Criar Compromisso"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
