
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, FileText } from "lucide-react";
import { useState } from "react";

export function ProcessTypeSimple() {
  const [tiposProcesso, setTiposProcesso] = useState([
    { 
      id: 1, 
      nome: "BPC (Benefício de Prestação Continuada)", 
      descricao: "Auxílio assistencial para pessoas com deficiência ou idosos em situação de vulnerabilidade",
      area: "Previdenciário"
    },
    { 
      id: 2, 
      nome: "Aposentadoria por Idade", 
      descricao: "Benefício previdenciário por idade mínima e tempo de contribuição",
      area: "Previdenciário"
    },
    { 
      id: 3, 
      nome: "Planejamento Previdenciário", 
      descricao: "Consultoria e estratégia para otimização de benefícios previdenciários",
      area: "Consultivo"
    },
    { 
      id: 4, 
      nome: "Assessoria Preventiva para Dentistas", 
      descricao: "Consultoria jurídica preventiva especializada para profissionais da odontologia",
      area: "Consultivo"
    }
  ]);

  const [novoTipo, setNovoTipo] = useState({
    nome: "",
    descricao: "",
    area: "Previdenciário"
  });

  const adicionarTipo = () => {
    if (novoTipo.nome.trim()) {
      setTiposProcesso([
        ...tiposProcesso,
        {
          id: tiposProcesso.length + 1,
          ...novoTipo
        }
      ]);
      setNovoTipo({ nome: "", descricao: "", area: "Previdenciário" });
    }
  };

  const removerTipo = (id: number) => {
    setTiposProcesso(tiposProcesso.filter(tipo => tipo.id !== id));
  };

  const getAreaColor = (area: string) => {
    switch (area) {
      case "Previdenciário": return "bg-blue-100 text-blue-800";
      case "Trabalhista": return "bg-green-100 text-green-800";
      case "Civil": return "bg-purple-100 text-purple-800";
      case "Consultivo": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>Tipos de Processo</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {tiposProcesso.map((tipo) => (
            <div key={tipo.id} className="flex items-start justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium">{tipo.nome}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAreaColor(tipo.area)}`}>
                    {tipo.area}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{tipo.descricao}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removerTipo(tipo.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="border-t pt-4">
          <h5 className="font-medium mb-3">Adicionar Novo Tipo</h5>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="nomeProcesso">Nome do Tipo</Label>
                <Input
                  id="nomeProcesso"
                  value={novoTipo.nome}
                  onChange={(e) => setNovoTipo({...novoTipo, nome: e.target.value})}
                  placeholder="Ex: Auxílio Doença"
                />
              </div>
              <div>
                <Label htmlFor="area">Área</Label>
                <select
                  id="area"
                  value={novoTipo.area}
                  onChange={(e) => setNovoTipo({...novoTipo, area: e.target.value})}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="Previdenciário">Previdenciário</option>
                  <option value="Trabalhista">Trabalhista</option>
                  <option value="Civil">Civil</option>
                  <option value="Consultivo">Consultivo</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={novoTipo.descricao}
                onChange={(e) => setNovoTipo({...novoTipo, descricao: e.target.value})}
                placeholder="Descreva brevemente este tipo de processo..."
                rows={2}
              />
            </div>
            <Button onClick={adicionarTipo} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Tipo
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
