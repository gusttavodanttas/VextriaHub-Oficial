
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Target } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CreateGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (goal: any) => void;
}

export const CreateGoalDialog = ({ open, onOpenChange, onSave }: CreateGoalDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    titulo: "",
    tipo: "",
    periodo: "",
    dataInicio: undefined as Date | undefined,
    dataFim: undefined as Date | undefined,
    valorMeta: "",
    descricao: ""
  });

  const tiposMeta = [
    { value: "processos", label: "Processos Finalizados" },
    { value: "clientes", label: "Novos Clientes" },
    { value: "receita", label: "Receita (R$)" },
    { value: "audiencias", label: "Audiências Realizadas" },
    { value: "atendimentos", label: "Atendimentos" },
    { value: "prazos", label: "Prazos Cumpridos" }
  ];

  const periodos = [
    { value: "mensal", label: "Mensal" },
    { value: "trimestral", label: "Trimestral" },
    { value: "semestral", label: "Semestral" },
    { value: "anual", label: "Anual" },
    { value: "personalizado", label: "Personalizado" }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titulo || !formData.tipo || !formData.periodo || !formData.valorMeta) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const novaMeta = {
      id: Date.now(),
      titulo: formData.titulo,
      tipo: formData.tipo,
      periodo: formData.periodo,
      dataInicio: formData.dataInicio || new Date(),
      dataFim: formData.dataFim || new Date(),
      valorMeta: parseFloat(formData.valorMeta),
      valorAtual: 0,
      descricao: formData.descricao,
      status: "ativa",
      createdAt: new Date()
    };

    onSave(novaMeta);
    
    toast({
      title: "Meta criada",
      description: "A meta foi criada com sucesso.",
    });

    // Reset form
    setFormData({
      titulo: "",
      tipo: "",
      periodo: "",
      dataInicio: undefined,
      dataFim: undefined,
      valorMeta: "",
      descricao: ""
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Nova Meta
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título da Meta *</Label>
            <Input
              id="titulo"
              placeholder="Ex: Meta de Receita Mensal"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Meta *</Label>
            <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {tiposMeta.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="periodo">Período *</Label>
            <Select value={formData.periodo} onValueChange={(value) => setFormData({ ...formData, periodo: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {periodos.map((periodo) => (
                  <SelectItem key={periodo.value} value={periodo.value}>
                    {periodo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.periodo === "personalizado" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.dataInicio && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.dataInicio ? (
                        format(formData.dataInicio, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        "Selecionar"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.dataInicio}
                      onSelect={(date) => setFormData({ ...formData, dataInicio: date })}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.dataFim && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.dataFim ? (
                        format(formData.dataFim, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        "Selecionar"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.dataFim}
                      onSelect={(date) => setFormData({ ...formData, dataFim: date })}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="valorMeta">Valor da Meta *</Label>
            <Input
              id="valorMeta"
              type="number"
              step="0.01"
              placeholder={formData.tipo === "receita" ? "50000.00" : "20"}
              value={formData.valorMeta}
              onChange={(e) => setFormData({ ...formData, valorMeta: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              placeholder="Descreva os detalhes da meta..."
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              Criar Meta
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
