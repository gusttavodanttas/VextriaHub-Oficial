
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
const Etiquetas = lazy(() => import("./pages/Etiquetas"));
const Notificacoes = lazy(() => import("./pages/Notificacoes"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Admin = lazy(() => import("./pages/Admin"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const SystemAdmin = lazy(() => import("./pages/SystemAdmin"));
const SystemSubscriptions = lazy(() => import("./pages/SystemSubscriptions"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Audiencias = lazy(() => import("./pages/Audiencias"));
const Equipe = lazy(() => import("./pages/Equipe"));
const EquipeDetalhe = lazy(() => import("./pages/EquipeDetalhe"));
const Escritorio = lazy(() => import("./pages/Escritorio"));
const Timesheet = lazy(() => import("./pages/Timesheet"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const Pagamento = lazy(() => import("./pages/Pagamento"));
const Obrigado = lazy(() => import("./pages/Obrigado"));
const Lixeira = lazy(() => import("./pages/Lixeira"));

const queryClient = new QueryClient({
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
          path="/etiquetas"
          element={
            <PrivateRoute>
              <AppLayout>
                <Etiquetas />
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
        <Route path="/admin" element={
          <PrivateRoute requirePermission="canViewAdmin">
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
        <Route path="/system-admin" element={
          <PrivateRoute requireRole="super_admin">
            <SystemAdmin />
          </PrivateRoute>
        } />
        <Route path="/system/subscriptions" element={
          <PrivateRoute requireRole="super_admin">
            <SystemSubscriptions />
          </PrivateRoute>
        } />
        <Route path="/subscriptions" element={
          <PrivateRoute requirePermission="canManageSubscriptions">
            <AppLayout>
              <Subscriptions />
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
        <Route path="/obrigado" element={<Obrigado />} />
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
