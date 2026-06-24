

import { Bell, Clock, AlertTriangle, CheckCircle, X, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const initialNotifications: any[] = [
  {
    id: 1, type: "urgent",
    title: "Prazo crítico: Petição Inicial vence hoje",
    message: "O prazo para protocolar a Petição Inicial no processo 0716616-20.2025.8.26.0100 vence às 23:59 de hoje.",
    process: "0716616-20.2025.8.26.0100", time: "Hoje, 08:14", read: false,
  },
  {
    id: 2, type: "urgent",
    title: "Audiência em 2 dias — Silva vs. Empresa XYZ",
    message: "Prepare os documentos para a audiência trabalhista marcada para 26/04 às 14h30.",
    process: "0001234-55.2025.5.15.0001", time: "Hoje, 07:00", read: false,
  },
  {
    id: 3, type: "warning",
    title: "Publicação do DJe detectada — Tech Solutions Ltda",
    message: "Nova publicação encontrada no Diário da Justiça Eletrônico relacionada ao processo de Tech Solutions Ltda.",
    process: "0009876-11.2024.8.26.0100", time: "Ontem, 18:45", read: false,
  },
  {
    id: 4, type: "warning",
    title: "Prazo em 3 dias: Contestação",
    message: "O prazo para apresentação de contestação no processo cível se encerrará em 27/04/2025.",
    process: "0002345-67.2025.8.26.0200", time: "Ontem, 15:30", read: false,
  },
  {
    id: 5, type: "success",
    title: "Processo sincronizado com sucesso",
    message: "O processo 0716616-20.2025.8.26.0100 foi importado e vinculado ao cliente Maria Silva.",
    process: "0716616-20.2025.8.26.0100", time: "Ontem, 12:00", read: false,
  },
  {
    id: 6, type: "warning",
    title: "Prazo em 5 dias: Recurso de Apelação",
    message: "Recurso de Apelação a ser interposto no processo de João Santos contra Banco Nacional.",
    process: "0003456-78.2025.8.26.0300", time: "22/abr, 10:15", read: false,
  },
  {
    id: 7, type: "default",
    title: "Novo cliente cadastrado",
    message: "Tech Solutions Ltda foi cadastrado com sucesso e vinculado a 3 processos existentes.",
    process: "—", time: "22/abr, 09:00", read: false,
  },
  {
    id: 8, type: "urgent",
    title: "Prazo vencido: Manifestação não enviada",
    message: "A manifestação no processo 0005432-12.2024.8.26.0100 não foi protocolada no prazo. Verifique urgentemente.",
    process: "0005432-12.2024.8.26.0100", time: "21/abr, 23:59", read: false,
  },
  {
    id: 9, type: "success",
    title: "Audiência realizada — processo encerrado",
    message: "A audiência de conciliação resultou em acordo. Processo 0001111-22.2023.8.26.0100 encerrado.",
    process: "0001111-22.2023.8.26.0100", time: "21/abr, 16:00", read: true,
  },
  {
    id: 10, type: "warning",
    title: "112 publicações sem vínculo detectadas",
    message: "112 publicações do DJe estão sem vínculo a processos ou clientes. Acesse Publicações para revisar.",
    process: "—", time: "21/abr, 08:00", read: true,
  },
];

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "urgent":
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    case "warning":
      return <Clock className="h-5 w-5 text-yellow-500" />;
    case "success":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    default:
      return <Bell className="h-5 w-5 text-blue-500" />;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case "urgent":
      return "border-l-red-500 bg-red-50/50 dark:bg-red-950/20";
    case "warning":
      return "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20";
    case "success":
      return "border-l-green-500 bg-green-50/50 dark:bg-green-950/20";
    default:
      return "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20";
  }
};

const Notificacoes = () => {
  const [notificationList, setNotificationList] = useState(initialNotifications);

  const markAsRead = (id: number) => {
    setNotificationList(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotificationList(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id: number) => {
    setNotificationList(prev => prev.filter(notif => notif.id !== id));
  };

  const clearAll = () => setNotificationList([]);

  const unreadCount = notificationList.filter(n => !n.read).length;

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 overflow-x-hidden entry-animate">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 shadow-premium">
              <Bell className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary drop-shadow-sm flex items-center gap-3">
              Notificações
              {unreadCount > 0 && (
                <Badge variant="destructive" className="bg-red-500 text-white text-sm font-black px-2 py-1 rounded-xl shadow-lg animate-pulse">
                  {unreadCount}
                </Badge>
              )}
            </h1>
          </div>
          <p className="text-sm md:text-lg text-muted-foreground font-black uppercase tracking-widest text-[10px] opacity-60 px-1">
            Acompanhe intimações, prazos e atualizações importantes dos seus processos.
          </p>
        </div>
        {notificationList.length > 0 && (
          <div className="flex items-center gap-2 glass-card p-2 rounded-2xl border-black/5 dark:border-white/5 shadow-premium">
            <Button variant="ghost" size="sm" className="rounded-xl font-black uppercase tracking-widest text-[10px]" onClick={markAllAsRead}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar lidas
            </Button>
            <Button variant="ghost" size="sm" className="rounded-xl font-black uppercase tracking-widest text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10" onClick={clearAll}>
              <X className="h-4 w-4 mr-2" />
              Limpar tudo
            </Button>
          </div>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notificationList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 glass-card rounded-[2.5rem] border-black/5 dark:border-white/5 shadow-premium">
            <div className="p-8 rounded-full bg-primary/5 border border-primary/10 shadow-inner">
              <Bell className="h-16 w-16 text-primary/20" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-foreground">Tudo em dia!</h3>
              <p className="text-muted-foreground font-medium max-w-xs mx-auto">
                Nenhuma notificação pendente. Prazos e publicações detectadas aparecerão aqui.
              </p>
            </div>
          </div>
        ) : (
          notificationList.map((notification) => (
            <Card
              key={notification.id}
              className={`glass-card border-l-4 ${getNotificationColor(notification.type)} ${!notification.read ? 'shadow-premium border-black/5 dark:border-white/5' : 'opacity-60 border-transparent'} transition-all duration-500 rounded-2xl overflow-hidden hover-lift`}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <CardTitle className={`text-base ${!notification.read ? 'font-black' : 'font-bold'} tracking-tight`}>
                        {notification.title}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span>{notification.time}</span>
                        {notification.process !== "—" && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {notification.process}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!notification.read && (
                      <Button size="sm" variant="ghost" onClick={() => markAsRead(notification.id)} className="h-8 px-2 rounded-xl" title="Marcar como lida">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => removeNotification(notification.id)} className="h-8 px-2 text-muted-foreground hover:text-destructive rounded-xl">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{notification.message}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Notificacoes;
