import React from 'react';
import { User, Building, Mail, Phone, MapPin, Calendar, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Client } from '@/types/client';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';

interface ClientDetailsModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onEditClient: (clientId: number) => void;
  onViewProcesses: (clientId: number, clientName: string) => void;
  onViewAtendimentos: (clientId: number, clientName: string) => void;
  onViewConsultivo: (clientId: number, clientName: string) => void;
}

export const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({
  client,
  isOpen,
  onClose,
  onEditClient,
  onViewProcesses,
  onViewAtendimentos,
  onViewConsultivo
}) => {
  if (!client) return null;

  const handleEditClick = () => {
    onClose();
    onEditClient(client.id);
  };

  const handleViewProcesses = () => {
    onClose();
    onViewProcesses(client.id, client.name);
  };

  const handleViewAtendimentos = () => {
    onClose();
    onViewAtendimentos(client.id, client.name);
  };

  const handleViewConsultivo = () => {
    onClose();
    onViewConsultivo(client.id, client.name);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-2xl bg-[#0A0D14] border border-white/10 text-white p-0 shadow-2xl overflow-hidden rounded-3xl">
        <div className="p-6 md:p-8 space-y-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader className="border-b border-white/5 pb-6">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-white">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                {client.tipoPessoa === "fisica" ? (
                  <User className="h-6 w-6 text-primary" />
                ) : (
                  <Building className="h-6 w-6 text-primary" />
                )}
              </div>
              <span className="truncate pr-4">{client.name}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-8">
            {/* Status and Type */}
            <div className="flex items-center gap-4">
              <Badge className={`text-xs uppercase font-bold tracking-wider px-3 py-1 ${client.status === "ativo" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-white/40 border-white/10"}`} variant="outline">
                {client.status}
              </Badge>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs px-3 py-1">
                {client.tipoPessoa === "fisica" ? "Pessoa Física" : "Pessoa Jurídica"}
              </Badge>
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4">
                <h3 className="text-[10px] text-white/40 uppercase tracking-widest font-bold border-b border-white/5 pb-2">Informações de Contato</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5">
                      <Mail className="h-4 w-4 text-white/60" />
                    </div>
                    <span className="text-sm text-white/80 font-medium truncate shrink-0 max-w-[150px]">{client.email || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5">
                      <Phone className="h-4 w-4 text-white/60" />
                    </div>
                    <span className="text-sm text-white/80 font-medium font-mono">{client.phone || 'Não informado'}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white/5">
                      <MapPin className="h-4 w-4 text-white/60" />
                    </div>
                    <span className="text-sm text-white/80 font-medium leading-relaxed">{client.endereco || 'Endereço não cadastrado'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4">
                <h3 className="text-[10px] text-white/40 uppercase tracking-widest font-bold border-b border-white/5 pb-2">Detalhes Cadastrais</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">
                      {client.tipoPessoa === "fisica" ? "CPF:" : "CNPJ:"}
                    </span>
                    <span className="font-mono text-white/90">{client.cpfCnpj || '---'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Origem:</span>
                    <span className="text-white/90">{client.origem || '---'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Processos Cadastrados:</span>
                    <div className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-xs font-bold">
                      {client.cases}
                    </div>
                  </div>
                  {client.dataAniversario && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2 text-white/40">
                        <Calendar className="h-4 w-4" />
                        <span>Aniversário:</span>
                      </div>
                      <span className="text-white/90">
                        {new Date(client.dataAniversario).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
              <PermissionGuard permission="canViewProcesses">
                <Button onClick={handleViewProcesses} className="w-full h-12 bg-primary shadow-lg shadow-primary/20 text-md font-bold hover:scale-[1.02] transition-all">
                  Acessar Jurídico (Processos)
                </Button>
              </PermissionGuard>
              
              <div className="grid grid-cols-2 gap-3">
                <PermissionGuard permission="canViewAtendimentos">
                  <Button variant="outline" className="h-12 bg-white/5 border-white/10 hover:bg-white/10" onClick={handleViewAtendimentos}>
                    C.R.M
                  </Button>
                </PermissionGuard>
                
                <PermissionGuard permission="canViewConsultivo">
                  <Button variant="outline" className="h-12 bg-white/5 border-white/10 hover:bg-white/10" onClick={handleViewConsultivo}>
                    Consultivo
                  </Button>
                </PermissionGuard>
              </div>

              <PermissionGuard permission="canEditClients">
                <Button variant="ghost" className="text-white/40 hover:text-white mt-2" onClick={handleEditClick}>
                  Editar Cadastro Completo
                </Button>
              </PermissionGuard>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};