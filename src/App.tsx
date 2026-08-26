
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { captureError } from "@/lib/monitoring";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PaymentRequiredModal } from "@/components/Auth/PaymentRequiredModal";
import { PrivateRoute } from "@/components/Auth/PrivateRoute";
import { AppLayout } from "@/components/Layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary/ErrorBoundary";
import { InstallPrompt } from "@/components/PWA/InstallPrompt";
import { usePerformanceMonitoring } from "@/hooks/usePerformanceMonitoring";
import { usePWA } from "@/hooks/usePWA";
import { useState, useEffect, lazy, Suspense } from "react";

// Code-splitting: cada página vira um chunk próprio, carregado sob demanda
const Landing = lazy(() => import("./pages/Landing"));
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const RedefinirSenha = lazy(() => import("./pages/RedefinirSenha"));
const Processos = lazy(() => import("./pages/Processos"));
const Atendimentos = lazy(() => import("./pages/Atendimentos"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Crm = lazy(() => import("./pages/Crm"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Tarefas = lazy(() => import("./pages/Tarefas"));
const Prazos = lazy(() => import("./pages/Prazos"));
const Publicacoes = lazy(() => import("./pages/Publicacoes"));
const Consultivo = lazy(() => import("./pages/Consultivo"));
const Graficos = lazy(() => import("./pages/Graficos"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Metas = lazy(() => import("./pages/Metas"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Admin = lazy(() => import("./pages/Admin"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Audiencias = lazy(() => import("./pages/Audiencias"));
const Equipe = lazy(() => import("./pages/Equipe"));
const EquipeDetalhe = lazy(() => import("./pages/EquipeDetalhe"));
const Escritorio = lazy(() => import("./pages/Escritorio"));
const Timesheet = lazy(() => import("./pages/Timesheet"));
const Correspondentes = lazy(() => import("./pages/Correspondentes"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const GoogleCallback = lazy(() => import("./pages/auth/GoogleCallback"));
const Pagamento = lazy(() => import("./pages/Pagamento"));
const Lixeira = lazy(() => import("./pages/Lixeira"));

const queryClient = new QueryClient({
  // Observabilidade: reporta TODA falha de query/mutation ao Sentry num lugar só —
  // antes ~30 catch só faziam console.error (invisível em prod). O toast local nos
  // hooks continua; isto só ADICIONA o reporte central. (v12) [[vextriahub-audit-ago2026]]
  queryCache: new QueryCache({
    onError: (error, query) => captureError(error, { scope: "query", queryKey: query.queryKey }),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => captureError(error, { scope: "mutation", mutationKey: mutation.options.mutationKey }),
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
      retry: (failureCount, error) => {
        if (failureCount < 3) return true;
        return false;
      },
    },
  },
});

// Fallback exibido enquanto o chunk da página é baixado
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh] w-full">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      <p className="text-xs text-muted-foreground font-medium">Carregando…</p>
    </div>
  </div>
);

const AppWithRouter = () => {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const { isInstallable } = usePWA();
  const { trackInteraction } = usePerformanceMonitoring();

  useEffect(() => {
    // Show install prompt after delay
    if (isInstallable) {
      const timer = setTimeout(() => {
        setShowInstallPrompt(true);
      }, 30000); // Show after 30 seconds

      return () => clearTimeout(timer);
    }
  }, [isInstallable]);

  // Track global interactions
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const element = target.tagName.toLowerCase();
      trackInteraction('click', element);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [trackInteraction]);

  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />
        <Route path="/register" element={<Register />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <AppLayout>
                <Index />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/processos/importar"
          element={<Navigate to="/processos?tab=novo" replace />}
        />
        <Route
          path="/processos"
          element={
            <PrivateRoute>
              <AppLayout>
                <Processos />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/atendimentos"
          element={
            <PrivateRoute>
              <AppLayout>
                <Atendimentos />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/correspondentes"
          element={
            <PrivateRoute>
              <AppLayout>
                <Correspondentes />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/clientes"
          element={
            <PrivateRoute>
              <AppLayout>
                <Clientes />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/crm"
          element={
            <PrivateRoute>
              <AppLayout>
                <Crm />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/agenda"
          element={
            <PrivateRoute>
              <AppLayout>
                <Agenda />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/audiencias"
          element={
            <PrivateRoute>
              <AppLayout>
                <Audiencias />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/equipe"
          element={
            <PrivateRoute>
              <AppLayout>
                <Equipe />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/equipe/:teamId"
          element={
            <PrivateRoute>
              <AppLayout>
                <EquipeDetalhe />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/tarefas"
          element={
            <PrivateRoute>
              <AppLayout>
                <Tarefas />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/timesheet"
          element={
            <PrivateRoute>
              <AppLayout>
                <Timesheet />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/prazos"
          element={
            <PrivateRoute>
              <AppLayout>
                <Prazos />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/publicacoes"
          element={
            <PrivateRoute>
              <AppLayout>
                <Publicacoes />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/consultivo"
          element={
            <PrivateRoute>
              <AppLayout>
                <Consultivo />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/graficos"
          element={
            <PrivateRoute>
              <AppLayout>
                <Graficos />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/financeiro"
          element={
            <PrivateRoute>
              <AppLayout>
                <Financeiro />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/metas"
          element={
            <PrivateRoute>
              <AppLayout>
                <Metas />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/notificacoes"
          element={
            <PrivateRoute>
              <AppLayout>
                <Notificacoes />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/configuracoes"
          element={
            <PrivateRoute>
              <AppLayout>
                <Configuracoes />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/perfil"
          element={
            <PrivateRoute>
              <AppLayout>
                <Perfil />
              </AppLayout>
            </PrivateRoute>
          }
        />
        {/* canManageOffice deixa o admin do escritório entrar SÓ nas Solicitações de
            Exclusão do próprio escritório (a página Admin trava as abas de plataforma
            em isMainSuperAdmin; a RLS escopa por office_id). (v11) */}
        <Route path="/admin" element={
          <PrivateRoute requireAnyPermissions={['canViewAdmin', 'canManageOffice']}>
            <AppLayout>
              <Admin />
            </AppLayout>
          </PrivateRoute>
        } />
        <Route path="/super-admin" element={
          <PrivateRoute requireRole="super_admin">
            <AppLayout>
              <SuperAdmin />
            </AppLayout>
          </PrivateRoute>
        } />
        <Route path="/lixeira" element={
          <PrivateRoute requireRole="super_admin">
            <AppLayout>
              <Lixeira />
            </AppLayout>
          </PrivateRoute>
        } />
        <Route
          path="/escritorio"
          element={
            <PrivateRoute requirePermission="canManageOffice">
              <AppLayout>
                <Escritorio />
              </AppLayout>
            </PrivateRoute>
          }
        />
        <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />
        <Route path="/pagamento" element={<Pagamento />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>

      {showInstallPrompt && (
        <InstallPrompt onClose={() => setShowInstallPrompt(false)} />
      )}
      <PaymentRequiredModal />
    </AuthProvider>
  );
};

const AppContent = () => {
  return (
    <BrowserRouter>
      <AppWithRouter />
    </BrowserRouter>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
