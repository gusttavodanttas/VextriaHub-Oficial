import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar as CalendarIcon, Clock, MapPin, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ClientSelect } from "@/components/Clientes/ClientSelect";

interface NovoCompromissoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  onCreated?: () => void;
}

interface FormData {
  titulo: string;
  cliente_id: string;
  cliente_nome: string;
  processo_id: string;
  processo_label: string;
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
  { value: "outro", label: "Outro" }
];

const SEM_HORARIO = ["tarefa", "prazo"];

const statusOptions = [
  { value: "agendado", label: "Agendado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "pendente", label: "Pendente" }
];

const emptyForm = (date?: Date): FormData => ({
  titulo: "",
  cliente_id: "",
  cliente_nome: "",
  processo_id: "",
  processo_label: "",
  data: date || new Date(),
  horario: "",
  tipo: "",
  local: "",
  descricao: "",
  status: "agendado"
});

interface Processo { id: string; label: string; }

const ProcessoSelect: React.FC<{
  value: string;
  onValueChange: (id: string, label: string) => void;
}> = ({ value, onValueChange }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [processos, setProcessos] = useState<Processo[]>([]);

  useEffect(() => {
    if (!user?.office_id) return;
    supabase
      .from("processos")
      .select("id, numero_processo, titulo")
      .eq("office_id", user.office_id)
      .order("numero_processo")
      .then(({ data }) => {
        setProcessos(
          (data || []).map((p: any) => ({
            id: p.id,
            label: p.numero_processo || p.titulo || p.id,
          }))
        );
      });
  }, [user]);

  const selected = processos.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{selected ? selected.label : "Selecionar processo..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar processo..." />
          <CommandList>
            <CommandEmpty>Nenhum processo encontrado.</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem value="__none__" onSelect={() => { onValueChange("", ""); setOpen(false); }}>
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  <span className="text-muted-foreground">Remover vínculo</span>
                </CommandItem>
              )}
              {processos.map((p) => (
                <CommandItem key={p.id} value={p.label} onSelect={() => { onValueChange(p.id, p.label); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  {p.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export const NovoCompromissoDialog: React.FC<NovoCompromissoDialogProps> = ({
  open,
  onOpenChange,
  selectedDate,
  onCreated
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm(selectedDate));

  // Atualiza data se selectedDate mudar
  useEffect(() => {
    if (open) setFormData(emptyForm(selectedDate));
  }, [open, selectedDate]);

  const precisaHorario = !SEM_HORARIO.includes(formData.tipo);

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
      const processoId = formData.processo_id || null;
      const clienteId = formData.cliente_id || null;

      let error;

      if (formData.tipo === "audiencia") {
        ({ error } = await supabase.from("audiencias").insert({
          user_id: user.id, office_id: user.office_id,
          cliente_id: clienteId,
          processo_id: processoId,
          titulo: formData.titulo,
          data_audiencia: datetime.toISOString(),
          local: formData.local,
          observacoes: formData.descricao,
          status: formData.status,
        }));
      } else if (formData.tipo === "tarefa") {
        ({ error } = await supabase.from("tarefas").insert({
          user_id: user.id, office_id: user.office_id,
          cliente_id: clienteId,
          processo_id: processoId,
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
        // reuniao / consulta / outro → atendimentos
        ({ error } = await supabase.from("atendimentos").insert({
          user_id: user.id, office_id: user.office_id,
          cliente_id: clienteId,
          processo_id: processoId,
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

  const set = (field: keyof FormData, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.data && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.data ? format(formData.data, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={formData.data} onSelect={(d) => set("data", d)} locale={ptBR} initialFocus />
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
              <ClientSelect
                value={formData.cliente_id}
                onValueChange={(id, name) => { set("cliente_id", id); set("cliente_nome", name); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Processo</Label>
              <ProcessoSelect
                value={formData.processo_id}
                onValueChange={(id, label) => { set("processo_id", id); set("processo_label", label); }}
              />
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
