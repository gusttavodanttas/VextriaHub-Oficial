import { Bell, Clock, AlertTriangle, CheckCircle, X, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useNotifications, type NotificationType } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case "error":
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    case "warning":
      return <Clock className="h-5 w-5 text-yellow-500" />;
    case "success":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    default:
      return <Bell className="h-5 w-5 text-blue-500" />;
  }
};

const getNotificationColor = (type: NotificationType) => {
  switch (type) {
    case "error":
      return "border-l-red-500 bg-red-50/50 dark:bg-red-950/20";
    case "warning":
      return "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20";
    case "success":
      return "border-l-green-500 bg-green-50/50 dark:bg-green-950/20";
    default:
      return "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20";
  }
};

const fmtTime = (d: Date) => {
  try { return formatDistanceToNow(d, { addSuffix: true, locale: ptBR }); }
  catch { return ""; }
};

const Notificacoes = () => {
  const navigate = useNavigate();
  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 overflow-x-hidden entry-animate">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 shadow-premium">
              <Bell className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight flex items-center gap-3">
              Notificações
              {unreadCount > 0 && (
                <Badge variant="destructive" className="bg-red-500 text-white text-sm font-black px-2 py-1 rounded-xl shadow-lg">
                  {unreadCount}
                </Badge>
              )}
            </h1>
          </div>
          <p className="text-[10px] md:text-xs text-muted-foreground font-black uppercase tracking-widest opacity-60 px-1">
            Acompanhe prazos, publicações e atualizações dos seus processos.
          </p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 glass-card p-2 rounded-2xl border-black/5 dark:border-border shadow-premium">
            <Button variant="ghost" size="sm" className="rounded-xl font-black uppercase tracking-widest text-[10px]" onClick={markAllAsRead}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar todas como lidas
            </Button>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 glass-card rounded-[2.5rem] border-black/5 dark:border-border shadow-premium">
            <div className="p-8 rounded-full bg-primary/5 border border-primary/10 shadow-inner">
              <Bell className="h-16 w-16 text-primary/20" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-foreground">Tudo em dia!</h3>
              <p className="text-muted-foreground font-medium max-w-xs mx-auto">
                Nenhuma notificação no momento. Prazos e publicações detectadas aparecerão aqui.
              </p>
            </div>
          </div>
        ) : (
          notifications.map((n) => (
            <Card
              key={n.id}
              className={`glass-card border-l-4 ${getNotificationColor(n.type)} ${!n.read ? 'shadow-premium border-black/5 dark:border-border' : 'opacity-60 border-transparent'} transition-all duration-300 rounded-2xl overflow-hidden`}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {getNotificationIcon(n.type)}
                    <div className="flex-1 min-w-0">
                      <CardTitle className={`text-base ${!n.read ? 'font-black' : 'font-bold'} tracking-tight`}>
                        {n.title}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{fmtTime(n.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!n.read && (
                      <Button size="sm" variant="ghost" onClick={() => markAsRead(n.id)} className="h-8 px-2 rounded-xl" title="Marcar como lida">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteNotification(n.id)} className="h-8 px-2 text-muted-foreground hover:text-destructive rounded-xl" title="Excluir">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{n.message}</p>
                {n.actionUrl && (
                  <Button size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs font-bold"
                    onClick={() => { if (!n.read) markAsRead(n.id); navigate(n.actionUrl!); }}>
                    <ExternalLink className="h-3.5 w-3.5" /> {n.actionLabel || "Abrir"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Notificacoes;
