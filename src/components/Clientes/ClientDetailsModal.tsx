import React from 'react';
import { User, Building, Mail, Phone, MapPin, Calendar, MessageCircle, Scale, Headphones, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Client } from '@/types/client';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';
import { formatCpfCnpj, onlyDigits } from '@/lib/document';
import { formatPhone } from '@/lib/phone';
import { useClienteResumo } from '@/hooks/useClienteResumo';
import { cn } from '@/lib/utils';

interface ClientDetailsModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onEditClient: (clientId: string) => void;
  onViewProcesses: (clientId: string, clientName: string) => void;
  onViewAtendimentos: (clientId: string, clientName: string) => void;
  onViewConsultivo: (clientId: string, clientName: string) => void;
}

export const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({
  client, isOpen, onClose, onEditClient, onViewProcesses, onViewAtendimentos, onViewConsultivo,
}) => {
  const { processos, atendimentos, loading } = useClienteResumo(client?.id ?? null, isOpen);
  if (!client) return null;

  const isAtivo = (client.status || '').toLowerCase() === 'ativo';
  const phoneDigits = onlyDigits(client.phone || '');
  const waLink = phoneDigits ? `https://wa.me/55${phoneDigits}` : null;
  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return '—'; } };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-full sm:max-w-2xl bg-card border border-border text-foreground p-0 shadow-2xl overflow-hidden rounded-3xl">
        <div className="p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader className="border-b border-border pb-5">
            <DialogTitle className="flex items-center gap-3 text-2xl font-black text-foreground">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                {client.tipoPessoa === 'fisica' ? <User className="h-6 w-6 text-primary" /> : <Building className="h-6 w-6 text-primary" />}
              </div>
              <span className="truncate pr-4">{client.name}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Status + tipo */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className={cn('text-xs uppercase font-black tracking-wider px-3 py-1', isAtivo ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-muted/40 text-muted-foreground border-border')}>
              {isAtivo ? 'Ativo' : (client.status || 'Inativo')}
            </Badge>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs px-3 py-1">
              {client.tipoPessoa === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </Badge>
          </div>

          {/* Contato + cadastro */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-muted/30 border border-border rounded-2xl p-5 space-y-3">
              <h3 className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-black border-b border-border pb-2">Contato</h3>
              <a href={client.email ? `mailto:${client.email}` : undefined} className={cn('flex items-center gap-3 group', !client.email && 'pointer-events-none')}>
                <div className="p-2 rounded-lg bg-muted/40"><Mail className="h-4 w-4 text-muted-foreground" /></div>
                <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">{client.email || 'Não informado'}</span>
              </a>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted/40"><Phone className="h-4 w-4 text-muted-foreground" /></div>
                <span className="text-sm font-medium font-mono">{client.phone ? formatPhone(client.phone) : 'Não informado'}</span>
                {waLink && (
                  <a href={waLink} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400 hover:underline">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted/40"><MapPin className="h-4 w-4 text-muted-foreground" /></div>
                <span className="text-sm font-medium leading-relaxed">{client.endereco || 'Endereço não cadastrado'}</span>
              </div>
            </div>

            <div className="bg-muted/30 border border-border rounded-2xl p-5 space-y-3">
              <h3 className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-black border-b border-border pb-2">Cadastro</h3>
              <Row label={client.tipoPessoa === 'fisica' ? 'CPF' : 'CNPJ'} value={client.cpfCnpj ? formatCpfCnpj(client.cpfCnpj, client.tipoPessoa) : '---'} mono />
              <Row label="Origem" value={client.origem || '---'} />
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground/70">Processos:</span>
                <div className="bg-primary/15 text-primary px-2 py-0.5 rounded-full text-xs font-black">{client.cases}</div>
              </div>
              {client.dataAniversario && (
                <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                  <span className="flex items-center gap-2 text-muted-foreground/70"><Calendar className="h-4 w-4" /> Aniversário:</span>
                  <span>{fmtDate(client.dataAniversario)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Últimos processos / atendimentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MiniList title="Últimos processos" icon={Scale} loading={loading} empty="Nenhum processo vinculado">
              {processos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
                  <span className="truncate font-medium">{p.titulo || p.numero_processo || 'Processo'}</span>
                  {p.status && <span className="text-[10px] font-bold text-muted-foreground/60 shrink-0 uppercase">{p.status}</span>}
                </li>
              ))}
            </MiniList>
            <MiniList title="Últimos atendimentos" icon={Headphones} loading={loading} empty="Nenhum atendimento registrado">
              {atendimentos.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
                  <span className="truncate font-medium">{a.tipo_atendimento}</span>
                  <span className="text-[10px] font-bold text-muted-foreground/60 shrink-0">{fmtDate(a.data_atendimento)}</span>
                </li>
              ))}
            </MiniList>
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-3 pt-2 border-t border-border">
            <PermissionGuard permission="canViewProcesses">
              <Button onClick={() => { onClose(); onViewProcesses(client.id, client.name); }} className="w-full h-12 font-bold rounded-xl">
                Acessar Jurídico (Processos)
              </Button>
            </PermissionGuard>
            <div className="grid grid-cols-2 gap-3">
              <PermissionGuard permission="canViewAtendimentos">
                <Button variant="outline" className="h-12 rounded-xl" onClick={() => { onClose(); onViewAtendimentos(client.id, client.name); }}>Atendimentos</Button>
              </PermissionGuard>
              <PermissionGuard permission="canViewConsultivo">
                <Button variant="outline" className="h-12 rounded-xl" onClick={() => { onClose(); onViewConsultivo(client.id, client.name); }}>Consultivo</Button>
              </PermissionGuard>
            </div>
            <PermissionGuard permission="canEditClients">
              <Button variant="ghost" className="text-muted-foreground/70 hover:text-foreground" onClick={() => { onClose(); onEditClient(client.id); }}>Editar Cadastro Completo</Button>
            </PermissionGuard>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground/70">{label}:</span>
      <span className={cn('text-foreground', mono && 'font-mono')}>{value}</span>
    </div>
  );
}

function MiniList({ title, icon: Icon, loading, empty, children }: { title: string; icon: React.FC<any>; loading: boolean; empty: string; children: React.ReactNode }) {
  const hasItems = React.Children.count(children) > 0;
  return (
    <div className="bg-muted/20 border border-border rounded-2xl p-4">
      <h3 className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-black flex items-center gap-1.5 mb-2"><Icon className="h-3.5 w-3.5" /> {title}</h3>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary/40" /></div>
      ) : hasItems ? (
        <ul>{children}</ul>
      ) : (
        <p className="text-xs text-muted-foreground/50 py-2">{empty}</p>
      )}
    </div>
  );
}
