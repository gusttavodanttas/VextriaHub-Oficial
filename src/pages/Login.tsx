import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Shield } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    toast
  } = useToast();
  const {
    login,
    resendConfirmation,
    isAuthenticated,
    isLoading: authLoading,
    session,
    user,
    isSuperAdmin,
    getRedirectPath
  } = useAuth();

  // Se já estiver logado, redirecionar para dashboard
  useEffect(() => {
    if (isAuthenticated && !loginInProgress && session) {
      console.log('Already authenticated, redirecting...');
      
      // Verificar se estamos em processo de checkout para evitar redirecionamento
      const checkoutInProgress = localStorage.getItem('checkout_in_progress');
      if (checkoutInProgress === 'true') {
        console.log('🚫 Checkout in progress, skipping auto redirect');
        return;
      }
      
      // Verificar se temos parâmetro de registro recente
      const isNewRegistration = location.search.includes('new-registration=true');
      if (isNewRegistration) {
        console.log('🚫 New registration, skipping auto redirect');
        return;
      }
      
      const from = location.state?.from?.pathname;
      const isAdminAccess = location.state?.adminAccess;
      console.log('🔐 Login redirect info:', {
        from,
        isAdminAccess,
        userRole: user?.role,
        userEmail: user?.email
      });

      // Se tem uma página específica solicitada, usar ela
      if (from && from !== "/" && from !== "/login") {
        console.log('🔄 Redirecting to requested page:', from);
        navigate(from, {
          replace: true
        });
        return;
      }

      // Caso contrário, usar redirecionamento automático baseado no role
      const userEmail = user?.email || session?.user?.email;
      const redirectPath = getRedirectPath(user?.role, userEmail);
      console.log('🔄 Auto-redirecting based on role to:', redirectPath);
      navigate(redirectPath, {
        replace: true
      });
    }
  }, [isAuthenticated, navigate, location, loginInProgress, session, user, getRedirectPath]);

  // Monitorar autenticação após login
  useEffect(() => {
    if (loginInProgress && isAuthenticated && session) {
      console.log('Login completed, authentication confirmed, redirecting...');
      const isAdminAccess = location.state?.adminAccess;
      const from = location.state?.from?.pathname;
      console.log('🔐 Post-login redirect info:', {
        from,
        isAdminAccess,
        userRole: user?.role,
        isSuperAdmin
      });
      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo ao VextriaHub"
      });

      // Aguardar um pouco para garantir que a sessão está estabelecida
      const timer = setTimeout(() => {
        const from = location.state?.from?.pathname;

        // Se tem uma página específica solicitada, usar ela
        if (from && from !== "/" && from !== "/login") {
          console.log('🔄 Redirecting to requested page after login:', from);
          navigate(from, {
            replace: true
          });
          setLoginInProgress(false);
          return;
        }

        // Caso contrário, usar redirecionamento automático baseado no role
        const userEmail = user?.email || session?.user?.email;
        const redirectPath = getRedirectPath(user?.role, userEmail);
        console.log('🔄 Auto-redirecting after login based on role to:', redirectPath);
        navigate(redirectPath, {
          replace: true
        });
        setLoginInProgress(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loginInProgress, isAuthenticated, session, navigate, location, toast, user, getRedirectPath]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevenir múltiplas submissões
    if (isSubmitting || loginInProgress) {
      console.log('🚫 Login already in progress, ignoring submit');
      return;
    }
    if (!email || !password) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive"
      });
      return;
    }
    try {
      setIsSubmitting(true);
      setLoginInProgress(true);
      setIsLoading(true);
      console.log('🔐 Starting login process for:', email);
      const {
        error
      } = await login(email, password);
      if (error) {
        console.error('❌ Login failed:', error);
        toast({
          title: "Erro no login",
          description: error.message || "Credenciais inválidas. Tente novamente.",
          variant: "destructive"
        });
        setLoginInProgress(false);
        return;
      }
      console.log('✅ Login initiated successfully');
      toast({
        title: "Login realizado!",
        description: "Redirecionando..."
      });

      // O redirecionamento será feito pelos useEffect que monitoram a autenticação
    } catch (error) {
      console.error('❌ Unexpected error during login:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro. Tente novamente.",
        variant: "destructive"
      });
      setLoginInProgress(false);
    } finally {
      setIsLoading(false);
      // Aguardar um pouco antes de permitir nova tentativa
      setTimeout(() => {
        setIsSubmitting(false);
      }, 2000);
    }
  };
  return <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo/Brand */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img src="/vextria-logo.svg" alt="VextriaHub" className="h-16 w-auto" />
          </div>
          <p className="text-muted-foreground text-sm">Assistente Jurídico Inteligente.</p>
        </div>

        {/* Login Card */}
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Entrar</CardTitle>
            <CardDescription className="text-center">Digite suas credenciais para acessar o sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="w-full" />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="Digite sua senha" value={password} onChange={e => setPassword(e.target.value)} required className="w-full pr-10" />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>

              {/* Login Button */}
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading || isSubmitting || loginInProgress}>
              {isLoading || isSubmitting ? <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isSubmitting ? 'Fazendo login...' : 'Carregando...'}
                </> : 'Entrar'}
            </Button>

              {/* Forgot Password */}
              <div className="text-center">
                <Button type="button" variant="link" className="text-sm text-muted-foreground" onClick={() => {
                toast({
                  title: "Funcionalidade em breve",
                  description: "A recuperação de senha será implementada em breve"
                });
              }}>
                  Esqueceu sua senha?
                </Button>
              </div>

              {/* Register Link */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Não tem uma conta?{" "}
                  <Button type="button" variant="link" className="text-sm text-primary p-0 h-auto font-medium" onClick={() => navigate("/cadastro")}>
                    Cadastre-se grátis
                  </Button>
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
            © 2025 VextriaHub. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>;
};
export default Login;
