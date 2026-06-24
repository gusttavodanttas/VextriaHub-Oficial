
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [error, setError] = useState('');
  const { login, resendConfirmation, loginAsSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { error } = await login(email, password);
    
    if (error) {
      console.error('Login error:', error);
      setError(error.message || 'Erro ao fazer login');
    } else {
      navigate('/dashboard', { replace: true });
    }
    
    setIsLoading(false);
  };

  const handleSuperAdminLogin = async () => {
    if (!email || !password) {
      setError('Por favor, preencha email e senha primeiro');
      return;
    }

    setIsLoading(true);
    setError('');

    const { error } = await loginAsSuperAdmin(email, password);
    
    if (error) {
      console.error('Super Admin login error:', error);
      setError(error.message || 'Erro ao fazer login como Super Admin');
    } else {
      navigate('/dashboard', { replace: true });
    }
    
    setIsLoading(false);
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Por favor, digite seu email primeiro');
      return;
    }

    setIsResendingEmail(true);
    setError('');

    const { error } = await resendConfirmation(email);
    
    if (error) {
      console.error('Resend confirmation error:', error);
      setError(error.message || 'Erro ao reenviar email de confirmação');
    } else {
      toast.success('Email de confirmação reenviado com sucesso!');
    }
    
    setIsResendingEmail(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
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

        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              Bem-vindo de volta
            </CardTitle>
            <CardDescription className="text-center">
              Entre com suas credenciais para acessar sua conta
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <Separator />

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResendConfirmation}
              disabled={isResendingEmail || !email}
            >
              <Mail className="mr-2 h-4 w-4" />
              {isResendingEmail ? 'Reenviando...' : 'Reenviar Email de Confirmação'}
            </Button>

            {email === 'contato@vextriahub.com.br' && (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleSuperAdminLogin}
                disabled={isLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Login Super Admin (Bypass)
              </Button>
            )}
          </div>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Não tem uma conta? </span>
            <Link 
              to="/register" 
              className="text-primary hover:underline font-medium"
            >
              Cadastre-se
            </Link>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default LoginForm;
