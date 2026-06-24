import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FileText, Scale, User, Gavel, ShieldCheck, Info } from 'lucide-react';
import { Processo, tiposProcesso, statusProcesso, fasesProcessuais } from '@/types/processo';
import { useOfficeUsers } from '@/hooks/useOfficeUsers';
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '@/components/ui/separator';
import { formatCNJ } from '@/lib/formatters';

interface ProcessoEditDialogProps {
  processo: Processo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, updates: Partial<Processo>) => void;
}

export const ProcessoEditDialog: React.FC<ProcessoEditDialogProps> = ({
  processo,
  open,
  onOpenChange,
  onUpdate,
}) => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { users: teamMembers } = useOfficeUsers();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Processo>>({});

  useEffect(() => {
    if (processo) {
      setFormData({
        titulo: processo.titulo,
        cliente: processo.cliente,
        clienteId: processo.clienteId,
        status: processo.status,
        proximoPrazo: processo.proximoPrazo,
        descricao: processo.descricao,
        valorCausa: processo.valorCausa,
        numeroProcesso: processo.numeroProcesso,
        tipoProcesso: processo.tipoProcesso,
        faseProcessual: processo.faseProcessual,
        responsavelId: processo.responsavelId,
        tribunal: processo.tribunal || '',
        vara: processo.vara || '',
        comarca: processo.comarca || '',
        requerido: processo.requerido || '',
        segredoJustica: processo.segredoJustica || false,
        justicaGratuita: processo.justicaGratuita || false
      });
    }
  }, [processo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processo) return;

    setIsLoading(true);
    try {
      await onUpdate(processo.id, formData);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao atualizar processo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof Processo, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (!processo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Editar Processo</DialogTitle>
          <DialogDescription>
            Atualize as informações do processo jurídico.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto px-6">
          <form onSubmit={handleSubmit} className="space-y-8 py-4">
            {/* Seção 1: Identificação Básica */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary font-semibold border-b pb-2">
                <Info className="h-4 w-4" />
                <span>Identificação Básica</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-titulo">Título do Processo *</Label>
                  <Input
                    id="edit-titulo"
                    required
                    value={formData.titulo || ''}
                    onChange={(e) => handleChange('titulo', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-cliente">Cliente *</Label>
                  <Input
                    id="edit-cliente"
                    required
                    value={formData.cliente || ''}
                    onChange={(e) => handleChange('cliente', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-numeroProcesso">Número do Processo (CNJ)</Label>
                  <Input
                    id="edit-numeroProcesso"
                    value={formData.numeroProcesso || ''}
                    onChange={(e) => handleChange('numeroProcesso', formatCNJ(e.target.value))}
                    placeholder="0000000-00.0000.0.00.0000"
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Seção 2: Capa Jurídica */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-primary font-semibold border-b pb-2">
                <Gavel className="h-4 w-4" />
                <span>Capa Jurídica</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-tribunal">Tribunal / Instância</Label>
                  <Input
                    id="edit-tribunal"
                    value={formData.tribunal || ''}
                    onChange={(e) => handleChange('tribunal', e.target.value)}
                    placeholder="Ex: TJSP, TRT2..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-comarca">Comarca / Foro</Label>
                  <Input
                    id="edit-comarca"
                    value={formData.comarca || ''}
                    onChange={(e) => handleChange('comarca', e.target.value)}
                    placeholder="Ex: São Paulo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vara">Vara / Secretaria</Label>
                  <Input
                    id="edit-vara"
                    value={formData.vara || ''}
                    onChange={(e) => handleChange('vara', e.target.value)}
                    placeholder="Ex: 2ª Vara Cível"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-requerido">Parte Contraria (Requerido)</Label>
                  <Input
                    id="edit-requerido"
                    value={formData.requerido || ''}
                    onChange={(e) => handleChange('requerido', e.target.value)}
                    placeholder="Nome do réu/oponente"
                  />
                </div>
              </div>
            </div>

            {/* Seção 3: Gestão Processual */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-primary font-semibold border-b pb-2">
                <Scale className="h-4 w-4" />
                <span>Gestão e Prazos</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value: any) => handleChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusProcesso.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fase Processual</Label>
                  <Select 
                    value={formData.faseProcessual} 
                    onValueChange={(value) => handleChange('faseProcessual', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a fase" />
                    </SelectTrigger>
                    <SelectContent>
                      {fasesProcessuais.map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo do Processo / Área</Label>
                  <Select 
                    value={formData.tipoProcesso} 
                    onValueChange={(value) => handleChange('tipoProcesso', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposProcesso.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Select 
                    value={formData.responsavelId || ''} 
                    onValueChange={(value) => handleChange('responsavelId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.length > 0 ? (
                        teamMembers.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id || ''}>
                            {member.profile?.full_name || member.profile?.email || 'Membro sem nome'}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value={formData.responsavelId || 'none'} disabled>
                          {processo.responsavelNome || 'Carregando...'}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-proximoPrazo">Próximo Prazo</Label>
                  <Input
                    id="edit-proximoPrazo"
                    type="date"
                    value={formData.proximoPrazo || ''}
                    onChange={(e) => handleChange('proximoPrazo', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-valorCausa">Valor da Causa (R$)</Label>
                  <Input
                    id="edit-valorCausa"
                    type="number"
                    step="0.01"
                    value={formData.valorCausa || ''}
                    onChange={(e) => handleChange('valorCausa', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Seção 4: Opções e Observações */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-primary font-semibold border-b pb-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Configurações Extras</span>
              </div>
              <div className="flex flex-wrap gap-6 py-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="edit-segredoJustica" 
                    checked={formData.segredoJustica}
                    onCheckedChange={(checked) => handleChange('segredoJustica', !!checked)}
                  />
                  <Label htmlFor="edit-segredoJustica" className="cursor-pointer">Segredo de Justiça</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="edit-justicaGratuita" 
                    checked={formData.justicaGratuita}
                    onCheckedChange={(checked) => handleChange('justicaGratuita', !!checked)}
                  />
                  <Label htmlFor="edit-justicaGratuita" className="cursor-pointer">Justiça Gratuita</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-descricao">Descrição / Observações</Label>
                <Textarea
                  id="edit-descricao"
                  value={formData.descricao || ''}
                  onChange={(e) => handleChange('descricao', e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="sticky bottom-0 bg-background pt-4 pb-2 mt-4 z-10 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
