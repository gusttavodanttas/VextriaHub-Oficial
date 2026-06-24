import React from 'react';
import { Client } from '@/types/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, Scale, Activity, FileText, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ClientsTableProps {
  clients: Client[];
  selectedIds: string[];
  onToggleSelect: (clientId: string) => void;
  onClientClick: (client: Client) => void;
  onEditClient: (clientId: string) => void;
  onViewProcesses: (clientId: string, clientName: string) => void;
  onViewAtendimentos: (clientId: string, clientName: string) => void;
  onViewConsultivo: (clientId: string, clientName: string) => void;
  onDeleteClient?: (clientId: string) => void;
}

export const ClientsTable: React.FC<ClientsTableProps> = ({
  clients,
  selectedIds,
  onToggleSelect,
  onClientClick,
  onEditClient,
  onViewProcesses,
  onViewAtendimentos,
  onViewConsultivo,
  onDeleteClient
}) => {
  return (
    <div className="rounded-[2.5rem] border border-black/5 dark:border-white/10 bg-white dark:bg-card/40 backdrop-blur-md overflow-hidden shadow-premium">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-black/5 dark:border-white/5 hover:bg-transparent bg-black/5 dark:bg-white/5">
            <TableHead className="w-[60px] pl-6"></TableHead>
            <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground/60 py-5">Nome</TableHead>
            <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground/60 py-5">Contato</TableHead>
            <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground/60 py-5">Tipo</TableHead>
            <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground/60 py-5">Métricas</TableHead>
            <TableHead className="text-right pr-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground/60 py-5">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => {
            const isSelected = selectedIds.includes(client.id);
            
            return (
              <TableRow 
                key={client.id} 
                className={cn(
                   "border-b border-black/5 dark:border-white/5 transition-all duration-300 cursor-pointer group",
                   isSelected ? 'bg-primary/[0.08] dark:bg-primary/20' : 'hover:bg-primary/[0.02] dark:hover:bg-white/[0.02]'
                )}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.checkbox-cell')) {
                    return;
                  }
                  onClientClick(client);
                }}
              >
                <TableCell className="checkbox-cell pl-6" onClick={(e) => e.stopPropagation()}>
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(client.id)}
                    className="rounded-md border-black/10 dark:border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all"
                  />
                </TableCell>
                
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground group-hover:text-primary transition-colors">{client.name}</span>
                    <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/40">{client.cpfCnpj || 'Sem Documento'}</span>
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground/80">{client.email || 'Sem e-mail'}</span>
                    <span className="text-xs font-bold text-muted-foreground/50">{client.phone || 'Sem telefone'}</span>
                  </div>
                </TableCell>
                
                <TableCell>
                  <Badge variant="outline" className={cn(
                    "font-black text-[9px] uppercase tracking-widest border px-2 py-0.5 rounded-lg",
                    client.tipoPessoa === 'juridica' 
                      ? 'border-indigo-500/20 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400' 
                      : 'border-orange-500/20 bg-orange-500/5 text-orange-600 dark:text-orange-400'
                  )}>
                    {client.tipoPessoa === 'juridica' ? 'PJ' : 'PF'}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/5 w-fit border border-black/5 dark:border-white/5">
                    <Scale className="h-3 w-3 text-primary/60" />
                    <span className="text-xs font-black uppercase tracking-tighter text-foreground/60">{client.cases || 0} processos</span>
                  </div>
                </TableCell>
                
                <TableCell className="text-right pr-6">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[220px] p-2 rounded-2xl bg-popover/95 backdrop-blur-xl border-black/5 dark:border-white/10 shadow-2xl">
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); onEditClient(client.id); }}
                        className="rounded-xl p-3 font-bold text-sm cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Edit className="h-4 w-4 mr-3 opacity-60" /> Editar Dados
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); onViewProcesses(client.id, client.name); }}
                        className="rounded-xl p-3 font-bold text-sm cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Scale className="h-4 w-4 mr-3 opacity-60" /> Acessar Processos
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); onViewAtendimentos(client.id, client.name); }}
                        className="rounded-xl p-3 font-bold text-sm cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Activity className="h-4 w-4 mr-3 opacity-60" /> Acessar C.R.M
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); onViewConsultivo(client.id, client.name); }}
                        className="rounded-xl p-3 font-bold text-sm cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <FileText className="h-4 w-4 mr-3 opacity-60" /> Acessar Consultivo
                      </DropdownMenuItem>
                      {onDeleteClient && (
                        <>
                          <DropdownMenuSeparator className="my-1 bg-black/5 dark:bg-white/5" />
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); onDeleteClient(client.id); }}
                            className="rounded-xl p-3 font-bold text-sm cursor-pointer text-rose-500 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="h-4 w-4 mr-3 opacity-60" /> Excluir Cliente
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

