
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, Search, Mail, Phone, Calendar, Award } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { getInitialData } from "@/utils/initialData";

const Equipe = () => {
  const { isFirstLogin } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [equipeFilter, setEquipeFilter] = useState("todas");

  const mockEquipesData: any[] = [];

  const mockEquipes = mockEquipesData;

  const filteredEquipes = mockEquipes.filter(equipe => {
    const matchesSearch = equipe.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         equipe.membros.some(membro => 
                           membro.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           membro.cargo.toLowerCase().includes(searchTerm.toLowerCase())
                         );
    const matchesEquipe = equipeFilter === "todas" || equipe.id.toString() === equipeFilter;
    
    return matchesSearch && matchesEquipe;
  });

  return (
    <main className="flex-1 p-4 md:p-8 space-y-8 md:space-y-10 overflow-x-hidden entry-animate">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Users className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-foreground">
              Gestão de Equipe
            </h1>
          </div>
          <p className="text-sm md:text-lg text-muted-foreground font-medium">
            Gerencie o capital humano e a estrutura organizacional do seu escritório.
          </p>
        </div>
        <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl">
          <Button size="lg" className="rounded-xl shadow-premium h-12 px-8 font-black uppercase text-xs tracking-widest bg-primary hover:bg-primary/90">
            <Plus className="h-5 w-5 mr-2" />
            Adicionar Membro
          </Button>
        </div>
      </div>

      {/* Filtros */}
      {/* Filtros */}
      <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-[2rem] overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
              <Input
                placeholder="Buscar por nome, cargo ou equipe..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 bg-black/[0.02] dark:bg-muted/20 border-black/5 dark:border-white/5 rounded-xl font-medium"
              />
            </div>
            <Select value={equipeFilter} onValueChange={setEquipeFilter}>
              <SelectTrigger className="w-full md:w-64 h-12 bg-black/[0.02] dark:bg-muted/20 border-black/5 dark:border-white/5 rounded-xl font-bold">
                <SelectValue placeholder="Filtrar por Equipe" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="todas">Todas as Equipes</SelectItem>
                {mockEquipes.map(equipe => (
                  <SelectItem key={equipe.id} value={equipe.id.toString()}>
                    {equipe.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="equipes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="equipes">Por Equipes</TabsTrigger>
          <TabsTrigger value="todos">Todos os Membros</TabsTrigger>
        </TabsList>

        <TabsContent value="equipes" className="space-y-4">
          <div className="grid gap-6">
            {filteredEquipes.map((equipe) => (
              <Card key={equipe.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${equipe.cor}`} />
                      <CardTitle>{equipe.nome}</CardTitle>
                    </div>
                    <Badge variant="outline">
                      {equipe.membros.length} {equipe.membros.length === 1 ? 'membro' : 'membros'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {equipe.membros.map((membro) => (
                      <div key={membro.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3">
                          <Avatar>
                            <AvatarImage src={membro.avatar} />
                            <AvatarFallback>
                              {membro.nome.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{membro.nome}</h4>
                            <p className="text-sm text-muted-foreground">{membro.cargo}</p>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span className="truncate">{membro.email}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{membro.telefone}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="todos" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mockEquipes.flatMap(equipe => 
              equipe.membros.map(membro => (
                <Card key={membro.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={membro.avatar} />
                        <AvatarFallback>
                          {membro.nome.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium">{membro.nome}</h4>
                        <p className="text-sm text-muted-foreground">{membro.cargo}</p>
                        <div className="mt-2">
                          <Badge 
                            className={`${equipe.cor} text-white text-xs`}
                          >
                            {equipe.nome}
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{membro.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{membro.telefone}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default Equipe;
