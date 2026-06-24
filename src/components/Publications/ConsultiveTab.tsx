import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Search, Filter } from "lucide-react";
import { ConsultiveItemDialog } from "./ConsultiveItemDialog";

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

interface ConsultiveTabProps {
  clienteFilter?: string | null;
}

export const ConsultiveTab = ({ clienteFilter }: ConsultiveTabProps) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ConsultiveItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    priority: "media" as "alta" | "media" | "baixa",
    tags: ""
  });

  const [consultiveItems, setConsultiveItems] = useState<ConsultiveItem[]>([
    {
      id: "1",
      title: "Análise de Contrato de Locação",
      description: "Revisar cláusulas de reajuste e multa rescisória",
      category: "contratos",
      priority: "alta",
      status: "em_andamento",
      createdAt: "2023-12-15",
      tags: ["contrato", "locacao", "revisao"],
      cliente: "Maria Silva"
    },
    {
      id: "2",
      title: "Parecer sobre Demissão por Justa Causa",
      description: "Avaliar se os motivos alegados configuram justa causa",
      category: "trabalhista",
      priority: "media",
      status: "pendente",
      createdAt: "2023-12-14",
      tags: ["trabalhista", "demissao", "parecer"],
      cliente: "João Santos"
    },
    {
      id: "3",
      title: "Consultoria sobre Contratos Empresariais",
      description: "Análise de contratos de prestação de serviços",
      category: "empresarial",
      priority: "alta",
      status: "concluido",
      createdAt: "2023-12-10",
      tags: ["empresarial", "contratos", "consultoria"],
      cliente: "Tech Solutions Ltda"
    }
  ]);

  const categories = [
    { value: "contratos", label: "Contratos" },
    { value: "trabalhista", label: "Trabalhista" },
    { value: "tributario", label: "Tributário" },
    { value: "civil", label: "Civil" },
    { value: "empresarial", label: "Empresarial" }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newItem: ConsultiveItem = {
      id: Date.now().toString(),
      title: formData.title,
      description: formData.description,
      category: formData.category,
      priority: formData.priority,
      status: "pendente",
      createdAt: new Date().toISOString().split('T')[0],
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      cliente: clienteFilter || undefined
    };

    setConsultiveItems([newItem, ...consultiveItems]);
    setFormData({ title: "", description: "", category: "", priority: "media", tags: "" });
    setShowForm(false);
    
    toast({
      title: "Item consultivo criado",
      description: "O novo item foi adicionado com sucesso.",
    });
  };

  const handleViewDetails = (item: ConsultiveItem) => {
    setSelectedItem(item);
    setDialogMode("view");
    setDialogOpen(true);
  };

  const handleEditItem = (item: ConsultiveItem) => {
    setSelectedItem(item);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const handleSaveItem = (updatedItem: ConsultiveItem) => {
    setConsultiveItems(prev => 
      prev.map(item => 
        item.id === updatedItem.id ? updatedItem : item
      )
    );
    setSelectedItem(updatedItem);
  };

  const handleDeleteItem = (itemId: string) => {
    setConsultiveItems(prev => prev.filter(item => item.id !== itemId));
    setDialogOpen(false);
    setSelectedItem(null);
    
    toast({
      title: "Item excluído",
      description: "O item consultivo foi removido com sucesso.",
    });
  };

  const handleStatusChange = (item: ConsultiveItem, newStatus: "pendente" | "em_andamento" | "concluido") => {
    const updatedItem = { ...item, status: newStatus };
    handleSaveItem(updatedItem);
    
    toast({
      title: "Status atualizado",
      description: `Status alterado para ${newStatus.replace('_', ' ')}.`,
    });
  };

  const filteredItems = consultiveItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    const matchesStatus = filterStatus === "all" || item.status === filterStatus;
    const matchesClient = !clienteFilter || item.cliente === clienteFilter;
    
    return matchesSearch && matchesCategory && matchesStatus && matchesClient;
  });

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Consultoria Jurídica
                {clienteFilter && (
                  <Badge variant="secondary" className="ml-2">
                    {clienteFilter}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {clienteFilter 
                  ? `Consultas específicas para ${clienteFilter}`
                  : "Gerencie consultas, pareceres e análises jurídicas"
                }
              </CardDescription>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Item
            </Button>
          </div>
        </CardHeader>
        
        {showForm && (
          <CardContent className="border-t">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Título da consulta"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
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
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva os detalhes da consulta"
                  rows={3}
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
                  <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="contrato, revisao, urgente"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button type="submit">Criar Item</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Itens Consultivos
              {clienteFilter && filteredItems.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
            {!clienteFilter && (
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar itens..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredItems.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {clienteFilter 
                    ? `Nenhum item consultivo encontrado para ${clienteFilter}`
                    : "Nenhum item consultivo encontrado"
                  }
                </h3>
                <p className="text-muted-foreground">
                  {clienteFilter 
                    ? `Crie o primeiro item consultivo para ${clienteFilter}.`
                    : "Crie o primeiro item consultivo."
                  }
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <Card key={item.id} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                        <CardDescription>
                          {categories.find(c => c.value === item.category)?.label} • {item.createdAt}
                          {item.cliente && !clienteFilter && (
                            <> • {item.cliente}</>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={getPriorityColor(item.priority)}>
                          {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                        </Badge>
                        <Badge variant={getStatusColor(item.status)}>
                          {item.status.replace('_', ' ').charAt(0).toUpperCase() + item.status.replace('_', ' ').slice(1)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-4">
                      {item.description}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleViewDetails(item)}>
                        Ver Detalhes
                      </Button>
                      <Button size="sm" onClick={() => handleEditItem(item)}>
                        Editar
                      </Button>
                      {item.status !== "concluido" && (
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => handleStatusChange(item, "concluido")}
                        >
                          Marcar como Concluído
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <ConsultiveItemDialog
        item={selectedItem}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
        mode={dialogMode}
        onModeChange={setDialogMode}
      />
    </div>
  );
};
