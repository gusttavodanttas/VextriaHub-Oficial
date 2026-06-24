import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Calendar, 
  Building2, 
  MapPin, 
  CheckCircle, 
  PlusCircle, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink 
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCNJ } from "@/utils/formatCNJ";
import { useToast } from "@/hooks/use-toast";

interface Publication {
  id: string;
  numero_processo: string;
  titulo: string;
  conteudo: string;
  data_publicacao: string;
  tags: string[];
  status: 'nova' | 'lida' | 'arquivada' | 'processada';
  tribunal?: string;
  vara?: string;
  comarca?: string;
}

interface PublicationDetailsDialogProps {
  publication: Publication;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  onDelete?: (id: string) => void;
  onProcess?: (id: string) => void;
  onRegister?: (publication: Publication) => void;
  onSchedule?: (publication: Publication) => void;
}

const deepCleanHTML = (html: string): string => {
  if (!html) return "";
  let tmp = html;
  
  // Substituir br por quebra de linha
  tmp = tmp.replace(/<br\s*\/?>/gi, "\n");
  // Substituir fechamento de parágrafos/divs por quebras
  tmp = tmp.replace(/<\/p>|<\/div>|<\/tr>/gi, "\n");
  
  // Remover scripts e styles
  tmp = tmp.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");
  
  // Remover tags HTML remanescentes
  tmp = tmp.replace(/<[^>]*>/g, "");
  
  // Decodificar entidades comuns
  const entities: Record<string, string> = {
    '&nbsp;': ' ', '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&ordm;': 'º', '&ordf;': 'ª', '&agrave;': 'à', '&aacute;': 'á',
    '&acirc;': 'â', '&atilde;': 'ã', '&eacute;': 'é', '&ecirc;': 'ê',
    '&iacute;': 'í', '&oacute;': 'ó', '&ocirc;': 'ô', '&otilde;': 'õ',
    '&uacute;': 'ú', '&ccedil;': 'ç'
  };
  
  Object.entries(entities).forEach(([key, val]) => {
    tmp = tmp.replace(new RegExp(key, 'gi'), val);
  });

  // Limpar espaços extras em cada linha mas manter as próprias linhas
  return tmp
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // No máximo 2 quebras seguidas
    .trim();
};

export const PublicationDetailsDialog = ({ publication, open, onOpenChange, trigger, onDelete, onProcess, onRegister, onSchedule }: PublicationDetailsDialogProps) => {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;

  const cleanContent = React.useMemo(() => deepCleanHTML(publication.conteudo), [publication.conteudo]);

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanContent);
    setCopied(true);
    toast({ title: "Copiado", description: "Conteúdo copiado para a área de transferência." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-4xl h-[90vh] md:h-auto md:max-h-[90vh] border-white/5 bg-[#0A0A0B]/95 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl p-0 overflow-hidden flex flex-col focus:outline-none ring-0">
        <DialogHeader className="p-8 pb-6 shrink-0 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
          <div className="flex items-center justify-between gap-4">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-xl md:text-2xl font-black tracking-tight text-white/95">
                    Detalhes da Publicação
                  </DialogTitle>
                  <p className="text-[10px] uppercase font-black tracking-[0.2em] text-white/30">
                    Processamento Judicial V20
                  </p>
                </div>
             </div>
             
             <Badge className={cn(
                "px-5 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl ring-2 ring-white/5",
                publication.status === 'lida' || publication.status === 'processada' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-primary/20 text-primary border-primary/30"
              )}>
                {publication.status === 'lida' || publication.status === 'processada' ? 'Processada' : 'Pendente'}
              </Badge>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-8 py-8 min-h-0 custom-scrollbar overscroll-contain">
          <div className="space-y-8">
            {/* Header Info */}
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <h3 className="text-xl md:text-2xl font-black leading-tight text-white tracking-tight uppercase">{publication.titulo}</h3>
                
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 text-xs text-white/40 font-bold">
                    <Calendar className="h-3.5 w-3.5 text-primary/60" />
                    <span>Publicado em: {new Date(publication.data_publicacao).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                  <div className="flex items-center gap-2 text-xs text-white/40 font-bold">
                    <Building2 className="h-3.5 w-3.5 text-primary/60" />
                    <span>{publication.tribunal || '—'}</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/20 pl-1">Número do Processo</label>
                  <div className="group relative">
                    <p className="text-[15px] font-mono bg-white/[0.03] border border-white/5 p-4 rounded-[1.2rem] font-black text-primary transition-all group-hover:bg-white/5">
                      {formatCNJ(publication.numero_processo)}
                    </p>
                    <ExternalLink className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-0 group-hover:opacity-40 transition-opacity text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/20 pl-1">Localização Judiciária</label>
                  <div className="flex items-center gap-3 bg-white/[0.03] border border-white/5 p-4 rounded-[1.2rem] transition-all">
                    <MapPin className="h-4 w-4 text-primary/60" />
                    <span className="text-[13px] font-bold text-white/80 uppercase truncate">
                      {publication.comarca || 'Comarca Geral'}{publication.vara ? ` - ${publication.vara}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <Separator className="bg-white/5" />
            
            {/* Content Area */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/20 pl-1">Teor da Publicação</label>
                <Button 
                   onClick={handleCopy}
                   variant="ghost" 
                   size="sm" 
                   className="h-8 px-4 rounded-xl hover:bg-white/5 text-[10px] font-black uppercase tracking-widest gap-2"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado!" : "Copiar Texto"}
                </Button>
              </div>
              
              <div className="relative group">
                <div className="absolute inset-0 bg-primary/5 blur-3xl opacity-0 group-hover:opacity-20 transition-opacity rounded-full pointer-events-none" />
                <div className="relative bg-black/40 p-6 md:p-10 rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden min-h-[300px]">
                  <p className="text-[15px] md:text-[17px] leading-[1.8] whitespace-pre-wrap font-medium text-white/80 selection:bg-primary/30">
                    {cleanContent || "O conteúdo integral desta publicação está sendo processado ou não está disponível."}
                  </p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-3 pb-4">
              <label className="text-[10px] uppercase font-black tracking-[0.2em] text-white/20 pl-1">Etiquetas</label>
              <div className="flex gap-2 flex-wrap">
                {publication.tags?.filter(t => t !== 'auto-sync').length > 0 ? (
                  publication.tags.filter(t => t !== 'auto-sync').map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-white/[0.03] border-white/5 py-1.5 px-4 rounded-xl shadow-lg text-white/50">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-white/10 italic">Nenhuma etiqueta automática identificada</span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions bar */}
        <div className="p-6 md:p-8 bg-[#0D0D0E] shrink-0 border-t border-white/5">
          <div className="flex flex-wrap items-center gap-4 w-full">
             <Button 
                onClick={() => onRegister?.(publication)}
                className="rounded-2xl bg-primary hover:bg-primary/90 text-white px-8 font-black text-[11px] uppercase tracking-widest gap-2.5 h-14 transition-all shadow-xl shadow-primary/20 flex-1 md:flex-initial"
             >
               <PlusCircle className="h-5 w-5" />
               Cadastrar Novo Processo
             </Button>
             
             <Button 
                onClick={() => onProcess?.(publication.id)}
                variant="outline" 
                className={cn(
                  "rounded-2xl border-white/10 hover:bg-emerald-500/10 hover:text-emerald-400 px-8 font-black text-[11px] uppercase tracking-widest gap-2.5 h-14 transition-all flex-1 md:flex-initial",
                  publication.status === 'lida' && "opacity-40 grayscale pointer-events-none"
                )}
             >
               <CheckCircle className="h-5 w-5" />
               Marcar como Lido
             </Button>
             
             <Button 
                onClick={() => onDelete?.(publication.id)}
                variant="ghost" 
                className="rounded-2xl hover:bg-red-500/10 hover:text-red-400 px-8 font-black text-[11px] uppercase tracking-widest gap-2.5 h-14 transition-all ml-auto w-full md:w-auto"
             >
               <Trash2 className="h-5 w-5" />
               Arquivar Permanente
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};