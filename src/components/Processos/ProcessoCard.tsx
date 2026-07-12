import React from 'react';
import { Calendar, FileText, Edit, Trash2, Clock, Building2, MapPin, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';
import { Processo } from '@/types/processo';
import { cn } from '@/lib/utils';

interface ProcessoCardProps {
  processo: Processo;
  onEdit?: (processo: Processo) => void;
  onDelete?: (processo: Processo) => void;
  onClienteClick?: (clienteId: string) => void;
  onClick?: () => void;
}

export const ProcessoCard: React.FC<ProcessoCardProps> = ({
  processo,
  onEdit,
  onDelete,
  onClienteClick,
  onClick
}) => {
  const handleEdit = (proc: Processo) => {
    if (onEdit) return onEdit(proc);
    console.warn('[ProcessoCard] onEdit não foi passado pelo pai — ação ignorada');
  };
  const handleDelete = (proc: Processo) => {
    if (onDelete) return onDelete(proc);
    console.warn('[ProcessoCard] onDelete não foi passado pelo pai — ação ignorada');
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Em andamento':
      case 'ativo':
        return 'border-blue-500/20 text-blue-600 dark:text-blue-400 bg-blue-500/5 font-black';
      case 'Concluído':
      case 'encerrado':
        return 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 font-black';
      case 'Suspenso':
        return 'border-orange-500/20 text-orange-600 dark:text-orange-400 bg-orange-500/5 font-black';
      default:
        return 'border-black/5 dark:border-border text-muted-foreground bg-black/5 dark:bg-muted/30 font-black';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ativo': return 'Ativo';
      case 'Em andamento': return 'Em andamento';
      case 'encerrado': return 'Encerrado';
      case 'Concluído': return 'Concluído';
      case 'Suspenso': return 'Suspenso';
      default: return status || 'N/A';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const isOverdue = () => {
    if (!processo.proximoPrazo) return false;
    const prazo = new Date(processo.proximoPrazo);
    const hoje = new Date();
    return prazo < hoje;
  };

  const getBarColor = () => {
    switch (processo.status as string) {
      case 'Em andamento':
      case 'ativo':
        return 'bg-primary';
      case 'Concluído':
      case 'encerrado':
        return 'bg-emerald-500';
      case 'Suspenso':
        return 'bg-orange-500';
      default:
        return 'bg-muted';
    }
  };

  return (
    <Card 
      className="relative overflow-hidden border border-black/5 dark:border-border bg-white dark:bg-black/20 backdrop-blur-md group cursor-pointer hover:border-primary/20 transition-all duration-500 rounded-[2rem] shadow-premium hover:-translate-y-1"
      onClick={onClick}
    >
      <div className={`absolute top-0 left-0 w-1 h-full opacity-40 group-hover:opacity-100 transition-all duration-500 ${getBarColor()}`} />
      
      <CardHeader className="pb-3 pt-5 px-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-8">
            {/* Status + Classe */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline" className={cn("px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md", getStatusColor(processo.status))}>
                {getStatusLabel(processo.status)}
              </Badge>
              {(processo.classeJudicial || processo.tipoProcesso) && (
                <span className="text-[9px] bg-black/5 dark:bg-muted/30 text-muted-foreground/60 dark:text-muted-foreground px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-black/5 dark:border-border">
                  {processo.classeJudicial || processo.tipoProcesso}
                </span>
              )}
            </div>

            {/* Número do processo */}
            {processo.numeroProcesso && (
              <div className="flex items-center gap-1.5 text-primary/60 font-mono text-[10px] font-semibold mb-2">
                <FileText className="h-3 w-3" />
                <span>{processo.numeroProcesso}</span>
              </div>
            )}

            {/* Título */}
            <h3 className="font-bold text-base leading-snug group-hover:text-primary transition-colors">
              {processo.titulo}
            </h3>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl hover:bg-muted/30"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-border rounded-xl w-44 p-1">
                <PermissionGuard permission="canEditProcesses">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(processo);
                    }}
                    className="rounded-lg py-2"
                  >
                    <Edit className="mr-2 h-4 w-4 text-blue-400" />
                    <span className="font-medium text-sm">Editar</span>
                  </DropdownMenuItem>
                </PermissionGuard>
                <PermissionGuard permission="canDeleteProcesses">
                  <DropdownMenuSeparator className="bg-muted/30" />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(processo);
                    }}
                    className="rounded-lg py-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span className="font-medium text-sm">Excluir</span>
                  </DropdownMenuItem>
                </PermissionGuard>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-5 pt-0 space-y-4">
        {/* Tribunal e Comarca */}
        {(processo.tribunal || processo.comarca) && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground/70">
            {processo.tribunal && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3" />
                <span className="font-medium">{processo.tribunal}</span>
              </div>
            )}
            {processo.comarca && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                <span>{processo.comarca}</span>
              </div>
            )}
          </div>
        )}

        {/* Valor da causa Premium */}
        {processo.valorCausa && processo.valorCausa > 0 && (
          <div className="bg-emerald-500/[0.03] dark:bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/10 flex items-center justify-between group-hover:bg-emerald-500/[0.05] transition-all">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-black uppercase tracking-widest">Valor da Causa</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(processo.valorCausa)}
            </span>
          </div>
        )}

        {/* Footer: prazo e data */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
            <Clock className="h-3 w-3" />
            <span>{formatDate(processo.dataInicio) || '—'}</span>
          </div>
          
          {processo.proximoPrazo && (
            <div className={cn("flex items-center gap-1.5 text-[10px] font-semibold",
              isOverdue() ? 'text-red-400' : 'text-orange-400'
            )}>
              <Calendar className="h-3 w-3" />
              <span>Prazo: {formatDate(processo.proximoPrazo)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};