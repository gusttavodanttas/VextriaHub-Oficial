import React from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  MoreHorizontal, 
  Eye, 
  Trash2, 
  Calendar, 
  ExternalLink,
  Scale,
  Building2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatCNJ } from "@/utils/formatCNJ";

interface Publication {
  id: string;
  titulo: string;
  numero_processo: string;
  data_publicacao: string;
  status: string;
  urgencia: string;
  tribunal?: string;
  vara?: string;
  comarca?: string;
}

interface PublicationTableProps {
  publications: Publication[];
  onViewDetails: (pub: Publication) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  selectedIds: string[];
  onToggleSelection: (id: string) => void;
  onToggleAll: () => void;
}

export const PublicationTable = ({
  publications,
  onViewDetails,
  onDelete,
  onUpdateStatus,
  selectedIds,
  onToggleSelection,
  onToggleAll
}: PublicationTableProps) => {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'processada':
      case 'lida':
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case 'pendente':
        return "bg-sky-500/10 text-sky-500 border-sky-500/20";
      default:
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    }
  };

  const getUrgencyStyle = (urgency: string) => {
    switch (urgency) {
      case 'alta': return "bg-red-500/10 text-red-500 border-red-500/20";
      case 'media': return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default: return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <div className="rounded-[2.5rem] border border-white/5 bg-card/30 backdrop-blur-md overflow-hidden shadow-premium">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="w-12 py-5 pl-8">
                <Checkbox 
                  checked={publications.length > 0 && selectedIds.length === publications.length}
                  onCheckedChange={onToggleAll}
                  className="rounded-lg border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </TableHead>
              <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 py-5">
                Expediente / Processo
              </TableHead>
              <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 py-5">
                Tribunal / Comarca
              </TableHead>
              <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 py-5">
                Data
              </TableHead>
              <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 py-5">
                Urgência
              </TableHead>
              <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 py-5">
                Status
              </TableHead>
              <TableHead className="text-right py-5 pr-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {publications.map((pub) => (
              <TableRow 
                key={pub.id} 
                className={cn(
                  "group border-white/5 cursor-pointer transition-all duration-300 hover:bg-white/[0.02]",
                  selectedIds.includes(pub.id) && "bg-primary/5 hover:bg-primary/10"
                )}
                onClick={() => onViewDetails(pub)}
              >
                <TableCell className="py-5 pl-8" onClick={(e) => e.stopPropagation()}>
                  <Checkbox 
                    checked={selectedIds.includes(pub.id)}
                    onCheckedChange={() => onToggleSelection(pub.id)}
                    className="rounded-lg border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </TableCell>

                <TableCell className="py-5">
                  <div className="flex flex-col gap-1 max-w-[350px]">
                    <span className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                      {pub.titulo === pub.numero_processo ? `Expediente no ${pub.tribunal || 'Tribunal'}` : pub.titulo}
                    </span>
                    <div className="flex items-center gap-2">
                       <Scale className="h-3 w-3 text-muted-foreground/40" />
                       <span className="font-mono text-[10px] font-bold text-muted-foreground/70 uppercase">
                        {formatCNJ(pub.numero_processo)}
                       </span>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="py-5">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3 w-3 text-primary/50" />
                      <span className="text-[11px] font-bold">{pub.tribunal || 'TRIBUNAL'}</span>
                    </div>
                    {pub.comarca && (
                      <span className="text-[10px] text-muted-foreground/60 font-medium pl-4">
                        {pub.comarca}
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell className="py-5">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground/40" />
                    <span className="text-xs font-bold text-muted-foreground/80">
                      {new Date(pub.data_publicacao).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="py-5">
                  <Badge variant="outline" className={cn("px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border", getUrgencyStyle(pub.urgencia))}>
                    {pub.urgencia}
                  </Badge>
                </TableCell>

                <TableCell className="py-5">
                  <Badge variant="outline" className={cn("px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border", getStatusStyle(pub.status))}>
                    {pub.status}
                  </Badge>
                </TableCell>

                <TableCell className="py-5 pr-8 text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-9 w-9 p-0 rounded-xl hover:bg-primary/10 hover:text-primary transition-all">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-white/10 rounded-2xl w-56 p-2 bg-background/80 backdrop-blur-xl">
                      <DropdownMenuItem onClick={() => onViewDetails(pub)} className="rounded-xl cursor-pointer py-3 transition-colors focus:bg-primary/10">
                        <Eye className="mr-2 h-4 w-4" />
                        <span className="font-bold text-xs uppercase tracking-wider">Ver Detalhes</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onUpdateStatus(pub.id, pub.status === 'lida' ? 'nova' : 'lida')}
                        className="rounded-xl cursor-pointer py-3 transition-colors focus:bg-primary/10"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        <span className="font-bold text-xs uppercase tracking-wider">
                          {pub.status === 'lida' ? 'Marcar como Não Lida' : 'Marcar como Trata'}
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/5" />
                      <DropdownMenuItem 
                        onClick={() => onDelete(pub.id)}
                        className="rounded-xl cursor-pointer py-3 text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span className="font-bold text-xs uppercase tracking-wider">Remover</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
