import React from 'react';
import { Trash2, Mail, Phone, Scale, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Client } from '@/types/client';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';
import { cn } from '@/lib/utils';
import { formatPhone } from '@/lib/phone';
import { onlyDigits } from '@/lib/document';
import { MessageCircle } from 'lucide-react';

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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(name: string) {
  const colors = [
    "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const STATUS_COLOR: Record<string, string> = {
  ativo: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  inativo: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  convertido: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
};

export const ClientCard: React.FC<ClientCardProps> = ({
  client,
  isSelected,
  onToggleSelect,
  onClientClick,
  onEditClient,
  onViewProcesses,
  onViewAtendimentos,
  onViewConsultivo,
  onDeleteClient,
}) => {
  const initials = getInitials(client.name);
  const avatarCls = avatarColor(client.name);
  const statusCls = STATUS_COLOR[client.status.toLowerCase()] ||
    "bg-slate-100 dark:bg-muted/30 text-slate-500 border-slate-200 dark:border-border";

  return (
    <Card
      className={cn(
        "relative bg-card border border-black/5 dark:border-border hover:border-primary/20 shadow-premium hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group cursor-pointer rounded-2xl",
        isSelected && "ring-2 ring-primary border-primary/40"
      )}
      onClick={() => onClientClick(client)}
    >
      {/* Checkbox */}
      <div className="absolute top-3.5 left-3.5 z-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(client.id)}
          className="rounded-md border-black/10 dark:border-border data-[state=checked]:bg-primary opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
        />
      </div>

      {/* Delete */}
      {onDeleteClient && (
        <div className="absolute top-3.5 right-3.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <PermissionGuard permission="canEditClients">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-500/10"
              onClick={(e) => { e.stopPropagation(); onDeleteClient(client.id); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </PermissionGuard>
        </div>
      )}

      <CardContent className="pt-6 pb-5 px-5 space-y-4">
        {/* Avatar + nome */}
        <div className="flex items-center gap-3 pt-2">
          <div className={cn(
            "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 text-sm font-black transition-transform duration-300 group-hover:scale-110",
            avatarCls
          )}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-black text-base tracking-tight truncate group-hover:text-primary transition-colors">
              {client.name}
            </p>
            <p className="text-xs text-muted-foreground/60 truncate flex items-center gap-1">
              <Mail className="h-3 w-3 shrink-0" />
              {client.email || "Sem e-mail"}
            </p>
          </div>
        </div>

        {/* Status + Processos */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-border p-3 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Status</p>
            <Badge variant="outline" className={cn("text-[9px] font-black px-1.5 py-0 rounded border", statusCls)}>
              {client.status}
            </Badge>
          </div>
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-border p-3 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Processos</p>
            <div className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-primary" />
              <span className="text-lg font-black tracking-tight leading-none">{client.cases}</span>
            </div>
          </div>
        </div>

        {/* Telefone */}
        {client.phone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70 font-mono px-0.5">
            <Phone className="h-3 w-3 shrink-0" />
            {formatPhone(client.phone)}
            <a
              href={`https://wa.me/55${onlyDigits(client.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ml-auto text-emerald-600 dark:text-emerald-400 hover:scale-110 transition-transform"
              title="WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {/* Ações */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <PermissionGuard permission="canViewProcesses">
            <Button
              size="sm"
              className="h-9 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm hover:scale-[1.02] transition-transform"
              onClick={(e) => { e.stopPropagation(); onViewProcesses(client.id, client.name); }}
            >
              Processos
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="canViewAtendimentos">
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-xl text-[10px] font-black uppercase tracking-wider border-black/8 dark:border-border hover:bg-black/5 dark:hover:bg-muted/40 transition-all"
              onClick={(e) => { e.stopPropagation(); onViewAtendimentos(client.id, client.name); }}
            >
              Atendimentos
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="canEditClients">
            <Button
              size="sm"
              variant="ghost"
              className="col-span-2 h-9 rounded-xl text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-1.5"
              onClick={(e) => { e.stopPropagation(); onEditClient(client.id); }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver ficha completa
            </Button>
          </PermissionGuard>
        </div>
      </CardContent>
    </Card>
  );
};
