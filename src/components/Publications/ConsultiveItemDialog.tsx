
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Tag, User, Trash2 } from "lucide-react";

interface ConsultiveItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: "alta" | "media" | "baixa";
  status: "pendente" | "em_andamento" | "concluido";
  createdAt: string;
  tags: string[];
  cliente?: string;
}

interface ConsultiveItemDialogProps {
  item: ConsultiveItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: ConsultiveItem) => void;
  onDelete?: (itemId: string) => void;
  mode: "view" | "edit";
  onModeChange: (mode: "view" | "edit") => void;
}

export const ConsultiveItemDialog = ({ 
  item, 
  open, 
  onOpenChange, 
  onSave, 
  onDelete,
  mode, 
  onModeChange 
}: ConsultiveItemDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<ConsultiveItem>({
    id: "",
    title: "",
    description: "",
    category: "",
    priority: "media",
    status: "pendente",
    createdAt: "",
    tags: [],
    cliente: ""
  });

  const categories = [
    { value: "contratos", label: "Contratos" },
    { value: "trabalhista", label: "Trabalhista" },
    { value: "tributario", label: "Tributário" },
    { value: "civil", label: "Civil" },
    { value: "empresarial", label: "Empresarial" }
  ];

  useEffect(() => {
    if (item) {
      setFormData(item);
    }
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.category) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    onSave(formData);
    
    toast({
      title: "Item atualizado",
      description: "O item consultivo foi atualizado com sucesso.",
    });
    
    onModeChange("view");
  };

  const handleStatusChange = (newStatus: string) => {
    const updatedItem = { ...formData, status: newStatus as "pendente" | "em_andamento" | "concluido" };
    setFormData(updatedItem);
    onSave(updatedItem);
    
    toast({
      title: "Status atualizado",
      description: `Status alterado para ${newStatus.replace('_', ' ')}.`,
    });
  };

  const handleDelete = () => {
    if (item && onDelete) {
      onDelete(item.id);
      onOpenChange(false);
      
      toast({
        title: "Item excluído",
        description: "O item consultivo foi excluído com sucesso.",
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "alta": return "destructive";
      case "media": return "default";
      case "baixa": return "secondary";
      default: return "default";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "concluido": return "default";
      case "em_andamento": return "secondary";
      case "pendente": return "outline";
      default: return "outline";
    }
  };

  const getCategoryLabel = (value: string) => {
    return categories.find(c => c.value === value)?.label || value;
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "view" ? "Detalhes do Item Consultivo" : "Editar Item Consultivo"}
          </DialogTitle>
        </DialogHeader>
        
        {mode === "view" ? (
          <div className="space-y-6">
            {/* Header com badges */}
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">{item.title}</h2>
                <div className="flex gap-2">
                  <Badge variant={getPriorityColor(item.priority)}>
                    {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                  </Badge>
                  <Badge variant={getStatusColor(item.status)}>
                    {item.status.replace('_', ' ').charAt(0).toUpperCase() + item.status.replace('_', ' ').slice(1)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Informações principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Categoria</p>
                  <p className="font-medium">{getCategoryLabel(item.category)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Data de Criação</p>
                  <p className="font-medium">{new Date(item.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              {item.cliente && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">{item.cliente}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label>Descrição</Label>
              <div className="p-3 bg-muted/30 rounded-md">
                <p className="text-sm leading-relaxed">{item.description}</p>
              </div>
            </div>

            {/* Tags */}
            {item.tags.length > 0 && (
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2 flex-wrap">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={() => onModeChange("edit")} className="flex-1">
                Editar
              </Button>
              {item.status !== "concluido" && (
                <Button 
                  variant="secondary" 
                  onClick={() => handleStatusChange("concluido")}
                  className="flex-1"
                >
                  Marcar como Concluído
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descrição *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Select value={formData.priority} onValueChange={(value: "alta" | "media" | "baixa") => setFormData({ ...formData, priority: value })}>
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
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: "pendente" | "em_andamento" | "concluido") => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
              <Input
                id="tags"
                value={formData.tags.join(', ')}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })}
                placeholder="contrato, revisao, urgente"
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onModeChange("view")} className="flex-1">
                Cancelar
              </Button>
              {onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir este item consultivo? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button type="submit" className="flex-1">
                Salvar Alterações
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
