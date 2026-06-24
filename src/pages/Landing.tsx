import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight,
  CheckCircle,
  Star,
  Zap,
  Clock,
  Target,
  Shield,
  Users,
  BarChart3,
  FileText,
  Calendar,
  Menu
} from "lucide-react";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Se já estiver autenticado, redirecionar para o dashboard
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const benefits = [
    {
      icon: Clock,
      title: "Nunca mais perca prazos importantes",
      description: "Acabe com o estresse de controlar prazos em planilhas confusas. O VextriaHub organiza tudo automaticamente."
    },
    {
      icon: Target,
      title: "Centralize toda sua rotina jurídica",
      description: "Processos, clientes, prazos e tarefas em um só lugar. Simplicidade que funciona de verdade."
    },
    {
      icon: Zap,
      title: "Ganhe tempo e organização",
      description: "Painel visual e intuitivo que mostra exatamente o que precisa ser feito, sem complicação."
    },
    {
      icon: Shield,
      title: "Tecnologia fácil para advogados",
      description: "Criado por quem entende advocacia. Não precisa ser 'bom de sistemas' para usar."
    }
  ];

  const features = [
    {
      icon: BarChart3,
      title: "Painel Visual de Processos",
      description: "Veja o status de todos os seus processos em uma tela organizada e clara"
    },
    {
      icon: Calendar,
      title: "Gestão de Prazos e Tarefas",
      description: "Controle diário e semanal do que precisa ser feito, com alertas automáticos"
    },
    {
      icon: Users,
      title: "Cadastro de Atendimentos",
      description: "Acompanhe cada caso e cliente com histórico completo e organizado"
    },
    {
      icon: FileText,
      title: "Módulo Financeiro",
      description: "Controle de honorários e pagamentos (disponível nos planos Avançado e Premium)"
    },
    {
      icon: Target,
      title: "Metas e Produtividade",
      description: "Acompanhe seu desempenho e estabeleça objetivos (em breve no plano Premium)"
    },
    {
      icon: Zap,
      title: "Inteligência Artificial",
      description: "Automações simples para otimizar sua rotina (funcionalidade futura)"
    }
  ];

  const plans = [
    {
      name: "Básico",
      price: "R$ 47",
      period: "/mês",
      description: "Ideal para advogados autônomos",
      users: "1 usuário",
      processes: "até 30 processos",
      features: [
        "Painel de processos",
        "Gestão de prazos",
        "Cadastro de clientes",
        "Suporte padrão"
      ],
      financial: false,
      goals: false,
      ai: false,
      popular: false,
      badge: ""
    },
    {
      name: "Intermediário", 
      price: "R$ 97",
      period: "/mês",
      description: "Para pequenos escritórios",
      users: "até 3 usuários",
      processes: "até 100 processos",
      features: [
        "Tudo do Básico",
        "Múltiplos usuários",
        "Relatórios básicos",
        "Suporte padrão"
      ],
      financial: false,
      goals: false,
      ai: false,
      popular: false,
      badge: ""
    },
    {
      name: "Avançado",
      price: "R$ 197",
      period: "/mês", 
      description: "Máxima organização",
      users: "até 5 usuários",
      processes: "até 300 processos",
      features: [
        "Tudo do Intermediário",
        "Módulo financeiro completo",
        "Relatórios avançados",
        "Suporte prioritário"
      ],
      financial: true,
      goals: false,
      ai: false,
      popular: true,
      badge: "Mais Vendido"
    },
    {
      name: "Premium",
      price: "R$ 397",
      period: "/mês",
      description: "Performance máxima",
      users: "até 10 usuários",
      processes: "processos ilimitados",
      features: [
        "Tudo do Avançado",
        "Módulo de metas",
        "IA (quando ativada)",
        "Suporte VIP dedicado"
      ],
      financial: true,
      goals: true,
      ai: true,
      popular: false,
      badge: "Maior Performance"
    }
  ];

  const testimonials = [
    {
      name: "Dr. Carlos Silva",
      role: "Advogado Autônomo - Direito Civil",
      content: "O VextriaHub transformou minha rotina — finalmente estou com tudo organizado e sem estresse. Acabou a correria com prazos!",
      rating: 5
    },
    {
      name: "Dra. Marina Costa",
      role: "Escritório Costa & Associados",
      content: "Simplesmente perfeito! Sistema leve, fácil de usar e que realmente resolve os problemas do dia a dia. Minha equipe adorou.",
      rating: 5
    },
    {
      name: "Dr. Roberto Santos",
      role: "Advogado Trabalhista",
      content: "Finalmente um software que não precisa de manual. Em 5 minutos já estava usando. O módulo financeiro é excelente!",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl font-bold tracking-tight text-primary">VextriaHub</span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Mobile Actions */}
            <div className="flex md:hidden items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-sm font-medium"
                onClick={() => navigate("/login")}
              >
                Entrar
              </Button>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] border-l border-border bg-card/95 backdrop-blur-lg">
                  <SheetHeader>
                    <SheetTitle className="text-left text-2xl font-bold text-primary">VextriaHub</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-6 mt-10">
                    <a href="#beneficios" className="text-lg font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Benefícios
                    </a>
                    <a href="#funcionalidades" className="text-lg font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Funcionalidades
                    </a>
                    <a href="#planos" className="text-lg font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Planos
                    </a>
                    <Button variant="outline" size="lg" className="w-full justify-start" onClick={() => window.open('mailto:contato@vextriahub.com', '_blank')}>
                      Contato
                    </Button>
                    <hr className="border-border" />
                    <Button size="lg" className="w-full bg-primary hover:bg-primary/90" onClick={() => navigate("/cadastro?plan=basico")}>
                      Começar Agora
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <div className="flex items-center gap-6 mr-4 border-r border-border pr-6">
                <a href="#beneficios" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Benefícios
                </a>
                <a href="#funcionalidades" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Funcionalidades
                </a>
                <a href="#planos" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Planos
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="font-medium">
                  Entrar
                </Button>
                <Button onClick={() => navigate("/cadastro?plan=basico")} size="sm" className="bg-primary hover:bg-primary/90 font-semibold shadow-lg shadow-primary/20">
                  Experimentar Grátis
                </Button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-6" variant="secondary">
            ⚖️ Software Jurídico Completo
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Pare de perder prazos e organize sua advocacia de vez
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            O VextriaHub centraliza processos, prazos e clientes em um sistema simples e eficiente. 
            Criado especialmente para advogados que querem organização sem complicação.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Button size="lg" className="text-lg px-8 bg-primary hover:bg-primary/90" onClick={() => navigate("/cadastro?plan=basico")}>
              Testar Grátis por 7 Dias
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8" onClick={() => document.getElementById('funcionalidades')?.scrollIntoView({ behavior: 'smooth' })}>
              Ver Demonstração
            </Button>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>7 dias grátis</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Sem compromisso</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Setup em 5 minutos</span>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="beneficios" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Problemas reais que o VextriaHub resolve
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Desenvolvido por quem entende a rotina do advogado e sabe exatamente onde estão os problemas
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-12">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="funcionalidades" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Funcionalidades que fazem a diferença
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tudo que você precisa para organizar sua advocacia em um só sistema
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-border hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Escolha o plano ideal para você
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Comece com 7 dias grátis em qualquer plano. Mude de plano quando quiser, sem complicação.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan, index) => (
              <Card key={index} className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : 'border-border'}`}>
                {plan.badge && (
                  <Badge className={`absolute -top-3 left-1/2 transform -translate-x-1/2 ${plan.popular ? 'bg-primary' : 'bg-orange-500'}`}>
                    {plan.badge}
                  </Badge>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <CardDescription className="text-base">
                    {plan.description}
                  </CardDescription>
                  <div className="text-sm text-muted-foreground">
                    <div>{plan.users}</div>
                    <div>{plan.processes}</div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                    <li className="flex items-center gap-2 text-sm">
                      {plan.financial ? (
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted shrink-0" />
                      )}
                      <span className={plan.financial ? '' : 'text-muted-foreground'}>Módulo Financeiro</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      {plan.goals ? (
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted shrink-0" />
                      )}
                      <span className={plan.goals ? '' : 'text-muted-foreground'}>Metas</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      {plan.ai ? (
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted shrink-0" />
                      )}
                      <span className={plan.ai ? '' : 'text-muted-foreground'}>IA</span>
                    </li>
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => {
                      const slugMap: Record<string, string> = {
                        "Básico": "basico",
                        "Intermediário": "intermediario",
                        "Avançado": "avancado",
                        "Premium": "premium"
                      };
                      navigate(`/cadastro?plan=${slugMap[plan.name] || plan.name.toLowerCase()}`);
                    }}
                  >
                    Testar Grátis
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Advogados que já transformaram sua rotina
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Veja como o VextriaHub está ajudando profissionais como você a ter mais organização e tranquilidade
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-border">
                <CardContent className="pt-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-500 fill-current" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4 italic">
                    "{testimonial.content}"
                  </p>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Comece agora e transforme sua advocacia
            </h2>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              O VextriaHub é um sistema leve e objetivo, criado especificamente para quem entende que a advocacia precisa de organização real, não de complicação. 
              <br /><br />
              <strong>7 dias grátis, sem compromisso.</strong> Se não gostar, cancele com um clique.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button size="lg" className="text-lg px-12 py-4 bg-primary hover:bg-primary/90" onClick={() => navigate("/cadastro?plan=basico")}>
                Começar Agora com 7 Dias Grátis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span>Dados 100% seguros</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                <span>Ativo em 5 minutos</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Suporte brasileiro</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <span className="text-xl font-bold">VextriaHub</span>
              </div>
              <p className="text-muted-foreground mb-4">
                Software jurídico completo para advogados autônomos e pequenos escritórios
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a></li>
                <li><a href="#planos" className="hover:text-foreground transition-colors">Planos</a></li>
                <li><a href="#planos" className="hover:text-foreground transition-colors">Período Trial</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#beneficios" className="hover:text-foreground transition-colors">Sobre</a></li>
                <li><a href="mailto:contato@vextriahub.com" className="hover:text-foreground transition-colors">Contato</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Suporte</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="mailto:contato@vextriahub.com" className="hover:text-foreground transition-colors">Central de Ajuda</a></li>
                <li><a href="/politica-privacidade" className="hover:text-foreground transition-colors">Política de Privacidade</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
            <p>© 2025 VextriaHub. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
