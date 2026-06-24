import React from "react";
import { usePublicacoes } from "@/hooks/usePublicacoes";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, 
  CheckCircle, 
  Calendar, 
  Clock 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Publication {
  id: string;
  numero_processo: string;
  titulo: string;
  conteudo: string;
  data_publicacao: string;
  status: 'nova' | 'lida' | 'arquivada' | 'processada';
  urgencia: 'baixa' | 'media' | 'alta';
}

interface PublicationViewerProps {
  publication: Publication;
}

export const PublicationViewer = ({ publication }: PublicationViewerProps) => {
  const { toast } = useToast();
  const { updateStatus } = usePublicacoes();
  const isProcessed = publication.status === 'lida' || publication.status === 'processada';

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "alta":
        return "bg-red-500 text-white";
      case "media":
        return "bg-yellow-500 text-white";
      default:
        return "bg-green-500 text-white";
    }
  };

  const handleProcessPublication = async () => {
    const success = await updateStatus(publication.id, 'processada');
    if (success) {
      toast({
        title: "Publicação tratada",
        description: "A publicação foi marcada como tratada com sucesso.",
      });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          <Eye className="h-4 w-4 mr-2" />
          Visualizar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Detalhes da Publicação
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Publication Header */}
          <div className="border-b pb-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h3 className="font-semibold text-lg">{publication.titulo}</h3>
              <div className="flex gap-2">
                <Badge className={getUrgencyColor(publication.urgencia)}>
                  {publication.urgencia}
                </Badge>
                {isProcessed && (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Tratada
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <span className="font-medium">Data:</span> {new Date(publication.data_publicacao).toLocaleDateString('pt-BR')}
              </div>
              <div>
                <span className="font-medium">Processo:</span> {publication.numero_processo}
              </div>
            </div>
          </div>

          {/* Publication Content */}
          <div className="space-y-3">
            <h4 className="font-medium">Teor da Publicação:</h4>
            <div className="bg-muted/30 p-4 rounded-lg border">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{publication.conteudo}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button 
              className="flex-1"
              onClick={() => {
                toast({
                  title: "Prazo agendado",
                  description: "Prazo foi adicionado ao calendário com sucesso.",
                });
              }}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Agendar Prazo
            </Button>
            
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                toast({
                  title: "Audiência agendada",
                  description: "Audiência foi adicionada ao calendário com sucesso.",
                });
              }}
            >
              <Clock className="h-4 w-4 mr-2" />
              Agendar Audiência
            </Button>
            
            <Button 
              variant={isProcessed ? "secondary" : "default"}
              className="flex-1"
              onClick={handleProcessPublication}
              disabled={isProcessed}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isProcessed ? "Já Tratada" : "Marcar como Tratada"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
