import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useOfficeManagement } from '@/hooks/useOfficeManagement';
import { useToast } from '@/hooks/use-toast';
import { Building2, Save, Users, CreditCard } from 'lucide-react';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';

export const OfficeSettings: React.FC = () => {
  const { office } = useAuth();
  const { updateOffice } = useOfficeManagement();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: office?.name || '',
    email: office?.email || '',
    phone: office?.phone || '',
    address: office?.address || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!office?.id) return;

    setIsLoading(true);
    try {
      const result = await updateOffice(office.id, formData);
      if (result) {
        toast({
          title: "Escritório atualizado",
          description: "As informações do escritório foram salvas com sucesso.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!office) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhum escritório encontrado</h3>
          <p className="text-sm text-muted-foreground text-center mt-2">
            Você não está associado a nenhum escritório.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <PermissionGuard permission="canManageOffice">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Informações do Escritório
            </CardTitle>
            <CardDescription>
              Gerencie as informações básicas do seu escritório
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome do Escritório</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome do escritório"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="contato@escritorio.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Endereço</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Endereço completo do escritório"
                  rows={3}
                />
              </div>
              <Button type="submit" disabled={isLoading} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {isLoading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Estatísticas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Plano atual:</span>
                <span className="text-sm font-medium">{office.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Máximo de usuários:</span>
                <span className="text-sm font-medium">{office.max_users}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                <span className={`text-sm font-medium ${office.active ? 'text-green-600' : 'text-red-600'}`}>
                  {office.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Assinatura
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Para alterar seu plano ou gerenciar sua assinatura, entre em contato com o suporte.
              </p>
              <Button variant="outline" className="mt-4 w-full">
                Falar com Suporte
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PermissionGuard>
  );
};