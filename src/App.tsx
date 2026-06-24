
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
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Processos from "./pages/Processos";
import Atendimentos from "./pages/Atendimentos";
import Clientes from "./pages/Clientes";
import Crm from "./pages/Crm";
import Agenda from "./pages/Agenda";
import Tarefas from "./pages/Tarefas";
import Prazos from "./pages/Prazos";
import Publicacoes from "./pages/Publicacoes";
import Consultivo from "./pages/Consultivo";
import Graficos from "./pages/Graficos";
import Financeiro from "./pages/Financeiro";
import Metas from "./pages/Metas";
import Etiquetas from "./pages/Etiquetas";
import Notificacoes from "./pages/Notificacoes";
import Configuracoes from "./pages/Configuracoes";
import Perfil from "./pages/Perfil";
import Admin from "./pages/Admin";
import SuperAdmin from "./pages/SuperAdmin";
import SystemAdmin from "./pages/SystemAdmin";
import SystemSubscriptions from "./pages/SystemSubscriptions";
import Subscriptions from "./pages/Subscriptions";
import NotFound from "./pages/NotFound";
import Audiencias from "./pages/Audiencias";
import Equipe from "./pages/Equipe";
import Escritorio from "./pages/Escritorio";
import Timesheet from "./pages/Timesheet";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import Pagamento from "./pages/Pagamento";
import Obrigado from "./pages/Obrigado";
import { useState, useEffect } from "react";

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
          <PrivateRoute requireRole="super_admin">
            <AppLayout>
              <Subscriptions />
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
