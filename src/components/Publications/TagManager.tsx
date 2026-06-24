import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import { useToast } from "@/hooks/use-toast";
import { Tag, Plus, Trash2, Edit2, Palette } from "lucide-react";

interface TagItem {
  id: string;
  name: string;
  color: string;
  category: string;
  description?: string;
  usageCount: number;
}

export const TagManager = () => {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    color: "gray",
    category: "",
    description: ""
  });

  const [tags, setTags] = useState<TagItem[]>([
    {
      id: "1",
      name: "urgente",
      color: "red",
      category: "prioridade",
      description: "Para casos que requerem atenção imediata",
      usageCount: 15
    },
    {
      id: "2",
      name: "citacao",
      color: "blue",
      category: "tipo",
      description: "Publicações de citação",
      usageCount: 8
    },
    {
      id: "3",
      name: "sentenca",
      color: "green",
      category: "tipo",
      description: "Sentenças judiciais",
      usageCount: 12
    },
    {
      id: "4",
      name: "procedente",
      color: "emerald",
      category: "resultado",
      description: "Ações julgadas procedentes",
      usageCount: 6
    },
    {
      id: "5",
      name: "trabalhista",
      color: "purple",
      category: "area",
      description: "Direito do trabalho",
      usageCount: 20
    }
  ]);

  const predefinedColors = [
    { value: "red", label: "Vermelho", hsl: [0, 70, 50] },
    { value: "orange", label: "Laranja", hsl: [20, 70, 50] },
    { value: "amber", label: "Âmbar", hsl: [45, 70, 50] },
    { value: "yellow", label: "Amarelo", hsl: [60, 70, 50] },
    { value: "lime", label: "Lima", hsl: [80, 70, 50] },
    { value: "green", label: "Verde", hsl: [120, 70, 50] },
    { value: "emerald", label: "Esmeralda", hsl: [140, 70, 50] },
    { value: "teal", label: "Teal", hsl: [160, 70, 50] },
    { value: "cyan", label: "Ciano", hsl: [180, 70, 50] },
    { value: "sky", label: "Céu", hsl: [200, 70, 50] },
    { value: "blue", label: "Azul", hsl: [220, 70, 50] },
    { value: "indigo", label: "Índigo", hsl: [240, 70, 50] },
    { value: "violet", label: "Violeta", hsl: [260, 70, 50] },
    { value: "purple", label: "Roxo", hsl: [280, 70, 50] },
    { value: "fuchsia", label: "Fúcsia", hsl: [300, 70, 50] },
    { value: "pink", label: "Rosa", hsl: [320, 70, 50] },
    { value: "rose", label: "Rosa Escuro", hsl: [340, 70, 50] },
    { value: "slate", label: "Ardósia", hsl: [210, 15, 50] },
    { value: "gray", label: "Cinza", hsl: [0, 0, 50] },
    { value: "zinc", label: "Zinco", hsl: [0, 0, 50] },
    { value: "neutral", label: "Neutro", hsl: [0, 0, 50] },
    { value: "stone", label: "Pedra", hsl: [25, 15, 50] }
  ];

  const categoryOptions = [
    { value: "tipo", label: "Tipo de Publicação" },
    { value: "prioridade", label: "Prioridade" },
    { value: "area", label: "Área do Direito" },
    { value: "resultado", label: "Resultado/Status" },
    { value: "processo", label: "Tipo de Processo" }
  ];

  const getColorStyle = (colorValue: string) => {
    // Verificar se é uma cor personalizada
    if (colorValue.startsWith('custom-')) {
      const parts = colorValue.split('-');
      if (parts.length === 4) {
        const [, h, s, l] = parts.map(Number);
        // Melhorar legibilidade para cores personalizadas
        const bgLightness = Math.max(Math.min(l, 85), 15);
        const bgSaturation = Math.max(Math.min(s, 80), 30);
        const textLightness = bgLightness > 55 ? 15 : 85;
        const textSaturation = bgSaturation > 50 ? 30 : 20;
        const borderLightness = bgLightness > 50 ? bgLightness - 25 : bgLightness + 25;
        
        return {
          backgroundColor: `hsl(${h}, ${bgSaturation}%, ${bgLightness}%)`,
          color: `hsl(${h}, ${textSaturation}%, ${textLightness}%)`,
          borderColor: `hsl(${h}, ${bgSaturation}%, ${borderLightness}%)`
        };
      }
    }
    
    // Cores predefinidas com melhor contraste
    const predefined = predefinedColors.find(c => c.value === colorValue);
    if (predefined) {
      const [h, s, l] = predefined.hsl;
      const bgLightness = Math.max(Math.min(l, 85), 15);
      const bgSaturation = Math.max(Math.min(s, 80), 30);
      const textLightness = bgLightness > 55 ? 15 : 85;
      const textSaturation = bgSaturation > 50 ? 30 : 20;
      const borderLightness = bgLightness > 50 ? bgLightness - 25 : bgLightness + 25;
      
      return {
        backgroundColor: `hsl(${h}, ${bgSaturation}%, ${bgLightness}%)`,
        color: `hsl(${h}, ${textSaturation}%, ${textLightness}%)`,
        borderColor: `hsl(${h}, ${bgSaturation}%, ${borderLightness}%)`
      };
    }
    
    // Fallback
    return {
      backgroundColor: 'hsl(0, 0%, 80%)',
      color: 'hsl(0, 0%, 20%)',
      borderColor: 'hsl(0, 0%, 60%)'
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTag) {
      // Editando tag existente
      setTags(tags.map(tag => 
        tag.id === editingTag.id 
          ? { ...tag, ...formData }
          : tag
      ));
      toast({
        title: "Tag atualizada",
        description: "A tag foi atualizada com sucesso.",
      });
    } else {
      // Criando nova tag
      const newTag: TagItem = {
        id: Date.now().toString(),
        name: formData.name.toLowerCase().replace(/\s+/g, '-'),
        color: formData.color,
        category: formData.category,
        description: formData.description,
        usageCount: 0
      };
      
      setTags([...tags, newTag]);
      toast({
        title: "Tag criada",
        description: "A nova tag foi criada com sucesso.",
      });
    }
    
    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: "", color: "gray", category: "", description: "" });
    setShowForm(false);
    setEditingTag(null);
  };

  const handleEdit = (tag: TagItem) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color,
      category: tag.category,
      description: tag.description || ""
    });
    setShowForm(true);
  };

  const handleDelete = (tagId: string) => {
    setTags(tags.filter(tag => tag.id !== tagId));
    toast({
      title: "Tag removida",
      description: "A tag foi removida com sucesso.",
    });
  };

  const groupedTags = tags.reduce((acc, tag) => {
    if (!acc[tag.category]) {
      acc[tag.category] = [];
    }
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, TagItem[]>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Gerenciar Etiquetas
              </CardTitle>
              <CardDescription>
                Crie e organize etiquetas para categorizar publicações e processos
              </CardDescription>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Etiqueta
            </Button>
          </div>
        </CardHeader>
        
        {showForm && (
          <CardContent className="border-t">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Etiqueta</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome da etiqueta"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {categoryOptions.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="color">Cor</Label>
                <ColorPicker
                  value={formData.color}
                  onChange={(color) => setFormData({ ...formData, color })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição da etiqueta"
                />
              </div>
              
              <div className="flex gap-2">
                <Button type="submit">
                  {editingTag ? "Atualizar" : "Criar"} Etiqueta
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-6">
        {Object.entries(groupedTags).map(([category, categoryTags]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                {categoryOptions.find(c => c.value === category)?.label || category}
              </CardTitle>
              <CardDescription>
                {categoryTags.length} etiqueta(s) nesta categoria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryTags.map((tag) => (
                  <Card key={tag.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge 
                        variant="outline" 
                        style={getColorStyle(tag.color)}
                        className="border-2 font-medium"
                      >
                        {tag.name}
                      </Badge>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(tag)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(tag.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {tag.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {tag.description}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Usada {tag.usageCount} vez(es)
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
