import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface GoogleCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}

interface GoogleCalendarSettings {
  isConnected: boolean;
  syncEnabled: boolean;
  calendarId: string;
  lastSync: string | null;
  syncDirection: 'both' | 'to_google' | 'from_google';
}

export const GoogleCalendarIntegration: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [settings, setSettings] = useState<GoogleCalendarSettings>({
    isConnected: false,
    syncEnabled: false,
    calendarId: '',
    lastSync: null,
    syncDirection: 'both'
  });
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);

  useEffect(() => {
    // Carregar configurações salvas
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Simular carregamento das configurações
      // Em produção, buscar do banco de dados
      const savedSettings = localStorage.getItem('google_calendar_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const saveSettings = async (newSettings: GoogleCalendarSettings) => {
    try {
      localStorage.setItem('google_calendar_settings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
    }
  };

  const handleGoogleAuth = async () => {
    setIsConnecting(true);
    
    try {
      // Simular processo de autenticação OAuth2 do Google
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newSettings = {
        ...settings,
        isConnected: true,
        calendarId: 'primary',
        lastSync: new Date().toISOString()
      };
      
      await saveSettings(newSettings);
      
      toast({
        title: "Conectado com sucesso",
        description: "Sua conta Google foi conectada ao VextriaHub."
      });
    } catch (error) {
      toast({
        title: "Erro na conexão",
        description: "Não foi possível conectar com o Google Calendar.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const newSettings = {
        ...settings,
        isConnected: false,
        syncEnabled: false,
        calendarId: '',
        lastSync: null
      };
      
      await saveSettings(newSettings);
      setEvents([]);
      
      toast({
        title: "Desconectado",
        description: "Sua conta Google foi desconectada."
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao desconectar da conta Google.",
        variant: "destructive"
      });
    }
  };

  const handleSyncToggle = async (enabled: boolean) => {
    const newSettings = {
      ...settings,
      syncEnabled: enabled
    };
    
    await saveSettings(newSettings);
    
    if (enabled) {
      handleSync();
    }
    
    toast({
      title: enabled ? "Sincronização ativada" : "Sincronização desativada",
      description: enabled 
        ? "Seus eventos serão sincronizados automaticamente."
        : "A sincronização automática foi desabilitada."
    });
  };

  const handleSync = async () => {
    if (!settings.isConnected) return;
    
    setIsSyncing(true);
    
    try {
      // Simular sincronização
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Mock de eventos sincronizados
      const mockEvents: GoogleCalendarEvent[] = [
        {
          id: '1',
          title: 'Audiência - Processo 123',
          start: '2024-01-20T10:00:00',
          end: '2024-01-20T11:00:00',
          description: 'Audiência de conciliação',
          location: 'Fórum Central'
        },
        {
          id: '2',
          title: 'Reunião com Cliente',
          start: '2024-01-22T14:00:00',
          end: '2024-01-22T15:00:00',
          description: 'Discussão sobre estratégia processual'
        }
      ];
      
      setEvents(mockEvents);
      
      const newSettings = {
        ...settings,
        lastSync: new Date().toISOString()
      };
      
      await saveSettings(newSettings);
      
      toast({
        title: "Sincronização concluída",
        description: `${mockEvents.length} eventos foram sincronizados.`
      });
    } catch (error) {
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar os eventos.",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Status da Conexão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Integração Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!settings.isConnected ? (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Conecte sua conta Google para sincronizar eventos entre o VextriaHub e o Google Calendar.
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={handleGoogleAuth} 
                disabled={isConnecting}
                className="w-full"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Conectar com Google
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Conectado com sucesso! Sua conta Google está vinculada ao VextriaHub.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4">
                {/* Configurações de Sincronização */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="sync-enabled">Sincronização Automática</Label>
                    <p className="text-sm text-muted-foreground">
                      Sincronizar eventos automaticamente entre as plataformas
                    </p>
                  </div>
                  <Switch
                    id="sync-enabled"
                    checked={settings.syncEnabled}
                    onCheckedChange={handleSyncToggle}
                  />
                </div>
                
                {settings.lastSync && (
                  <p className="text-sm text-muted-foreground">
                    Última sincronização: {formatDate(settings.lastSync)}
                  </p>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSync} 
                    disabled={isSyncing}
                    variant="outline"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sincronizar Agora
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={handleDisconnect} 
                    variant="destructive"
                  >
                    Desconectar
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Eventos Sincronizados */}
      {settings.isConnected && events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Eventos Sincronizados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-medium">{event.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(event.start)} - {formatDate(event.end)}
                      </p>
                      {event.description && (
                        <p className="text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      )}
                      {event.location && (
                        <p className="text-sm text-muted-foreground">
                          📍 {event.location}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};