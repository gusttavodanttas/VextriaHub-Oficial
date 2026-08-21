import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Shield, UserPlus } from "lucide-react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from '@/integrations/supabase/client';
import { useDefaultBrandOnPublicPage } from '@/lib/brandColor';
import { formatCpfCnpj, onlyDigits, isValidCpfCnpj } from "@/lib/document";
import { formatPhoneInput } from "@/utils/formatters";

const Register = () => {
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plano') || searchParams.get('plan');
  const selectedPlan = planParam || 'BASIC';
  const isInvite = searchParams.get('convite') === '1';
  const inviteToken = searchParams.get('token') || '';

  const [formData, setFormData] = useState({
    name: "",
    email: searchParams.get('email') || "",
    password: "",
    confirmPassword: "",
    oab: "",
    state: "",
    cpfCnpj: "",
    phone: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [planData, setPlanData] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { register } = useAuth();

  useDefaultBrandOnPublicPage();

  // Buscar dados do plano selecionado
  useEffect(() => {
    const fetchPlanData = async () => {
      const { data, error } = await supabase
        .from('plan_configs')
        .select('*')
        .eq('plan_type', selectedPlan)
        .maybeSingle();
      
      if (data) {
        setPlanData(data);
      }
    };
    
    fetchPlanData();
  }, [selectedPlan]);

  const brasileirianStates = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro no cadastro",
        description: "Nome completo é obrigatório",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.email.trim()) {
      toast({
        title: "Erro no cadastro", 
        description: "E-mail é obrigatório",
        variant: "destructive",
      });
      return false;
    }

    if (!isInvite && !formData.cpfCnpj.trim()) {
      toast({
        title: "Erro no cadastro",
        description: "CPF/CNPJ é obrigatório",
        variant: "destructive",
      });
      return false;
    }

    if (!isInvite) {
      const doc = onlyDigits(formData.cpfCnpj);
      const tipo = doc.length > 11 ? "juridica" : "fisica";
      if (!isValidCpfCnpj(formData.cpfCnpj, tipo)) {
        toast({
          title: "Erro no cadastro",
          description: "CPF/CNPJ inválido. Confira os números digitados.",
          variant: "destructive",
        });
        return false;
      }
    }

    if (formData.password.length < 8) {
      toast({
        title: "Erro no cadastro",
        description: "Senha deve ter pelo menos 8 caracteres",
        variant: "destructive",
      });
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Erro no cadastro",
        description: "Confirmação de senha não confere",
        variant: "destructive",
      });
      return false;
    }

    if (!acceptTerms) {
      toast({
        title: "Erro no cadastro",
        description: "Você deve aceitar os termos de uso",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      // Registration process
      
      // Marcar no localStorage que estamos em processo de checkout para evitar redirecionamento
      localStorage.setItem('checkout_in_progress', 'true');
      
      const { error } = await register(formData.email, formData.password, formData.name, {
        cpf_cnpj: formData.cpfCnpj.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        oab: formData.oab.trim() || undefined,
        oab_uf: formData.state || undefined,
      });

      if (error) {
        console.error('Register error:', error);
        toast({
          title: "Erro no cadastro",
          description: error.message || "Ocorreu um erro durante o cadastro",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Starting checkout

      // Convite: auto-confirma o e-mail (só se existe convite pendente pro e-mail)
      // para permitir o login automático abaixo sem clicar no e-mail de confirmação.
      if (isInvite && inviteToken) {
        try {
          await supabase.rpc('confirm_invited_user' as never, { p_email: formData.email.trim(), p_token: inviteToken } as never);
        } catch (err) {
          console.error('confirm_invited_user failed:', err);
        }
      }

      // Fazer login automático após o registro bem-sucedido
      // Automatic login
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (loginError) {
        console.error('Automatic login failed after register:', loginError);
        toast({
          title: "Cadastro realizado!",
          description: "Enviamos um e-mail de confirmação — confirme para entrar.",
        });
        setTimeout(() => {
          navigate("/login");
        }, 3500);
        setIsLoading(false);
        return;
      }

      // Login success
      
      // Convidado: entra num escritório que já paga → sem plano/checkout.
      // O ensure_office_for_user (no login) já vincula ao escritório do convite.
      if (isInvite) {
        localStorage.removeItem('checkout_in_progress');
        toast({ title: "Cadastro concluído!", description: "Bem-vindo(a) à equipe." });
        navigate("/dashboard");
        setIsLoading(false);
        return;
      }

      // Cadastro normal: garante o escritório no banco (idempotente) e, se o cadastro veio
      // de um link de plano, registra o plano escolhido e leva direto ao pagamento.
      // Planos sem trial (ex.: Básico mensal) já entram como "pendente" → o portão de
      // acesso exige o pagamento. Cadastro orgânico (sem ?plano=) mantém os 7 dias de teste.
      let planOutcome: string | null = null;
      try {
        await supabase.rpc('ensure_office_for_user' as never);
        if (planParam) {
          const { data } = await supabase.rpc('apply_signup_plan' as never, { p_plan_type: planParam } as never);
          planOutcome = (data as string) ?? null;
        }
      } catch (setupErr) {
        console.error('signup plan setup:', setupErr);
      }
      localStorage.removeItem('checkout_in_progress');
      if (planParam && planOutcome === 'pendente') {
        // Plano sem trial (ex.: Básico mensal) → precisa pagar para acessar.
        toast({ title: "Cadastro concluído!", description: "Escolha a forma de pagamento para ativar seu acesso." });
        navigate(`/pagamento?plano=${encodeURIComponent(planParam)}`);
      } else {
        // Trial ativo (7 ou 30 dias) ou cadastro orgânico → começa a usar; paga quando quiser.
        toast({ title: "Cadastro concluído!", description: "Seu período de teste começou. Bem-vindo(a)!" });
        navigate("/dashboard");
      }
      setIsLoading(false);
      return;

    } catch (error) {
      console.error('Unexpected error during register flow:', error);
      
      localStorage.removeItem('checkout_in_progress');
      
      toast({
        title: "Erro no cadastro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reflete o plano do link: Básico (sem trial) muda o texto; o ciclo ajusta o sufixo do preço.
  const trialDays = planParam ? (planData?.trial_days ?? 7) : 7;
  const semTrial = trialDays === 0;
  const cycleSuffix = planData?.cycle === 'YEARLY' ? '/ano'
    : planData?.cycle === 'SEMIANNUALLY' ? '/semestre'
    : planData?.cycle === 'QUARTERLY' ? '/trimestre' : '/mês';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo/Brand */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src="/vextria-logo.svg" 
              alt="VextriaHub" 
              className="h-16 w-auto"
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Assistente Jurídico Inteligente
          </p>
        </div>

        {/* Register Card */}
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center flex items-center justify-center gap-2">
              <UserPlus className="h-5 w-5" />
              {isInvite ? "Entrar na equipe" : semTrial ? "Criar sua conta" : "Começar Teste Grátis"}
            </CardTitle>
            <CardDescription className="text-center">
              {isInvite ? "Crie seu acesso — você entra direto no escritório" : semTrial ? "Ativação imediata • Cancele quando quiser" : `${trialDays} dias grátis • Sem compromisso • Cancele quando quiser`}
            </CardDescription>
            {!isInvite && planData && (
              <div className="text-center">
                <Badge variant="outline" className="text-sm">
                  Plano {planData.plan_name} - R$ {(planData.price_cents / 100).toFixed(2)}{cycleSuffix}
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nome Field */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome completo"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  required
                  className="w-full"
                />
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  required
                  disabled={isInvite}
                  className="w-full"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    required
                    className="w-full pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Digite a senha novamente"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    required
                    className="w-full pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {!isInvite && (<>
              {/* CPF/CNPJ Field */}
              <div className="space-y-2">
                <Label htmlFor="cpfCnpj">CPF/CNPJ *</Label>
                <Input
                  id="cpfCnpj"
                  type="text"
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  value={formData.cpfCnpj}
                  onChange={(e) => handleInputChange("cpfCnpj", formatCpfCnpj(e.target.value))}
                  required
                  className="w-full"
                />
              </div>

              {/* Phone Field */}
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (opcional)</Label>
                <Input
                  id="phone"
                  type="text"
                  inputMode="numeric"
                  maxLength={15}
                  placeholder="(11) 99999-9999"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", formatPhoneInput(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* OAB Field */}
              <div className="space-y-2">
                <Label htmlFor="oab">Número da OAB (opcional)</Label>
                <Input
                  id="oab"
                  type="text"
                  placeholder="Ex: 123456"
                  value={formData.oab}
                  onChange={(e) => handleInputChange("oab", e.target.value)}
                  className="w-full"
                />
              </div>

              {/* State Field */}
              <div className="space-y-2">
                <Label htmlFor="state">Estado de atuação (opcional)</Label>
                <Select onValueChange={(value) => handleInputChange("state", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione seu estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {brasileirianStates.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              </>)}

              {/* Terms Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                />
                <Label htmlFor="terms" className="text-sm">
                  Aceito os{" "}
                  <a href="#" className="text-primary hover:underline">
                    termos de uso
                  </a>{" "}
                  e{" "}
                  <a href="#" className="text-primary hover:underline">
                    política de privacidade
                  </a>
                </Label>
              </div>

              {/* Register Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Processando..." : isInvite ? "Criar minha conta" : planParam ? "Criar conta e continuar para pagamento" : "Criar conta e começar"}
              </Button>

              {/* Login Link */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Já tem uma conta?{" "}
                  <Link to="/login" className="text-primary hover:underline font-medium">
                    Faça login
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>Seus dados estão protegidos</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} VextriaHub. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
