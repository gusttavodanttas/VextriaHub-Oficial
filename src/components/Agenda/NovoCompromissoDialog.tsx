import React, { useState } from "react";
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
import { ClientSelect } from "@/components/Clientes/ClientSelect";

interface NovoCompromissoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
}

interface FormData {
  titulo: string;
  cliente_id: string;
  cliente_nome: string;
  data: Date | undefined;
  horario: string;
  tipo: string;
  local: string;
  descricao: string;
  status: string;
}

const tipos = [
  { value: "reuniao", label: "Reunião" },
  { value: "audiencia", label: "Audiência" },
  { value: "consulta", label: "Consulta" },
  { value: "prazo", label: "Prazo" },
  { value: "outro", label: "Outro" }
];

const statusOptions = [
  { value: "agendado", label: "Agendado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "pendente", label: "Pendente" }
];

export const NovoCompromissoDialog: React.FC<NovoCompromissoDialogProps> = ({
  open,
  onOpenChange,
  selectedDate
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    titulo: "",
    cliente_id: "",
    cliente_nome: "",
    data: selectedDate || new Date(),
    horario: "",
    tipo: "",
    local: "",
    descricao: "",
    status: "agendado"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.titulo || !formData.data || !formData.horario || !formData.tipo) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      // Unir data e horário para o timestamp do banco
      const [hours, minutes] = formData.horario.split(':').map(Number);
      const datetime = new Date(formData.data);
      datetime.setHours(hours, minutes);

      let error;

      if (formData.tipo === 'audiencia') {
        const { error: err } = await supabase.from('audiencias').insert({
          user_id: user.id,
          office_id: user.office_id,
          cliente_id: formData.cliente_id || null,
          titulo: formData.titulo,
          data_audiencia: datetime.toISOString(),
          local: formData.local,
          observacoes: formData.descricao,
          status: formData.status
        });
        error = err;
      } else if (formData.tipo === 'prazo') {
        const { error: err } = await supabase.from('prazos').insert({
          user_id: user.id,
          office_id: user.office_id,
          titulo: formData.titulo,
          descricao: formData.descricao,
          data_vencimento: format(formData.data, 'yyyy-MM-dd'),
          status: formData.status === 'agendado' ? 'pendente' : 'concluido'
        });
        error = err;
      } else {
        // Atendimentos/Outros
        const { error: err } = await supabase.from('atendimentos').insert({
          user_id: user.id,
          office_id: user.office_id,
          cliente_id: formData.cliente_id || null, // Atendimentos geralmente precisam de cliente
          tipo_atendimento: formData.tipo,
          data_atendimento: datetime.toISOString(),
          observacoes: formData.descricao,
          status: formData.status
        });
        error = err;
      }

      if (error) throw error;

      toast({
        title: "Compromisso criado",
        description: `${formData.titulo} agendado para ${format(formData.data, "d 'de' MMMM", { locale: ptBR })} às ${formData.horario}.`,
      });

      // Reset form
      setFormData({
        titulo: "",
        cliente_id: "",
        cliente_nome: "",
        data: selectedDate || new Date(),
        horario: "",
        tipo: "",
        local: "",
        descricao: "",
        status: "agendado"
      });

      onOpenChange(false);
    } catch (err) {
      console.error('Erro ao salvar compromisso:', err);
      toast({
        title: "Erro",
        description: "Falha ao salvar o compromisso no banco de dados.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => handleChange('titulo', e.target.value)}
                placeholder="Ex: Reunião com cliente"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente</Label>
              <ClientSelect 
                value={formData.cliente_id} 
                onValueChange={(id, name) => {
                  handleChange('cliente_id', id);
                  handleChange('cliente_nome', name);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.data && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.data ? (
                      format(formData.data, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    ) : (
                      "Selecione a data"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.data}
                    onSelect={(date) => handleChange('data', date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="horario">Horário *</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="horario"
                  type="time"
                  value={formData.horario}
                  onChange={(e) => handleChange('horario', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select value={formData.tipo} onValueChange={(value) => handleChange('tipo', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="local">Local</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="local"
                value={formData.local}
                onChange={(e) => handleChange('local', e.target.value)}
                placeholder="Ex: Escritório, Fórum, Online"
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              placeholder="Detalhes adicionais sobre o compromisso..."
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