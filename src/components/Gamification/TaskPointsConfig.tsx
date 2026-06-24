
import { useState } from "react";
import { Settings, Save, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const defaultTaskPoints = {
  alta: 50,
  media: 30,
  baixa: 15,
  peticao: 80,
  audiencia: 60,
  prazo_judicial: 70,
  reuniao_cliente: 25,
  protocolo: 40
};

export function TaskPointsConfig() {
  const [taskPoints, setTaskPoints] = useState(defaultTaskPoints);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    // Aqui você salvaria no banco de dados
    console.log("Pontuações salvas:", taskPoints);
    setIsEditing(false);
  };

  const handleReset = () => {
    setTaskPoints(defaultTaskPoints);
  };

  const updatePoints = (key: string, value: number) => {
    setTaskPoints(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configuração de Pontuação
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? "Cancelar" : "Editar"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-medium mb-3">Prioridade das Tarefas</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="alta">Alta Prioridade</Label>
              <Input
                id="alta"
                type="number"
                value={taskPoints.alta}
                onChange={(e) => updatePoints('alta', parseInt(e.target.value) || 0)}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="media">Média Prioridade</Label>
              <Input
                id="media"
                type="number"
                value={taskPoints.media}
                onChange={(e) => updatePoints('media', parseInt(e.target.value) || 0)}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baixa">Baixa Prioridade</Label>
              <Input
                id="baixa"
                type="number"
                value={taskPoints.baixa}
                onChange={(e) => updatePoints('baixa', parseInt(e.target.value) || 0)}
                disabled={!isEditing}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-medium mb-3">Tipos Específicos de Tarefas</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="peticao">Petição</Label>
              <Input
                id="peticao"
                type="number"
                value={taskPoints.peticao}
                onChange={(e) => updatePoints('peticao', parseInt(e.target.value) || 0)}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audiencia">Audiência</Label>
              <Input
                id="audiencia"
                type="number"
                value={taskPoints.audiencia}
                onChange={(e) => updatePoints('audiencia', parseInt(e.target.value) || 0)}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prazo_judicial">Prazo Judicial</Label>
              <Input
                id="prazo_judicial"
                type="number"
                value={taskPoints.prazo_judicial}
                onChange={(e) => updatePoints('prazo_judicial', parseInt(e.target.value) || 0)}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reuniao_cliente">Reunião Cliente</Label>
              <Input
                id="reuniao_cliente"
                type="number"
                value={taskPoints.reuniao_cliente}
                onChange={(e) => updatePoints('reuniao_cliente', parseInt(e.target.value) || 0)}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protocolo">Protocolo</Label>
              <Input
                id="protocolo"
                type="number"
                value={taskPoints.protocolo}
                onChange={(e) => updatePoints('protocolo', parseInt(e.target.value) || 0)}
                disabled={!isEditing}
              />
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              Salvar Configurações
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Resetar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
