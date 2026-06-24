import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw } from 'lucide-react';

const Subscriptions: React.FC = () => {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();

  useEffect(() => {
    if (isSuperAdmin) {
      navigate('/super-admin?tab=subscriptions', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [isSuperAdmin, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/50 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Redirecionando para o painel integrado...</p>
      </div>
    </div>
  );
};

export default Subscriptions;
