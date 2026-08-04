import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useSystemAdminAccess } from '@/utils/adminAccess';
import { Shield, CreditCard, ArrowLeft } from 'lucide-react';
import CobrancaAsaas from '@/components/Admin/CobrancaAsaas';

const SystemSubscriptions: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const adminAccess = useSystemAdminAccess(user?.email);

  if (!adminAccess.canControlSubscriptions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            <Shield className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-destructive">Acesso Negado</h3>
            <p className="text-muted-foreground mb-4">Você não tem permissão para acessar o controle de assinaturas.</p>
            <div className="space-y-2">
              <Button onClick={() => navigate('/system-admin')} variant="outline" className="w-full">Voltar ao Sistema Admin</Button>
              <Button onClick={() => navigate('/dashboard')} variant="outline" className="w-full">Voltar ao Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 entry-animate fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="h-8 w-8 text-primary shrink-0" />
            Cobrança (Asaas)
          </h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Configure o plano de cada escritório, libere cortesia e acompanhe os pagamentos.
          </p>
        </div>
        <Button onClick={() => navigate('/system-admin')} variant="outline" size="sm" className="h-9">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>

      <CobrancaAsaas />
    </div>
  );
};

export default SystemSubscriptions;
