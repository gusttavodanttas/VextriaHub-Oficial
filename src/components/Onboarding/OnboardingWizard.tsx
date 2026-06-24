import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, ArrowRight, ArrowLeft, Building, Users, Settings, Rocket } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

const initialSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo!',
    description: 'Vamos configurar seu escritório',
    icon: <Rocket className="h-6 w-6" />,
    completed: false
  },
  {
    id: 'office-setup',
    title: 'Configurar Escritório',
    description: 'Informações básicas do escritório',
    icon: <Building className="h-6 w-6" />,
    completed: false
  },
  {
    id: 'team-setup',
    title: 'Convidar Equipe',
    description: 'Adicione membros à sua equipe',
    icon: <Users className="h-6 w-6" />,
    completed: false
  },
  {
    id: 'preferences',
    title: 'Preferências',
    description: 'Configure suas preferências',
    icon: <Settings className="h-6 w-6" />,
    completed: false
  }
];

interface OnboardingWizardProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onComplete,
  onSkip
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState(initialSteps);
  const [officeData, setOfficeData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [inviteEmails, setInviteEmails] = useState(['']);
  const { user } = useAuth();
  const { toast } = useToast();

  if (!isOpen) return null;

  const progress = ((currentStep + 1) / steps.length) * 100;

  const markStepCompleted = (stepIndex: number) => {
    setSteps(prev => prev.map((step, index) => 
      index === stepIndex ? { ...step, completed: true } : step
    ));
  };

  const nextStep = () => {
    markStepCompleted(currentStep);
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
      toast({
        title: "Configuração Concluída!",
        description: "Seu escritório foi configurado com sucesso."
      });
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const addInviteEmail = () => {
    setInviteEmails([...inviteEmails, '']);
  };

  const updateInviteEmail = (index: number, email: string) => {
    const newEmails = [...inviteEmails];
    newEmails[index] = email;
    setInviteEmails(newEmails);
  };

  const removeInviteEmail = (index: number) => {
    setInviteEmails(inviteEmails.filter((_, i) => i !== index));
  };

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'welcome':
        return (
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Rocket className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold">Bem-vindo ao Sistema!</h3>
            <p className="text-muted-foreground">
              Olá, {user?.email}! 
              Vamos configurar seu escritório em poucos passos simples.
            </p>
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">O que vamos fazer:</h4>
              <ul className="text-sm space-y-1 text-left">
                <li>• Configurar informações do escritório</li>
                <li>• Convidar membros da equipe</li>
                <li>• Definir preferências iniciais</li>
                <li>• Conhecer as principais funcionalidades</li>
              </ul>
            </div>
          </div>
        );

      case 'office-setup':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Building className="h-12 w-12 text-primary mx-auto mb-2" />
              <h3 className="text-xl font-bold">Configurar Escritório</h3>
              <p className="text-muted-foreground">Informe os dados básicos do seu escritório</p>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="office-name">Nome do Escritório *</Label>
                <Input
                  id="office-name"
                  value={officeData.name}
                  onChange={(e) => setOfficeData({...officeData, name: e.target.value})}
                  placeholder="Ex: Advocacia Silva & Associados"
                />
              </div>
              
              <div>
                <Label htmlFor="office-email">E-mail Principal</Label>
                <Input
                  id="office-email"
                  type="email"
                  value={officeData.email}
                  onChange={(e) => setOfficeData({...officeData, email: e.target.value})}
                  placeholder="contato@escritorio.com"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="office-phone">Telefone</Label>
                  <Input
                    id="office-phone"
                    value={officeData.phone}
                    onChange={(e) => setOfficeData({...officeData, phone: e.target.value})}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                
                <div>
                  <Label htmlFor="office-address">Endereço</Label>
                  <Input
                    id="office-address"
                    value={officeData.address}
                    onChange={(e) => setOfficeData({...officeData, address: e.target.value})}
                    placeholder="Rua, Cidade - UF"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'team-setup':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Users className="h-12 w-12 text-primary mx-auto mb-2" />
              <h3 className="text-xl font-bold">Convidar Equipe</h3>
              <p className="text-muted-foreground">Adicione membros à sua equipe (opcional)</p>
            </div>
            
            <div className="space-y-3">
              {inviteEmails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={email}
                    onChange={(e) => updateInviteEmail(index, e.target.value)}
                    placeholder="email@exemplo.com"
                    type="email"
                  />
                  {inviteEmails.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeInviteEmail(index)}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addInviteEmail}
                className="w-full"
              >
                + Adicionar outro e-mail
              </Button>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">💡 Dica:</p>
              <p>Você pode pular esta etapa e adicionar membros depois nas configurações.</p>
            </div>
          </div>
        );

      case 'preferences':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Settings className="h-12 w-12 text-primary mx-auto mb-2" />
              <h3 className="text-xl font-bold">Preferências Iniciais</h3>
              <p className="text-muted-foreground">Configure como você quer usar o sistema</p>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 cursor-pointer hover:bg-muted/50">
                  <div className="text-center">
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <h4 className="font-semibold">Notificações por E-mail</h4>
                    <p className="text-sm text-muted-foreground">Receber alertas importantes</p>
                  </div>
                </Card>
                
                <Card className="p-4 cursor-pointer hover:bg-muted/50">
                  <div className="text-center">
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <h4 className="font-semibold">Dashboard Personalizado</h4>
                    <p className="text-sm text-muted-foreground">Widgets personalizáveis</p>
                  </div>
                </Card>
              </div>
              
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">🎉 Tudo Pronto!</h4>
                <p className="text-sm">
                  Configuração inicial concluída. Agora você pode começar a usar todas as funcionalidades do sistema.
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {steps[currentStep].icon}
                {steps[currentStep].title}
              </CardTitle>
              <CardDescription>{steps[currentStep].description}</CardDescription>
            </div>
            <Badge variant="outline">
              {currentStep + 1} de {steps.length}
            </Badge>
          </div>
          <Progress value={progress} className="mt-4" />
        </CardHeader>
        
        <CardContent className="space-y-6">
          {renderStepContent()}
          
          <div className="flex justify-between pt-4">
            <div>
              {currentStep > 0 && (
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Anterior
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onSkip}>
                Pular Configuração
              </Button>
              <Button onClick={nextStep}>
                {currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}
                {currentStep < steps.length - 1 && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};