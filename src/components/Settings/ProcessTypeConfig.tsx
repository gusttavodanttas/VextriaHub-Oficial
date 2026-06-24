
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Settings, Clock, Calendar } from "lucide-react";
import { useState } from "react";

export function ProcessTypeConfig() {
  const [tiposProcesso, setTiposProcesso] = useState([
    { id: 1, nome: "BPC", prazoContestacao: 15, prazoRecurso: 30 },
    { id: 2, nome: "Aposentadoria", prazoContestacao: 30, prazoRecurso: 30 },
    { id: 3, nome: "Planejamento Previdenciário", prazoContestacao: 15, prazoRecurso: 15 },
    { id: 4, nome: "Assessoria Preventiva para Dentistas", prazoContestacao: 10, prazoRecurso: 15 }
  ]);

  const [tiposAudiencia, setTiposAudiencia] = useState([
    { id: 1, nome: "Conciliação", duracao: 60 },
    { id: 2, nome: "Instrução", duracao: 120 },
    { id: 3, nome: "Julgamento", duracao: 90 },
    { id: 4, nome: "Preliminar", duracao: 45 }
  ]);

  const [novoTipoProcesso, setNovoTipoProcesso] = useState({
    nome: "",
    prazoContestacao: 15,
    prazoRecurso: 30
  });

  const [novoTipoAudiencia, setNovoTipoAudiencia] = useState({
    nome: "",
    duracao: 60
  });

  const adicionarTipoProcesso = () => {
    if (novoTipoProcesso.nome.trim()) {
      setTiposProcesso([
        ...tiposProcesso,
        {
          id: tiposProcesso.length + 1,
          ...novoTipoProcesso
        }
      ]);
      setNovoTipoProcesso({ nome: "", prazoContestacao: 15, prazoRecurso: 30 });
    }
  };

  const adicionarTipoAudiencia = () => {
    if (novoTipoAudiencia.nome.trim()) {
      setTiposAudiencia([
        ...tiposAudiencia,
        {
          id: tiposAudiencia.length + 1,
          ...novoTipoAudiencia
        }
      ]);
      setNovoTipoAudiencia({ nome: "", duracao: 60 });
    }
  };

  const removerTipoProcesso = (id: number) => {
    setTiposProcesso(tiposProcesso.filter(tipo => tipo.id !== id));
  };

  const removerTipoAudiencia = (id: number) => {
    setTiposAudiencia(tiposAudiencia.filter(tipo => tipo.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Tipos de Processo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Tipos de Processo</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            {tiposProcesso.map((tipo) => (
              <div key={tipo.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{tipo.nome}</h4>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                    <span>Contestação: {tipo.prazoContestacao} dias</span>
                    <span>Recurso: {tipo.prazoRecurso} dias</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removerTipoProcesso(tipo.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <h5 className="font-medium mb-3">Adicionar Novo Tipo</h5>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="nomeProcesso">Nome do Tipo</Label>
                <Input
                  id="nomeProcesso"
                  value={novoTipoProcesso.nome}
                  onChange={(e) => setNovoTipoProcesso({...novoTipoProcesso, nome: e.target.value})}
                  placeholder="Ex: Auxílio Doença"
                />
              </div>
              <div>
                <Label htmlFor="prazoContestacao">Prazo Contestação (dias)</Label>
                <Input
                  id="prazoContestacao"
                  type="number"
                  value={novoTipoProcesso.prazoContestacao}
                  onChange={(e) => setNovoTipoProcesso({...novoTipoProcesso, prazoContestacao: parseInt(e.target.value)})}
                />
              </div>
              <div>
                <Label htmlFor="prazoRecurso">Prazo Recurso (dias)</Label>
                <Input
                  id="prazoRecurso"
                  type="number"
                  value={novoTipoProcesso.prazoRecurso}
                  onChange={(e) => setNovoTipoProcesso({...novoTipoProcesso, prazoRecurso: parseInt(e.target.value)})}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={adicionarTipoProcesso} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tipos de Audiência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Tipos de Audiência</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            {tiposAudiencia.map((tipo) => (
              <div key={tipo.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{tipo.nome}</h4>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    <span>Duração: {tipo.duracao} minutos</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removerTipoAudiencia(tipo.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <h5 className="font-medium mb-3">Adicionar Novo Tipo</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="nomeAudiencia">Nome do Tipo</Label>
                <Input
                  id="nomeAudiencia"
                  value={novoTipoAudiencia.nome}
                  onChange={(e) => setNovoTipoAudiencia({...novoTipoAudiencia, nome: e.target.value})}
                  placeholder="Ex: Perícia"
                />
              </div>
              <div>
                <Label htmlFor="duracao">Duração (minutos)</Label>
                <Input
                  id="duracao"
                  type="number"
                  value={novoTipoAudiencia.duracao}
                  onChange={(e) => setNovoTipoAudiencia({...novoTipoAudiencia, duracao: parseInt(e.target.value)})}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={adicionarTipoAudiencia} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
