import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Processo } from '@/types/processo';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash2, FileText, Building2, ExternalLink, CalendarDays } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';
import { cn } from '@/lib/utils';
import { formatCNJ } from '@/utils/formatCNJ';

interface ProcessoTableProps {
  processos: Processo[];
  onEdit: (processo: Processo) => void;
  onDelete: (processo: Processo) => void;
  onViewDetails: (processo: Processo) => void;
}

export const ProcessoTable: React.FC<ProcessoTableProps> = ({
  processos,
  onEdit,
  onDelete,
  onViewDetails
}) => {
  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('andamento') || s === 'ativo') 
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    if (s.includes('concluído') || s.includes('encerrado')) 
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    if (s.includes('suspenso')) 
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  };

  const getStatusLabel = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'ativo' || s === 'em andamento') return 'Em Andamento';
    if (s === 'encerrado' || s === 'concluído') return 'Arquivado';
    if (s === 'suspenso') return 'Suspenso';
    return status || 'N/A';
  };

  return (
    <div className="rounded-[2.5rem] border border-black/5 dark:border-white/5 bg-white dark:bg-card/40 backdrop-blur-xl overflow-hidden shadow-premium">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-black/5 dark:border-white/5 hover:bg-transparent bg-black/5 dark:bg-white/5">
              <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 py-6 pl-8">Nº Processo</TableHead>
              <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 py-6">Título / Partes</TableHead>
              <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 py-6">Tribunal & Comarca</TableHead>
              <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 py-6">Fase Atual</TableHead>
              <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 py-6">Status</TableHead>
              <TableHead className="text-right py-6 pr-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processos.map((processo) => (
              <TableRow 
                key={processo.id} 
                className="group border-black/5 dark:border-white/5 cursor-pointer transition-all duration-300 hover:bg-primary/[0.04] dark:hover:bg-primary/[0.1]"
                onClick={() => onViewDetails(processo)}
              >
                {/* NÚMERO DO PROCESSO */}
                <TableCell className="py-6 pl-8">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                       <span className="font-mono text-[13px] font-bold text-foreground/90 dark:text-white/90 group-hover:text-primary transition-colors tracking-tight">
                         {formatCNJ(processo.numeroProcesso)}
                       </span>
                    </div>
                    {processo.dataInicio && (
                      <div className="flex items-center gap-1.5 pl-3.5">
                        <CalendarDays className="h-3 w-3 text-muted-foreground/40" />
                        <span className="text-[10px] text-muted-foreground/60">Distribuído em {new Date(processo.dataInicio).toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}
                  </div>
                </TableCell>

                {/* TÍTULO / PARTES */}
                <TableCell className="py-6">
                  <div className="flex flex-col gap-1 max-w-[280px]">
                    <span className="font-bold text-[15px] truncate group-hover:text-primary dark:group-hover:text-white transition-colors">
                      {processo.titulo}
                    </span>
                    {processo.valorCausa && processo.valorCausa > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-black tracking-widest text-emerald-500/80">Valor:</span>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(processo.valorCausa)}
                        </span>
                      </div>
                    )}
                  </div>
                </TableCell>

                {/* TRIBUNAL */}
                <TableCell className="py-6">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-black/5 dark:bg-white/5">
                        <Building2 className="h-3 w-3 text-primary/70" />
                      </div>
                      <span className="text-xs font-bold text-foreground/70 dark:text-white/70 uppercase tracking-tight">{processo.tribunal || '—'}</span>
                    </div>
                    {processo.comarca && (
                      <span className="text-[10px] text-foreground/30 dark:text-white/30 pl-7 font-medium uppercase">{processo.comarca}</span>
                    )}
                  </div>
                </TableCell>

                {/* TIPO / FASE */}
                <TableCell className="py-6">
                   <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground/60 dark:text-white/60">
                        {(processo as any).faseProcessual || processo.tipoProcesso || '—'}
                      </span>
                      <span className="text-[10px] text-foreground/30 dark:text-white/30 uppercase tracking-tighter">Fase Processual</span>
                   </div>
                </TableCell>

                {/* STATUS */}
                <TableCell className="py-6">
                  <Badge variant="outline" className={cn("px-3 py-1 text-[9px] font-black uppercase tracking-[0.1em] border-2", getStatusColor(processo.status))}>
                    {getStatusLabel(processo.status)}
                  </Badge>
                </TableCell>

                {/* AÇÕES */}
                <TableCell className="py-6 pr-8 text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-10 w-10 p-0 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 hover:text-primary transition-all border border-transparent hover:border-black/10 dark:hover:border-white/10 shadow-lg">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass-card border-black/10 dark:border-white/10 rounded-2xl w-52 p-1.5 shadow-2xl">
                      <DropdownMenuItem onClick={() => onViewDetails(processo)} className="rounded-xl cursor-pointer py-3 transition-all hover:bg-primary/10 hover:text-primary dark:hover:text-white">
                        <ExternalLink className="mr-3 h-4 w-4 text-primary" />
                        <span className="font-bold text-sm">Painel de Controle</span>
                      </DropdownMenuItem>
                      <PermissionGuard permission="canEditProcesses">
                        <DropdownMenuItem onClick={() => onEdit(processo)} className="rounded-xl cursor-pointer py-3 transition-all hover:bg-blue-500/10 hover:text-white">
                          <Edit className="mr-3 h-4 w-4 text-blue-400" />
                          <span className="font-bold text-sm">Editar Capa</span>
                        </DropdownMenuItem>
                      </PermissionGuard>
                      <PermissionGuard permission="canDeleteProcesses">
                        <DropdownMenuSeparator className="bg-white/5 my-1" />
                        <DropdownMenuItem 
                          onClick={() => onDelete(processo)}
                          className="rounded-xl cursor-pointer py-3 text-destructive focus:text-destructive focus:bg-destructive/10 transition-all font-bold"
                        >
                          <Trash2 className="mr-3 h-4 w-4" />
                          <span className="text-sm">Arquivar Registro</span>
                        </DropdownMenuItem>
                      </PermissionGuard>
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
