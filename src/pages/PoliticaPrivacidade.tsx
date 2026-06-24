import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield, Lock, Eye, FileText, Users, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PoliticaPrivacidade = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Política de Privacidade</h1>
              <p className="text-muted-foreground">VextriaHub - Software Jurídico</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Introdução */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Introdução
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                A VextriaHub está comprometida com a proteção da privacidade e segurança dos dados pessoais de nossos usuários. 
                Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais 
                quando você utiliza nosso software jurídico.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) e 
                outras legislações aplicáveis de proteção de dados.
              </p>
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                <p className="text-sm font-medium text-primary">
                  <strong>Última atualização:</strong> Janeiro de 2025
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Dados Coletados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Dados Coletados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">Dados de Identificação:</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li>Nome completo</li>
                    <li>E-mail</li>
                    <li>Número de telefone</li>
                    <li>CPF/CNPJ</li>
                    <li>Número da OAB (quando aplicável)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Dados de Uso:</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li>Informações sobre como você utiliza o software</li>
                    <li>Logs de acesso e atividades</li>
                    <li>Dados de navegação e interação</li>
                    <li>Informações técnicas do dispositivo</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Dados Profissionais:</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li>Informações sobre processos jurídicos</li>
                    <li>Dados de clientes e casos</li>
                    <li>Documentos e arquivos carregados</li>
                    <li>Agenda e compromissos</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Finalidade do Uso */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Finalidade do Uso dos Dados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-muted-foreground">Utilizamos seus dados pessoais para:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Fornecer e manter os serviços do VextriaHub</li>
                  <li>Processar pagamentos e gerenciar assinaturas</li>
                  <li>Comunicar sobre atualizações e novidades</li>
                  <li>Oferecer suporte técnico e atendimento ao cliente</li>
                  <li>Melhorar nossos serviços e desenvolver novas funcionalidades</li>
                  <li>Cumprir obrigações legais e regulamentares</li>
                  <li>Prevenir fraudes e garantir a segurança da plataforma</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Compartilhamento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Compartilhamento de Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                A VextriaHub não vende, aluga ou compartilha seus dados pessoais com terceiros, exceto nas seguintes situações:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Com seu consentimento explícito</li>
                <li>Para cumprir obrigações legais ou ordem judicial</li>
                <li>Com prestadores de serviços essenciais (hospedagem, pagamento, etc.)</li>
                <li>Em caso de fusão, aquisição ou venda de ativos da empresa</li>
              </ul>
              <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Importante:</strong> Todos os terceiros que têm acesso aos seus dados são obrigados a manter 
                  o mesmo nível de proteção e confidencialidade.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Segurança dos Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Implementamos medidas técnicas e organizacionais adequadas para proteger seus dados pessoais:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Medidas Técnicas:</h4>
                  <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1 ml-4">
                    <li>Criptografia de dados em trânsito e em repouso</li>
                    <li>Autenticação de dois fatores</li>
                    <li>Monitoramento contínuo de segurança</li>
                    <li>Backups regulares e seguros</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Medidas Organizacionais:</h4>
                  <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1 ml-4">
                    <li>Treinamento regular da equipe</li>
                    <li>Controle de acesso baseado em funções</li>
                    <li>Políticas internas de segurança</li>
                    <li>Auditorias periódicas</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Direitos do Usuário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Seus Direitos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                De acordo com a LGPD, você possui os seguintes direitos sobre seus dados pessoais:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1 ml-4">
                    <li><strong>Acesso:</strong> Saber quais dados temos sobre você</li>
                    <li><strong>Correção:</strong> Corrigir dados incompletos ou incorretos</li>
                    <li><strong>Exclusão:</strong> Solicitar a remoção de seus dados</li>
                    <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1 ml-4">
                    <li><strong>Oposição:</strong> Opor-se ao tratamento de seus dados</li>
                    <li><strong>Limitação:</strong> Limitar o uso de seus dados</li>
                    <li><strong>Revogação:</strong> Retirar seu consentimento a qualquer momento</li>
                    <li><strong>Informação:</strong> Ser informado sobre o uso de seus dados</li>
                  </ul>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Para exercer qualquer um desses direitos, entre em contato conosco através do e-mail: 
                  <strong>privacidade@vextriahub.com</strong>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Retenção de Dados */}
          <Card>
            <CardHeader>
              <CardTitle>Retenção de Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Mantemos seus dados pessoais apenas pelo tempo necessário para cumprir as finalidades descritas nesta política, 
                respeitando os prazos legais de retenção aplicáveis à atividade jurídica.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Dados de conta: Enquanto a conta estiver ativa</li>
                <li>Dados de processos: Conforme exigências legais (mínimo 5 anos)</li>
                <li>Logs de acesso: 6 meses</li>
                <li>Dados de pagamento: Conforme legislação fiscal</li>
              </ul>
            </CardContent>
          </Card>

          {/* Cookies */}
          <Card>
            <CardHeader>
              <CardTitle>Cookies e Tecnologias Similares</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Utilizamos cookies e tecnologias similares para melhorar sua experiência, analisar o uso do software e 
                personalizar conteúdo. Você pode gerenciar suas preferências de cookies nas configurações do seu navegador.
              </p>
            </CardContent>
          </Card>

          {/* Alterações */}
          <Card>
            <CardHeader>
              <CardTitle>Alterações nesta Política</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Esta Política de Privacidade pode ser atualizada periodicamente. Notificaremos sobre mudanças significativas 
                através do e-mail cadastrado ou por meio de avisos no software. Recomendamos que você revise esta política regularmente.
              </p>
            </CardContent>
          </Card>

          {/* Contato */}
          <Card>
            <CardHeader>
              <CardTitle>Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Se você tiver dúvidas sobre esta Política de Privacidade ou sobre o tratamento de seus dados pessoais, 
                entre em contato conosco:
              </p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="space-y-2 text-sm">
                  <p><strong>E-mail:</strong> privacidade@vextriahub.com</p>
                  <p><strong>Telefone:</strong> (11) 9999-9999</p>
                  <p><strong>Endereço:</strong> São Paulo, SP - Brasil</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PoliticaPrivacidade;
