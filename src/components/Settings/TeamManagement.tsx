
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Edit, Trash2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const mockEquipes: any[] = [];

export function TeamManagement() {
  const [equipes, setEquipes] = useState(mockEquipes);
  const [novaEquipe, setNovaEquipe] = useState({ nome: "", area: "" });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const adicionarEquipe = () => {
    if (novaEquipe.nome && novaEquipe.area) {
      const cores = ["bg-red-500", "bg-yellow-500", "bg-indigo-500", "bg-pink-500", "bg-teal-500"];
      const corAleatoria = cores[Math.floor(Math.random() * cores.length)];
      
      const novaEquipeCompleta = {
        id: equipes.length + 1,
        nome: novaEquipe.nome,
        area: novaEquipe.area,
        membros: [],
        cor: corAleatoria
      };
      
      setEquipes([...equipes, novaEquipeCompleta]);
      setNovaEquipe({ nome: "", area: "" });
      setIsDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Gestão de Equipes</h3>
          <p className="text-sm text-muted-foreground">
            Organize seus advogados em equipes especializadas
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Equipe
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Equipe</DialogTitle>
              <DialogDescription>
                Adicione uma nova equipe especializada ao seu escritório
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome-equipe">Nome da Equipe</Label>
                <Input
                  id="nome-equipe"
                  placeholder="Ex: Equipe Tributário"
                  value={novaEquipe.nome}
                  onChange={(e) => setNovaEquipe({...novaEquipe, nome: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area-equipe">Área de Atuação</Label>
                <Select value={novaEquipe.area} onValueChange={(value) => setNovaEquipe({...novaEquipe, area: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a área" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Trabalhista">Trabalhista</SelectItem>
                    <SelectItem value="Direito de Família">Direito de Família</SelectItem>
                    <SelectItem value="Direito Previdenciário">Direito Previdenciário</SelectItem>
                    <SelectItem value="Direito Tributário">Direito Tributário</SelectItem>
                    <SelectItem value="Direito Civil">Direito Civil</SelectItem>
                    <SelectItem value="Direito Criminal">Direito Criminal</SelectItem>
                    <SelectItem value="Direito Empresarial">Direito Empresarial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={adicionarEquipe} className="flex-1">Criar Equipe</Button>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {equipes.map((equipe) => (
          <Card key={equipe.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${equipe.cor}`} />
                  <div>
                    <CardTitle className="text-lg">{equipe.nome}</CardTitle>
                    <CardDescription>{equipe.area}</CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Adicionar Membro
                  </Button>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Membros da Equipe ({equipe.membros.length})
                  </h4>
                </div>
                
                <div className="grid gap-3">
                  {equipe.membros.map((membro, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium">
                            {membro.nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{membro.nome}</p>
                          <p className="text-xs text-muted-foreground">{membro.cargo}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {membro.cargo}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {equipe.membros.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum membro adicionado ainda</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
