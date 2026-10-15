// Cartão da visão em grade — extraído de pages/Publicacoes.tsx sem mudança de comportamento.
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { Trash2, CheckSquare, Clock, CalendarDays, CheckCircle, PlusCircle, Link2, Link2Off, Gavel, ChevronDown } from "lucide-react";
import { formatCNJ } from "@/utils/formatCNJ";
import { fmtDataBR } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Publication } from "@/types/publicacao";
import type { AcaoTipo } from "@/components/Processos/AgendarPublicacaoDialog";

interface Props {
  publication: Publication;
  selected: boolean;
  onOpen: (pub: Publication) => void;
  onToggleSelection: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  /** Ausente quando o usuário não pode cadastrar processos. */
  onRegister?: (pub: Publication) => void;
  onSchedule: (pub: Publication, tipo: AcaoTipo) => void;
  onArchive: (id: string) => void;
}

export function PublicationCard({ publication, selected, onOpen, onToggleSelection, onUpdateStatus, onRegister, onSchedule, onArchive }: Props) {
    const isTratada = publication.status === 'lida' || publication.status === 'processada';
    return (
      <div
        key={publication.id}
        className={cn(
          "bg-card border border-border p-6 rounded-[2rem] hover:shadow-lg transition-all duration-300 hover:border-primary/25 hover:-translate-y-0.5 group relative shadow-sm cursor-pointer",
          selected && "ring-2 ring-primary bg-primary/5"
        )}
        onClick={() => onOpen(publication)}
      >
        {/* Checkbox */}
        <div
          className="absolute top-5 left-5 z-10 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onToggleSelection(publication.id); }}
        >
          <Checkbox
            checked={selected}
            className="h-5 w-5 rounded-lg border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-md"
          />
        </div>

        <div className="pl-8 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <h4 className="font-black text-base group-hover:text-primary transition-colors leading-tight tracking-tight truncate">
                {publication.titulo === publication.numero_processo ? `Publicação no ${publication.tribunal || 'Tribunal'}` : publication.titulo}
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black px-2 py-0.5 rounded-lg text-[10px] font-mono uppercase">
                  {formatCNJ(publication.numero_processo)}
                </Badge>
                {publication.tribunal && (
                  <span className="text-[10px] text-muted-foreground/60 font-bold uppercase">{publication.tribunal}</span>
                )}
                <span className="text-[10px] text-muted-foreground/50 font-bold">
                  {fmtDataBR(publication.data_publicacao)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge className={cn(
                "px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest",
                isTratada ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                "bg-amber-500/10 text-amber-600 border border-amber-500/20"
              )}>
                {isTratada ? 'Tratada' : 'Nova'}
              </Badge>
              {publication.urgencia === 'alta' && (
                <Badge variant="outline" className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-600 border-red-500/20">
                  Urgente
                </Badge>
              )}
            </div>
          </div>

          {/* Content preview */}
          <div className="p-4 bg-muted/20 rounded-2xl border border-border text-foreground/70 font-medium line-clamp-3 leading-relaxed text-sm">
            {publication.conteudo || '—'}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5">
              {publication.processo_id ? (
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 px-2 py-0.5">
                  <Link2 className="h-3 w-3" /> Vinculada
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-500 border-orange-500/20 gap-1 px-2 py-0.5">
                  <Link2Off className="h-3 w-3" /> Avulsa
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!isTratada && (
                <PermissionGuard permission="canManagePublicacoes">
                  <Button size="sm" variant="ghost" className="h-8 rounded-xl text-[10px] font-bold gap-1 text-emerald-600 hover:bg-emerald-500/10"
                    onClick={() => onUpdateStatus(publication.id, 'lida')}>
                    <CheckCircle className="h-3.5 w-3.5" /> Tratar
                  </Button>
                </PermissionGuard>
              )}
              {onRegister && !publication.processo_id && (
                <Button size="sm" variant="ghost" className="h-8 rounded-xl text-[10px] font-bold gap-1 text-violet-600 hover:bg-violet-500/10"
                  onClick={() => onRegister(publication)}>
                  <PlusCircle className="h-3.5 w-3.5" /> Processo
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 rounded-xl text-[10px] font-bold gap-1 text-amber-600 hover:bg-amber-500/10">
                    <CalendarDays className="h-3.5 w-3.5" /> Agendar
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem onClick={() => onSchedule(publication, 'prazo')} className="rounded-lg cursor-pointer gap-2">
                    <Clock className="h-4 w-4 text-amber-500" /> Prazo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSchedule(publication, 'tarefa')} className="rounded-lg cursor-pointer gap-2">
                    <CheckSquare className="h-4 w-4 text-sky-500" /> Tarefa
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSchedule(publication, 'audiencia')} className="rounded-lg cursor-pointer gap-2">
                    <Gavel className="h-4 w-4 text-violet-500" /> Audiência
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <PermissionGuard permission="canManagePublicacoes">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                  onClick={() => onArchive(publication.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </PermissionGuard>
            </div>
          </div>
        </div>
      </div>
    );
}
