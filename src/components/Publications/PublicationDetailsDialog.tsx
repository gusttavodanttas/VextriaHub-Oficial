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
  ExternalLink,
  CalendarClock,
  Link2,
  Link2Off,
  AlertTriangle,
} from "lucide-react";
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
  urgencia?: 'baixa' | 'media' | 'alta';
  tribunal?: string;
  vara?: string;
  comarca?: string;
  processo_id?: string;
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
  tmp = tmp.replace(/<br\s*\/?>/gi, "\n");
  tmp = tmp.replace(/<\/p>|<\/div>|<\/tr>/gi, "\n");
  tmp = tmp.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");
  tmp = tmp.replace(/<[^>]*>/g, "");
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
  return tmp.split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'processada':
    case 'lida':
      return { label: 'Tratada', style: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
    case 'pendente':
      return { label: 'Pendente', style: 'bg-sky-500/10 text-sky-600 border-sky-500/20' };
    case 'arquivada':
      return { label: 'Arquivada', style: 'bg-slate-500/10 text-slate-500 border-slate-500/20' };
    default:
      return { label: 'Nova', style: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
  }
};

const getUrgencyConfig = (urgencia?: string) => {
  switch (urgencia) {
    case 'alta': return { label: 'Urgência Alta', style: 'bg-red-500/10 text-red-600 border-red-500/20', icon: AlertTriangle };
    case 'media': return { label: 'Urgência Média', style: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: null };
    default: return null;
  }
};

export const PublicationDetailsDialog = ({
  publication,
  open,
  onOpenChange,
  trigger,
  onDelete,
  onProcess,
  onRegister,
  onSchedule,
}: PublicationDetailsDialogProps) => {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange! : setInternalOpen;

  const cleanContent = React.useMemo(() => deepCleanHTML(publication.conteudo), [publication.conteudo]);
  const statusCfg = getStatusConfig(publication.status);
  const urgCfg = getUrgencyConfig(publication.urgencia);
  const isTratada = publication.status === 'lida' || publication.status === 'processada';

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanContent);
    setCopied(true);
    toast({ title: "Copiado", description: "Conteúdo copiado para a área de transferência." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => setIsOpen(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-4xl h-[92vh] border-border bg-background rounded-[2.5rem] shadow-2xl p-0 overflow-hidden flex flex-col focus:outline-none ring-0">

        {/* Header */}
        <DialogHeader className="p-7 pb-5 shrink-0 border-b border-border bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1 min-w-0">
                <DialogTitle className="text-lg font-black tracking-tight text-foreground leading-tight">
                  {publication.titulo === publication.numero_processo
                    ? `Expediente no ${publication.tribunal || 'Tribunal'}`
                    : publication.titulo}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-muted-foreground/70 uppercase">
                    {formatCNJ(publication.numero_processo)}
                  </span>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="text-[11px] text-muted-foreground/60 font-medium">
                    {new Date(publication.data_publicacao).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge variant="outline" className={cn("px-3 py-1 text-[9px] font-black uppercase tracking-widest border", statusCfg.style)}>
                {statusCfg.label}
              </Badge>
              {urgCfg && (
                <Badge variant="outline" className={cn("px-3 py-1 text-[9px] font-black uppercase tracking-widest border gap-1", urgCfg.style)}>
                  {urgCfg.icon && <AlertTriangle className="h-3 w-3" />}
                  {urgCfg.label}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-7 min-h-0 space-y-6">

          {/* Meta info grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/50">Tribunal</label>
              <div className="flex items-center gap-2 bg-muted/30 border border-border p-3 rounded-xl">
                <Building2 className="h-4 w-4 text-primary/50 shrink-0" />
                <span className="text-[12px] font-bold truncate">{publication.tribunal || '—'}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/50">Comarca / Vara</label>
              <div className="flex items-center gap-2 bg-muted/30 border border-border p-3 rounded-xl">
                <MapPin className="h-4 w-4 text-primary/50 shrink-0" />
                <span className="text-[12px] font-bold truncate">
                  {publication.comarca || 'Comarca Geral'}{publication.vara ? ` · ${publication.vara}` : ''}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/50">Vínculo</label>
              <div className={cn(
                "flex items-center gap-2 border p-3 rounded-xl",
                publication.processo_id
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-orange-500/5 border-orange-500/20'
              )}>
                {publication.processo_id
                  ? <Link2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  : <Link2Off className="h-4 w-4 text-orange-500 shrink-0" />}
                <span className={cn("text-[12px] font-bold", publication.processo_id ? 'text-emerald-600' : 'text-orange-500')}>
                  {publication.processo_id ? 'Vinculada a processo' : 'Sem processo vinculado'}
                </span>
              </div>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Content */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/50">Teor da publicação</label>
              <Button
                onClick={handleCopy}
                variant="ghost"
                size="sm"
                className="h-8 px-3 rounded-xl hover:bg-muted text-[10px] font-black uppercase tracking-widest gap-1.5"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>

            <div className="bg-muted/10 p-6 rounded-[1.5rem] border border-border min-h-[200px] max-h-[340px] overflow-y-auto">
              <p className="text-[15px] leading-[1.85] whitespace-pre-wrap font-medium text-foreground/85 selection:bg-primary/30">
                {cleanContent || "O conteúdo integral desta publicação está sendo processado ou não está disponível."}
              </p>
            </div>
          </div>

          {/* Tags */}
          {publication.tags?.filter(t => t !== 'auto-sync').length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/50">Etiquetas</label>
              <div className="flex gap-2 flex-wrap">
                {publication.tags.filter(t => t !== 'auto-sync').map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-muted border-border py-1 px-3 rounded-xl text-muted-foreground">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions footer */}
        <div className="p-6 bg-muted/20 shrink-0 border-t border-border">
          <div className="flex flex-wrap items-center gap-3">

            {/* Primary: registrar processo (só se não tiver vínculo) */}
            {onRegister && !publication.processo_id && (
              <Button
                onClick={() => { onRegister(publication); handleClose(); }}
                className="rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground px-6 font-black text-[11px] uppercase tracking-widest gap-2 h-12 shadow-lg shadow-primary/20 flex-1 md:flex-none"
              >
                <PlusCircle className="h-4 w-4" />
                Cadastrar Processo
              </Button>
            )}

            {/* Agendar prazo */}
            {onSchedule && (
              <Button
                onClick={() => { onSchedule(publication); handleClose(); }}
                variant="outline"
                className="rounded-2xl border-amber-500/30 text-amber-600 hover:bg-amber-500/10 px-6 font-black text-[11px] uppercase tracking-widest gap-2 h-12 flex-1 md:flex-none"
              >
                <CalendarClock className="h-4 w-4" />
                Agendar Prazo
              </Button>
            )}

            {/* Marcar como tratada / nova */}
            <Button
              onClick={() => {
                onProcess?.(publication.id);
                handleClose();
              }}
              variant="outline"
              className={cn(
                "rounded-2xl border-border px-6 font-black text-[11px] uppercase tracking-widest gap-2 h-12 flex-1 md:flex-none transition-all",
                isTratada
                  ? "text-muted-foreground hover:bg-muted"
                  : "text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
              )}
            >
              <CheckCircle className="h-4 w-4" />
              {isTratada ? 'Marcar como Nova' : 'Marcar como Tratada'}
            </Button>

            {/* Arquivar — separado à direita */}
            {onDelete && (
              <Button
                onClick={() => { onDelete(publication.id); handleClose(); }}
                variant="ghost"
                className="rounded-2xl hover:bg-red-500/10 hover:text-red-600 px-6 font-black text-[11px] uppercase tracking-widest gap-2 h-12 ml-auto"
              >
                <Trash2 className="h-4 w-4" />
                Arquivar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
