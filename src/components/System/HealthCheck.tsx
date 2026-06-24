
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Database, Wifi, Server, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastCheck: Date;
  icon: React.ComponentType<any>;
}

export const HealthCheck: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const checkHealth = async () => {
    setIsLoading(true);
    const checks: HealthStatus[] = [];

    // Check Database
    try {
      const start = Date.now();
      await supabase.from('profiles').select('count').limit(1);
      const responseTime = Date.now() - start;
      
      checks.push({
        service: 'Database',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date(),
        icon: Database,
      });
    } catch (error) {
      checks.push({
        service: 'Database',
        status: 'down',
        responseTime: 0,
        lastCheck: new Date(),
        icon: Database,
      });
    }

    // Check Network
    const networkStatus = navigator.onLine ? 'healthy' : 'down';
    checks.push({
      service: 'Network',
      status: networkStatus,
      responseTime: 0,
      lastCheck: new Date(),
      icon: Wifi,
    });

    // Check Service Worker
    const swStatus = 'serviceWorker' in navigator ? 'healthy' : 'down';
    checks.push({
      service: 'Service Worker',
      status: swStatus,
      responseTime: 0,
      lastCheck: new Date(),
      icon: Server,
    });

    // Check Performance
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const loadTime = navigation ? navigation.loadEventEnd - navigation.fetchStart : 0;
    const perfStatus = loadTime < 3000 ? 'healthy' : loadTime < 5000 ? 'degraded' : 'down';
    
    checks.push({
      service: 'Performance',
      status: perfStatus,
      responseTime: loadTime,
      lastCheck: new Date(),
      icon: Activity,
    });

    setHealthStatus(checks);
    setIsLoading(false);
  };

  useEffect(() => {
    checkHealth();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'down': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy': return 'Saudável';
      case 'degraded': return 'Degradado';
      case 'down': return 'Indisponível';
      default: return 'Desconhecido';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Status do Sistema
          </CardTitle>
          <CardDescription>
            Monitoramento em tempo real dos serviços
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={checkHealth}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {healthStatus.map((service) => (
          <div key={service.service} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <service.icon className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="font-medium">{service.service}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  {service.responseTime > 0 ? `${service.responseTime}ms` : 'N/A'}
                  <span>•</span>
                  {service.lastCheck.toLocaleTimeString()}
                </div>
              </div>
            </div>
            <Badge 
              className={`${getStatusColor(service.status)} text-white`}
              variant="secondary"
            >
              {getStatusText(service.status)}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
