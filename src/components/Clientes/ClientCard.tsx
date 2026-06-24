import React from 'react';
import { Users, Trash2, Mail, Phone, Calendar, Search, MapPin, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Client } from '@/types/client';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface ClientCardProps {
  client: Client;
  isSelected: boolean;
  onToggleSelect: (clientId: string) => void;
  onClientClick: (client: Client) => void;
  onEditClient: (clientId: string) => void;
  onViewProcesses: (clientId: string, clientName: string) => void;
  onViewAtendimentos: (clientId: string, clientName: string) => void;
  onViewConsultivo: (clientId: string, clientName: string) => void;
  onDeleteClient?: (clientId: string) => void;
}

export const ClientCard: React.FC<ClientCardProps> = ({
  client,
  isSelected,
  onToggleSelect,
  onClientClick,
  onEditClient,
  onViewProcesses,
  onViewAtendimentos,
  onViewConsultivo,
  onDeleteClient
}) => {
  return (
    <Card 
      className={cn(
        "relative bg-white dark:bg-black/20 border border-black/5 dark:border-white/10 backdrop-blur-md hover:bg-white dark:hover:bg-white/5 hover:border-primary/20 shadow-premium hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group cursor-pointer rounded-[2rem]",
        isSelected ? "ring-2 ring-primary border-primary/50 shadow-lg shadow-primary/10" : ""
      )}
      onClick={() => onClientClick(client)}
    >
      {isSelected && <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 animate-pulse" />}

      <CardHeader className="pb-3 pt-6 px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(client.id)}
              className="mt-1 rounded-md border-black/10 dark:border-white/20 data-[state=checked]:bg-primary"
            />
          </div>
          
          <div className="flex items-center gap-4 relative z-10 w-full">
            <div className={cn(
              "h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-inner group-hover:rotate-3",
              isSelected ? 'bg-primary/20 text-primary' : 'bg-black/5 dark:bg-white/5 text-muted-foreground group-hover:text-primary group-hover:bg-primary/5 border border-black/5 dark:border-white/5'
            )}>
              <Users className="h-7 w-7" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start w-full">
                <CardTitle className="text-xl font-black text-foreground group-hover:text-primary transition-colors truncate tracking-tight">
                  {client.name}
                </CardTitle>
              </div>
              <p className="text-[10px] font-black text-muted-foreground/40 flex items-center gap-1 uppercase tracking-widest mt-1">
                <Mail className="h-3 w-3 opacity-60" />
                {client.email || 'Sem e-mail'}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-2 px-6 pb-8 relative z-10">
        <div className="grid gap-3">
          <div className="flex justify-between items-center text-sm p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 shadow-inner">
            <div className="flex items-center gap-2">
               <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                 <Search className="h-3 w-3" />
               </div>
               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                 {client.tipoPessoa === "fisica" ? "CPF" : "CNPJ"}
               </span>
            </div>
            <span className="text-foreground font-mono text-xs font-black">{client.cpfCnpj || '---'}</span>
          </div>

          <div className="flex justify-between items-center text-sm p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 shadow-inner">
            <div className="flex items-center gap-2">
               <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                 <Phone className="h-3 w-3" />
               </div>
               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Contato</span>
            </div>
            <span className="text-foreground font-mono text-xs font-black">{client.phone || '---'}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 shadow-premium space-y-2">
               <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Status do Cliente</p>
               <Badge className={cn(
                 "text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter w-fit border shadow-sm",
                 client.status === "ativo" 
                   ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" 
                   : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-muted-foreground border-slate-200 dark:border-white/5"
               )} variant="outline">
                 {client.status}
               </Badge>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 shadow-premium space-y-2">
               <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Processos Ativos</p>
               <div className="flex items-center gap-2">
                 <div className="p-1 rounded-lg bg-primary/10">
                   <Scale className="h-3 w-3 text-primary" />
                 </div>
                 <span className="font-black text-lg text-foreground tracking-tight">{client.cases}</span>
               </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <PermissionGuard permission="canViewProcesses">
            <Button 
              size="sm" 
              className="w-full bg-primary h-12 rounded-xl text-primary-foreground font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] hover:bg-primary/90 transition-all border-none"
              onClick={(e) => {
                e.stopPropagation();
                onViewProcesses(client.id, client.name);
              }}
            >
              Jurídico
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="canViewAtendimentos">
            <Button 
              size="sm" 
              variant="outline"
              className="w-full h-12 rounded-xl font-black text-[10px] uppercase tracking-widest border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onViewAtendimentos(client.id, client.name);
              }}
            >
              C.R.M
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="canEditClients">
            <Button 
              size="sm" 
              variant="ghost"
              className="w-full h-12 rounded-xl font-black text-[10px] uppercase tracking-widest col-span-2 text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onEditClient(client.id);
              }}
            >
              Ver Ficha Completa
            </Button>
          </PermissionGuard>
        </div>
      </CardContent>

      {onDeleteClient && (
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <PermissionGuard permission="canEditClients">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-xl text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-500/10"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClient(client.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </PermissionGuard>
        </div>
      )}
    </Card>
  );
};