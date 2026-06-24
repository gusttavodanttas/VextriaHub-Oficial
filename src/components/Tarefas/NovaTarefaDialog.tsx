import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TarefaFormData, TarefaPriority } from "@/types/tarefa";

interface NovaTarefaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTarefa: (tarefa: TarefaFormData) => void;
}

export const NovaTarefaDialog = ({ open, onOpenChange, onAddTarefa }: NovaTarefaDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<TarefaFormData>({
    title: "",
    client: "",
    case: "",
    dueDate: "",
    priority: "media",
    points: 10,
    description: ""
  });

  const priorityOptions: { value: TarefaPriority; label: string; color: string }[] = [
    { value: "alta", label: "Alta", color: "text-red-600" },
    { value: "media", label: "Média", color: "text-yellow-600" },
    { value: "baixa", label: "Baixa", color: "text-green-600" }
  ];

  const pointsOptions = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.client || !formData.case || !formData.dueDate) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    onAddTarefa(formData);
    
    toast({
      title: "Tarefa criada",
      description: "A tarefa foi criada com sucesso.",
    });
    
    onOpenChange(false);
    setFormData({
      title: "",
      client: "",
      case: "",
      dueDate: "",
      priority: "media",
      points: 10,
      description: ""
    });
  };

  const handleCancel = () => {
    onOpenChange(false);
    setFormData({
      title: "",
      client: "",
      case: "",
      dueDate: "",
      priority: "media",
      points: 10,
      description: ""
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Protocolar petição inicial"
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client">Cliente *</Label>
              <Input
                id="client"
                value={formData.client}
                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                placeholder="Nome do cliente"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="case">Caso *</Label>
              <Input
                id="case"
                value={formData.case}
                onChange={(e) => setFormData({ ...formData, case: e.target.value })}
                placeholder="Ex: Trabalhista #2025-001"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Data de Vencimento *</Label>
              <Input
                id="dueDate"
                type="datetime-local"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Select value={formData.priority} onValueChange={(value: TarefaPriority) => setFormData({ ...formData, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className={option.color}>{option.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="points">Pontos</Label>
              <Select value={formData.points.toString()} onValueChange={(value) => setFormData({ ...formData, points: parseInt(value) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pointsOptions.map((points) => (
                    <SelectItem key={points} value={points.toString()}>
                      {points} pontos
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Descrição detalhada da tarefa..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              Criar Tarefa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};