import React from 'react';
import { cn } from "@/lib/utils";
import { UserCheck, Calendar, Clock, User, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Atendimento } from '@/types/atendimento';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';

interface AtendimentoCardProps {
  atendimento: Atendimento;
  isSelected: boolean;
  onToggleSelect: (atendimentoId: string) => void;
  onEditAtendimento: (atendimentoId: string) => void;
  onNavigateToClient: (clientId: number, clientName: string) => void;
  onNavigateToProcesses: (clientId: number, clientName: string) => void;
  getStatusColor: (status: string) => string;
}

export const AtendimentoCard: React.FC<AtendimentoCardProps> = ({
  atendimento,
  isSelected,
  onToggleSelect,
  onEditAtendimento,
  onNavigateToClient,
  onNavigateToProcesses,
  getStatusColor
}) => {
  return (
    <Card className={cn(
      "group hover-lift rounded-[2rem] border border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl shadow-premium transition-all duration-300",
      isSelected ? "ring-2 ring-primary bg-primary/[0.02]" : ""
    )}>
      <CardHeader className="p-6 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4 flex-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(atendimento.id)}
              className="rounded-md h-5 w-5 mt-1"
            />
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/10 group-hover:scale-110 transition-transform duration-500">
              <UserCheck className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl font-black tracking-tight truncate group-hover:text-primary transition-colors">
                {atendimento.cliente}
              </CardTitle>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 truncate">
                {atendimento.tipoAtendimento}
              </p>
            </div>
          </div>
          <Badge className={cn("px-4 py-1 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-sm", getStatusColor(atendimento.status))}>
            {atendimento.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 pt-4 space-y-6">
        {/* Informações básicas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 bg-black/[0.03] dark:bg-white/5 p-3 rounded-xl border border-black/5 dark:border-white/10">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-black uppercase tracking-widest opacity-70">{atendimento.dataAtendimento}</span>
          </div>
          <div className="flex items-center gap-3 bg-black/[0.03] dark:bg-white/5 p-3 rounded-xl border border-black/5 dark:border-white/10">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-black uppercase tracking-widest opacity-70">{atendimento.horaAtendimento} ({atendimento.duracao})</span>
          </div>
        </div>

        {/* Observações */}
        {atendimento.observacoes && (
          <div className="text-xs font-medium text-muted-foreground bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-2xl border border-dashed border-black/5 dark:border-white/10 italic">
            <p className="line-clamp-2">"{atendimento.observacoes}"</p>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-black/5 dark:border-white/5">
          <PermissionGuard permission="canEditAtendimentos">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEditAtendimento(atendimento.id)}
              className="rounded-xl h-10 px-4 font-black uppercase text-[10px] tracking-widest border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Edit className="h-3.5 w-3.5 mr-2" />
              Editar
            </Button>
          </PermissionGuard>
          
          <PermissionGuard permission="canViewClients">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onNavigateToClient(atendimento.clienteId, atendimento.cliente)}
              className="rounded-xl h-10 px-4 font-black uppercase text-[10px] tracking-widest bg-primary/10 text-primary border-none hover:bg-primary/20"
            >
              <User className="h-3.5 w-3.5 mr-2" />
              Ver Cliente
            </Button>
          </PermissionGuard>

          <PermissionGuard permission="canViewProcesses">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigateToProcesses(atendimento.clienteId, atendimento.cliente)}
              className="rounded-xl h-10 px-4 font-black uppercase text-[10px] tracking-widest text-muted-foreground/60 hover:text-primary"
            >
              Processos
            </Button>
          </PermissionGuard>
        </div>
      </CardContent>
    </Card>
  );
};