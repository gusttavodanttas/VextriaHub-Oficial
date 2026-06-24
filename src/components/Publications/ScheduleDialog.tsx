
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ScheduleDialogProps {
  publicationTitle: string;
  processNumber: string;
  type: "prazo" | "audiencia";
  iconOnly?: boolean;
}

export const ScheduleDialog = ({ publicationTitle, processNumber, type, iconOnly }: ScheduleDialogProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    description: "",
    priority: "media"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    toast({
      title: `${type === "prazo" ? "Prazo" : "Audiência"} agendado(a)`,
      description: `${type === "prazo" ? "Prazo" : "Audiência"} para ${formData.date} às ${formData.time} foi adicionado(a) ao calendário.`,
    });
    
    setIsOpen(false);
    setFormData({ date: "", time: "", description: "", priority: "media" });
  };

  const icon = type === "prazo" ? Calendar : Clock;
  const title = type === "prazo" ? "Agendar Prazo" : "Agendar Audiência";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className={iconOnly ? "h-12 w-full rounded-2xl" : "flex-1"} title={title}>
          {React.createElement(icon, { className: iconOnly ? "h-5 w-5" : "h-4 w-4 mr-2" })}
          {!iconOnly && title}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {React.createElement(icon, { className: "h-5 w-5" })}
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Processo</Label>
            <Input value={processNumber} disabled className="bg-muted" />
          </div>
          
          <div className="space-y-2">
            <Label>Publicação</Label>
            <Input value={publicationTitle} disabled className="bg-muted text-sm" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="priority">Prioridade</Label>
            <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Observações</Label>
            <Textarea
              id="description"
              placeholder={`Detalhes sobre o ${type}...`}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              Agendar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
