import React, { useState } from "react";
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
  CalendarClock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NovoPrazoStandaloneDialog } from "@/components/Processos/NovoPrazoStandaloneDialog";

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
  const [isProcessed, setIsProcessed] = useState(
    publication.status === 'lida' || publication.status === 'processada'
  );
  const [processing, setProcessing] = useState(false);
  const [prazoOpen, setPrazoOpen] = useState(false);

  const getUrgencyStyle = (urgency: string) => {
    switch (urgency) {
      case "alta": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "media": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default: return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    }
  };

  const handleProcessPublication = async () => {
    setProcessing(true);
    const success = await updateStatus(publication.id, 'processada');
    setProcessing(false);
    if (success) {
      setIsProcessed(true);
      toast({ title: "Publicação tratada", description: "Marcada como tratada com sucesso." });
    } else {
      toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" });
    }
  };

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="w-full rounded-xl">
            <Eye className="h-4 w-4 mr-2" />
            Visualizar
          </Button>
        </DialogTrigger>
        <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[85vh] overflow-y-auto bg-background border border-border p-0 rounded-[2rem] shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
              <Eye className="h-5 w-5 text-primary" />
              Detalhes da Publicação
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-black text-base leading-tight">{publication.titulo}</h3>
                <div className="flex gap-2 shrink-0">
                  <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest border", getUrgencyStyle(publication.urgencia))}>
                    {publication.urgencia}
                  </Badge>
                  {isProcessed && (
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      Tratada
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-medium">
                <span><span className="font-bold">Data:</span> {new Date(publication.data_publicacao).toLocaleDateString('pt-BR')}</span>
                <span><span className="font-bold">Processo:</span> {publication.numero_processo}</span>
              </div>
            </div>

            {/* Content */}
            <div className="bg-muted/20 p-5 rounded-2xl border border-border">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">{publication.conteudo}</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border">
              <Button
                variant="outline"
                className="flex-1 rounded-xl gap-2 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                onClick={() => setPrazoOpen(true)}
              >
                <CalendarClock className="h-4 w-4" />
                Agendar Prazo
              </Button>

              <Button
                className={cn("flex-1 rounded-xl gap-2", isProcessed && "opacity-60")}
                onClick={handleProcessPublication}
                disabled={isProcessed || processing}
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {isProcessed ? "Já Tratada" : "Marcar como Tratada"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <NovoPrazoStandaloneDialog
        open={prazoOpen}
        onOpenChange={setPrazoOpen}
        numeroProcesso={publication.numero_processo}
        tituloSugerido={`Prazo — ${publication.titulo || publication.numero_processo}`}
        onSuccess={() => {
          updateStatus(publication.id, 'processada');
          setIsProcessed(true);
          toast({ title: "Prazo salvo", description: "Publicação marcada como tratada." });
        }}
      />
    </>
  );
};
