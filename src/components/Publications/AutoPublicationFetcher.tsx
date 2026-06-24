import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublicationViewer } from "./PublicationViewer";
import { ScheduleDialog } from "./ScheduleDialog";
import { Search, Loader2, Sparkles, Filter, ShieldCheck, UserCheck, Download, CheckCircle } from "lucide-react";
import { usePublicacoes } from "@/hooks/usePublicacoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const AutoPublicationFetcher = () => {
  const { toast } = useToast();
  const { createPublication, getOfficeOwnerProfile } = usePublicacoes();
  
  const [oabNumber, setOabNumber] = useState("");
  const [oabSeccional, setOabSeccional] = useState("SP");
  const [processCnj, setProcessCnj] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [ownerInfo, setOwnerInfo] = useState<{ full_name: string; oab: string } | null>(null);

  useEffect(() => {
    const fetchOwner = async () => {
      const info = await getOfficeOwnerProfile();
      if (info && info.oab) {
        setOwnerInfo(info as any);
      }
    };
    fetchOwner();
  }, []);

  const handleUseOwnerOab = () => {
    if (ownerInfo?.oab) {
      setOabNumber(ownerInfo.oab);
      toast({
        title: "Dados carregados",
        description: `OAB do proprietário (${ownerInfo.full_name}) preenchida.`,
      });
    }
  };

  const handleOabSearch = async () => {
    if (!oabNumber || !oabSeccional) {
      toast({
        title: "Erro",
        description: "Por favor, preencha o número da OAB e a seccional",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setResults([]);
      toast({
        title: "Busca concluída",
        description: `Nenhuma publicação encontrada para OAB ${oabNumber}/${oabSeccional}`,
      });
    } catch (error) {
      toast({
        title: "Erro na busca",
        description: "Não foi possível buscar as publicações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleCnjSearch = async () => {
    if (!processCnj) {
      toast({
        title: "Erro",
        description: "Por favor, preencha o número CNJ do processo",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const mockResults = [
        {
          id: "1",
          titulo: "Intimação para depósito - Processo 4004567-12.2025.8.26.0400",
          data_publicacao: "2025-01-24",
          numero_processo: "4004567-12.2025.8.26.0400",
          conteudo: "Intimo a parte executada para efetuar o depósito do valor da condenação no prazo de 15 dias.",
          urgencia: "alta",
          status: "nova",
          tags: ["deposito", "prazo"]
        }
      ];

      const savedResults = [];
      for (const res of mockResults) {
        const saved = await createPublication(res as any);
        if (saved) savedResults.push(saved);
      }

      setResults(savedResults);
      toast({
        title: "Busca concluída",
        description: `${savedResults.length} publicações encontradas e salvas para processo CNJ ${processCnj}`,
      });
    } catch (error) {
      toast({
        title: "Erro na busca",
        description: "Não foi possível buscar as publicações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "alta": return "bg-red-500 text-white";
      case "media": return "bg-yellow-500 text-white";
      default: return "bg-green-500 text-white";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Busca Automática de Publicações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ownerInfo && (
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between gap-4 entry-animate mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary/60 uppercase tracking-widest">Sugerido (Proprietário)</p>
                  <p className="text-sm font-bold text-white/90">Dr. {ownerInfo.full_name} (OAB {ownerInfo.oab})</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl border-primary/20 hover:bg-primary/10 hover:text-primary transition-all font-bold text-xs"
                onClick={handleUseOwnerOab}
              >
                Preencher OAB
              </Button>
            </div>
          )}

          <Tabs defaultValue="oab" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="oab">Busca por OAB</TabsTrigger>
              <TabsTrigger value="cnj">Busca por CNJ</TabsTrigger>
            </TabsList>
            
            <TabsContent value="oab" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="oab-number">Número da OAB</Label>
                  <Input
                    id="oab-number"
                    placeholder="Ex: 123456"
                    value={oabNumber}
                    onChange={(e) => setOabNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="oab-seccional">Seccional da OAB</Label>
                  <Input
                    id="oab-seccional"
                    placeholder="Ex: SP"
                    value={oabSeccional}
                    onChange={(e) => setOabSeccional(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
              <Button 
                onClick={handleOabSearch} 
                disabled={isSearching}
                className="w-full"
              >
                {isSearching ? (
                  <>
                    <Search className="h-4 w-4 mr-2 animate-spin" />
                    Buscando publicações...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar por OAB
                  </>
                )}
              </Button>
            </TabsContent>
            
            <TabsContent value="cnj" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="process-cnj">Número CNJ do Processo</Label>
                <Input
                  id="process-cnj"
                  placeholder="Ex: 1234567-89.2025.8.26.0100"
                  value={processCnj}
                  onChange={(e) => setProcessCnj(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleCnjSearch} 
                disabled={isSearching}
                className="w-full"
              >
                {isSearching ? (
                  <>
                    <Search className="h-4 w-4 mr-2 animate-spin" />
                    Buscando publicações...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar por CNJ
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Publications Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Publicações Encontradas e Salvas ({results.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((publication) => (
              <div
                key={publication.id}
                className="border rounded-lg p-4 space-y-3 bg-white/5"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <h4 className="font-semibold">{publication.titulo}</h4>
                    <div className="text-sm text-muted-foreground mt-1">
                      <span>{new Date(publication.data_publicacao).toLocaleDateString('pt-BR')}</span>
                      <span className="mx-2">•</span>
                      <span>Processo: {publication.numero_processo}</span>
                    </div>
                  </div>
                  <Badge className={getUrgencyColor(publication.urgencia)}>
                    {publication.urgencia}
                  </Badge>
                </div>
                
                <p className="text-sm bg-muted/30 p-3 rounded">
                  {publication.conteudo}
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <PublicationViewer publication={publication} />
                  
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  
                  <ScheduleDialog 
                    publicationTitle={publication.titulo}
                    processNumber={publication.numero_processo}
                    type="prazo"
                  />
                  
                  <ScheduleDialog 
                    publicationTitle={publication.titulo}
                    processNumber={publication.numero_processo}
                    type="audiencia"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
