import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  Plus, 
  X, 
  Mail, 
  Users, 
  FileText, 
  Link2, 
  BarChart3,
  Download,
  Send
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOfficeManagement } from '@/hooks/useOfficeManagement';

interface BulkInvite {
  email: string;
  role: 'user' | 'admin';
  name?: string;
}

const inviteTemplates = [
  {
    id: 'default',
    name: 'Padrão',
    subject: 'Convite para juntar-se ao nosso escritório',
    body: 'Você foi convidado(a) para fazer parte do nosso escritório. Clique no link abaixo para aceitar o convite e criar sua conta.'
  },
  {
    id: 'admin',
    name: 'Administrador',
    subject: 'Convite para ser Administrador',
    body: 'Você foi convidado(a) para ser administrador do nosso escritório. Com esta função, você terá acesso a recursos avançados de gestão.'
  },
  {
    id: 'professional',
    name: 'Profissional',
    subject: 'Bem-vindo(a) à nossa equipe',
    body: 'É com prazer que convidamos você para integrar nossa equipe jurídica. Juntos, vamos oferecer o melhor atendimento aos nossos clientes.'
  }
];

export const AdvancedInviteManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('single');
  const [bulkInvites, setBulkInvites] = useState<BulkInvite[]>([]);
  const [csvData, setCsvData] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(inviteTemplates[0]);
  const [customMessage, setCustomMessage] = useState('');
  const [publicLinkEnabled, setPublicLinkEnabled] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  
  const { toast } = useToast();
  const { offices } = useOfficeManagement();

  // Single invite state
  const [singleInvite, setSingleInvite] = useState({
    email: '',
    role: 'user' as 'user' | 'admin',
    name: '',
    customMessage: ''
  });

  const addBulkInvite = () => {
    setBulkInvites([...bulkInvites, { email: '', role: 'user' }]);
  };

  const updateBulkInvite = (index: number, field: keyof BulkInvite, value: string) => {
    const updated = [...bulkInvites];
    updated[index] = { ...updated[index], [field]: value };
    setBulkInvites(updated);
  };

  const removeBulkInvite = (index: number) => {
    setBulkInvites(bulkInvites.filter((_, i) => i !== index));
  };

  const processCsvData = () => {
    const lines = csvData.trim().split('\n');
    const newInvites: BulkInvite[] = [];
    
    lines.forEach((line, index) => {
      if (index === 0) return; // Skip header
      const [email, role, name] = line.split(',').map(s => s.trim());
      if (email) {
        newInvites.push({
          email,
          role: (role as 'user' | 'admin') || 'user',
          name: name || ''
        });
      }
    });
    
    setBulkInvites(newInvites);
    toast({
      title: "CSV Processado",
      description: `${newInvites.length} convites foram adicionados da planilha.`
    });
  };

  const downloadCsvTemplate = () => {
    const csvContent = "email,role,name\nexemplo@email.com,user,João Silva\nadmin@email.com,admin,Maria Santos";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_convites.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const sendSingleInvite = async () => {
    setSendingInvites(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Convite Enviado",
        description: `Convite enviado para ${singleInvite.email} com sucesso.`
      });
      
      setSingleInvite({ email: '', role: 'user', name: '', customMessage: '' });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao enviar convite. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSendingInvites(false);
    }
  };

  const sendBulkInvites = async () => {
    setSendingInvites(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      toast({
        title: "Convites Enviados",
        description: `${bulkInvites.length} convites foram enviados com sucesso.`
      });
      
      setBulkInvites([]);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao enviar convites. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSendingInvites(false);
    }
  };

  const generatePublicLink = () => {
    const link = `${window.location.origin}/convite/publico/${Math.random().toString(36).substr(2, 9)}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link Copiado",
      description: "Link público de convite copiado para a área de transferência."
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestão Avançada de Convites
          </CardTitle>
          <CardDescription>
            Gerencie convites de forma individual, em lote ou através de links públicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="single">Individual</TabsTrigger>
              <TabsTrigger value="bulk">Em Lote</TabsTrigger>
              <TabsTrigger value="csv">Upload CSV</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={singleInvite.email}
                    onChange={(e) => setSingleInvite({...singleInvite, email: e.target.value})}
                    placeholder="usuario@exemplo.com"
                  />
                </div>
                
                <div>
                  <Label htmlFor="name">Nome (Opcional)</Label>
                  <Input
                    id="name"
                    value={singleInvite.name}
                    onChange={(e) => setSingleInvite({...singleInvite, name: e.target.value})}
                    placeholder="João Silva"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="role">Função</Label>
                <Select 
                  value={singleInvite.role} 
                  onValueChange={(value: 'user' | 'admin') => setSingleInvite({...singleInvite, role: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="template">Template da Mensagem</Label>
                <Select 
                  value={selectedTemplate.id} 
                  onValueChange={(value) => {
                    const template = inviteTemplates.find(t => t.id === value);
                    if (template) setSelectedTemplate(template);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {inviteTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="custom-message">Mensagem Personalizada (Opcional)</Label>
                <Textarea
                  id="custom-message"
                  value={singleInvite.customMessage}
                  onChange={(e) => setSingleInvite({...singleInvite, customMessage: e.target.value})}
                  placeholder="Adicione uma mensagem personalizada..."
                  rows={3}
                />
              </div>

              <Button 
                onClick={sendSingleInvite}
                disabled={!singleInvite.email || sendingInvites}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {sendingInvites ? 'Enviando...' : 'Enviar Convite'}
              </Button>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Convites em Lote</h3>
                <Button onClick={addBulkInvite} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-3 max-h-96 overflow-auto">
                {bulkInvites.map((invite, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <Input
                        type="email"
                        value={invite.email}
                        onChange={(e) => updateBulkInvite(index, 'email', e.target.value)}
                        placeholder="E-mail"
                      />
                      <Input
                        value={invite.name || ''}
                        onChange={(e) => updateBulkInvite(index, 'name', e.target.value)}
                        placeholder="Nome (opcional)"
                      />
                      <Select 
                        value={invite.role} 
                        onValueChange={(value: 'user' | 'admin') => updateBulkInvite(index, 'role', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Usuário</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeBulkInvite(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              {bulkInvites.length > 0 && (
                <div className="space-y-3">
                  <Separator />
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">
                      {bulkInvites.length} convite(s) preparado(s)
                    </Badge>
                    <Button 
                      onClick={sendBulkInvites}
                      disabled={sendingInvites}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {sendingInvites ? 'Enviando...' : 'Enviar Todos'}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="csv" className="space-y-4">
              <div className="text-center space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Upload de Planilha CSV</h3>
                  <p className="text-muted-foreground text-sm">
                    Faça upload de uma planilha CSV com e-mails para envio em lote
                  </p>
                </div>

                <Button onClick={downloadCsvTemplate} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Template CSV
                </Button>
              </div>

              <div>
                <Label htmlFor="csv-data">Cole os dados CSV ou digite manualmente:</Label>
                <Textarea
                  id="csv-data"
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                  placeholder="email,role,name&#10;usuario@exemplo.com,user,João Silva&#10;admin@exemplo.com,admin,Maria Santos"
                  rows={8}
                />
              </div>

              <Button 
                onClick={processCsvData}
                disabled={!csvData.trim()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Processar CSV
              </Button>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="flex items-center space-x-2">
                    <Mail className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Convites Enviados</p>
                      <p className="text-2xl font-bold">24</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Aceitos</p>
                      <p className="text-2xl font-bold">18</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-sm font-medium">Taxa de Conversão</p>
                      <p className="text-2xl font-bold">75%</p>
                    </div>
                  </div>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Link Público de Convite</CardTitle>
                  <CardDescription>
                    Crie um link público para facilitar o processo de convite
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Input 
                      value="https://app.exemplo.com/convite/abc123"
                      readOnly 
                      className="flex-1"
                    />
                    <Button onClick={generatePublicLink}>
                      <Link2 className="h-4 w-4 mr-2" />
                      Gerar Novo
                    </Button>
                  </div>
                  
                  <div className="bg-muted/50 p-3 rounded-lg text-sm">
                    <p className="font-medium mb-1">ℹ️ Como funciona:</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Compartilhe este link com pessoas que deseja convidar</li>
                      <li>• Elas podem se registrar diretamente usando o link</li>
                      <li>• Novos usuários recebem automaticamente a função de "Usuário"</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};