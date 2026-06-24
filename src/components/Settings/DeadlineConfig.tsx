
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Clock } from "lucide-react";
import { useState } from "react";

export function DeadlineConfig() {
  const [prazos, setPrazos] = useState([
    { id: 1, nome: "Contestação", diasPadrao: 15, categoria: "Defesa" },
    { id: 2, nome: "Recurso Ordinário", diasPadrao: 30, categoria: "Recurso" },
    { id: 3, nome: "Recurso Especial", diasPadrao: 15, categoria: "Recurso" },
    { id: 4, nome: "Recurso Extraordinário", diasPadrao: 15, categoria: "Recurso" },
    { id: 5, nome: "Contrarrazões", diasPadrao: 15, categoria: "Defesa" },
    { id: 6, nome: "Manifestação sobre Laudo", diasPadrao: 10, categoria: "Perícia" },
    { id: 7, nome: "Alegações Finais", diasPadrao: 15, categoria: "Defesa" }
  ]);

  const [novoPrazo, setNovoPrazo] = useState({
    nome: "",
    diasPadrao: 15,
    categoria: "Defesa"
  });

  const adicionarPrazo = () => {
    if (novoPrazo.nome.trim()) {
      setPrazos([
        ...prazos,
        {
          id: prazos.length + 1,
          ...novoPrazo
        }
      ]);
      setNovoPrazo({ nome: "", diasPadrao: 15, categoria: "Defesa" });
    }
  };

  const removerPrazo = (id: number) => {
    setPrazos(prazos.filter(prazo => prazo.id !== id));
  };

  const getCategoriaColor = (categoria: string) => {
    switch (categoria) {
      case "Defesa": return "bg-blue-100 text-blue-800";
      case "Recurso": return "bg-purple-100 text-purple-800";
      case "Perícia": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Configuração de Prazos</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {prazos.map((prazo) => (
            <div key={prazo.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium">{prazo.nome}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoriaColor(prazo.categoria)}`}>
                    {prazo.categoria}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Prazo padrão: {prazo.diasPadrao} dias
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removerPrazo(prazo.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="border-t pt-4">
          <h5 className="font-medium mb-3">Adicionar Novo Prazo</h5>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="nomePrazo">Nome do Prazo</Label>
              <Input
                id="nomePrazo"
                value={novoPrazo.nome}
                onChange={(e) => setNovoPrazo({...novoPrazo, nome: e.target.value})}
                placeholder="Ex: Embargos de Declaração"
              />
            </div>
            <div>
              <Label htmlFor="diasPadrao">Dias Padrão</Label>
              <Input
                id="diasPadrao"
                type="number"
                value={novoPrazo.diasPadrao}
                onChange={(e) => setNovoPrazo({...novoPrazo, diasPadrao: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <Label htmlFor="categoria">Categoria</Label>
              <select
                id="categoria"
                value={novoPrazo.categoria}
                onChange={(e) => setNovoPrazo({...novoPrazo, categoria: e.target.value})}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="Defesa">Defesa</option>
                <option value="Recurso">Recurso</option>
                <option value="Perícia">Perícia</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={adicionarPrazo} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
