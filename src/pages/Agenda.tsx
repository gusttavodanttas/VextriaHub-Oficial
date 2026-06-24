
import { Calendar, Clock, Users, MapPin, Plus, Trash2, CalendarCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { NovoCompromissoDialog } from "@/components/Agenda/NovoCompromissoDialog";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FullScreenCalendar } from "@/components/ui/fullscreen-calendar";
import React, { useState } from "react";
import { format, isToday, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useAgendaEvents, EventType, EventStatus, AgendaEvent } from "@/hooks/useAgendaEvents";

const getTypeColor = (type: string) => {
  switch (type) {
    case "audiencia": return "bg-red-100 text-red-800 border-red-200";
    case "reuniao": return "bg-blue-100 text-blue-800 border-blue-200";
    case "prazo": return "bg-orange-100 text-orange-800 border-orange-200";
    case "tarefa": return "bg-green-100 text-green-800 border-green-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "confirmado":
    case "concluido": return "bg-green-100 text-green-800";
    case "pendente": return "bg-yellow-100 text-yellow-800";
    case "cancelado": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case "audiencia": return <Users className="h-4 w-4" />;
    case "reuniao": return <Calendar className="h-4 w-4" />;
    case "prazo": return <AlertCircle className="h-4 w-4" />;
    case "tarefa": return <CalendarCheck className="h-4 w-4" />;
    default: return <Calendar className="h-4 w-4" />;
  }
};

export default function Agenda() {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [novoCompromissoOpen, setNovoCompromissoOpen] = useState(false);
  const [selectedDateForNew, setSelectedDateForNew] = useState<Date>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [currentViewMonth, setCurrentViewMonth] = useState(new Date());

  // Hook de Dados Reais
  const { events, loading, getEventsForDay } = useAgendaEvents(currentViewMonth);
  
  const todayEvents = getEventsForDay(new Date());
  const multiSelect = useMultiSelect<AgendaEvent>(todayEvents);

  // Callback para quando o mês muda no calendário
  const handleMonthChange = React.useCallback((date: Date) => {
    setCurrentViewMonth(date);
  }, []);

  // Preparar dados para o calendário por dia (necessário para o componente FullScreenCalendar)
  const currentMonthData = React.useMemo(() => {
    const startM = startOfMonth(currentViewMonth);
    const endM = endOfMonth(currentViewMonth);
    const daysInMonth = eachDayOfInterval({ start: startM, end: endM });

    return daysInMonth.map(day => ({
      day,
      events: getEventsForDay(day)
    }));
  }, [currentViewMonth, events]);

  const handleDeleteSelected = () => {
    const selectedItems = multiSelect.getSelectedItems();
    const pastEvents = selectedItems.filter(event => {
      const eventDate = new Date();
      eventDate.setHours(parseInt(event.time.split(':')[0]), parseInt(event.time.split(':')[1]));
      return eventDate < new Date();
    });
    
    if (pastEvents.length > 0) {
      toast({
        title: "Não é possível excluir",
        description: "Eventos passados não podem ser excluídos.",
        variant: "destructive",
      });
      return;
    }
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const selectedItems = multiSelect.getSelectedItems();
      const selectedIds = selectedItems.map(item => item.id);
      
      setAgendaData(prev => {
        const newData = [...prev];
        const todayIndex = newData.findIndex(day => isSameDay(day.day, today));
        if (todayIndex !== -1) {
          newData[todayIndex].events = newData[todayIndex].events.filter(event => !selectedIds.includes(event.id));
        }
        return newData;
      });
      
      toast({
        title: "Compromissos excluídos",
        description: `${selectedItems.length} compromisso(s) foram excluído(s) com sucesso.`,
      });
      multiSelect.clearSelection();
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Ocorreu um erro ao excluir os compromissos.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleEventClick = (event: AgendaEvent) => {
    setSelectedEvent(event);
    toast({
      title: event.name,
      description: `${event.time} - ${event.client}`,
    });
  };

  const handleNewEvent = (date: Date) => {
    setSelectedDateForNew(date);
    setNovoCompromissoOpen(true);
  };

  const todayDate = new Date();
  const todayEventsCount = getEventsForDay(todayDate).length;
  const weekEventsCount = events.length;
  const audienciasCount = events.filter(c => c.type === 'audiencia').length;
  const reunioesCount = events.filter(c => c.type === 'reuniao').length;

  return (
    <div className="flex flex-col h-full entry-animate">
      <div className="p-8 border-b border-black/5 dark:border-white/5 bg-background/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Calendar className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 drop-shadow-sm">
                  Agenda Estratégica
                </h1>
              </div>
              <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl">
                Gerencie seus compromissos, audiências e prazos com visão 360º.
              </p>
            </div>
            <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl shadow-premium">
              {!multiSelect.isNoneSelected && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteSelected}
                  className="rounded-xl h-12 px-6 font-bold uppercase text-xs tracking-widest shadow-lg shadow-rose-500/20"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir ({multiSelect.selectedCount})
                </Button>
              )}
              <Button 
                onClick={() => handleNewEvent(new Date())} 
                size="lg" 
                className="rounded-xl shadow-premium h-12 px-8 font-black uppercase text-xs tracking-widest bg-primary hover:bg-primary/90"
              >
                <Plus className="h-5 w-5 mr-2" />
                Novo Compromisso
              </Button>
            </div>
        </div>
      </div>
    </div>

      <div className="flex-1 flex overflow-hidden">
        <Tabs defaultValue="calendar" className="flex-1 flex flex-col">
          <div className="border-b border-black/5 dark:border-white/5 px-8 bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-sm">
            <TabsList className="h-14 w-fit gap-2 bg-transparent border-none">
              <TabsTrigger value="calendar" className="rounded-xl px-8 h-10 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-premium transition-all">Calendário</TabsTrigger>
              <TabsTrigger value="list" className="rounded-xl px-8 h-10 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-premium transition-all">Lista Diária</TabsTrigger>
              <TabsTrigger value="agenda" className="rounded-xl px-8 h-10 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-premium transition-all">Visão Expandida</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="calendar" className="flex-1 m-0 overflow-auto">
            <FullScreenCalendar 
              data={currentMonthData}
              onEventClick={handleEventClick}
              onNewEvent={handleNewEvent}
              onMonthChange={handleMonthChange}
            />
          </TabsContent>

          <TabsContent value="list" className="flex-1 p-8 overflow-auto">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
                  <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xl font-black">Hoje - {format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</CardTitle>
                    <CardDescription className="font-medium">Seus compromissos de hoje</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-4">
                                         {todayEvents.length > 0 && (
                      <div className="flex items-center justify-between p-4 bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 rounded-[1.5rem] mb-6">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={multiSelect.isAllSelected}
                            onCheckedChange={() => 
                              multiSelect.isAllSelected ? multiSelect.clearSelection() : multiSelect.selectAll()
                            }
                            className="rounded-md border-black/10 dark:border-white/20"
                          />
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                            {multiSelect.selectedCount > 0 ? (
                                                              `${multiSelect.selectedCount} de ${todayEvents.length} selecionados`
                            ) : (
                              "Selecionar todos"
                            )}
                          </span>
                        </div>
                        {multiSelect.selectedCount > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={multiSelect.clearSelection}
                            className="rounded-xl h-8 text-[10px] font-black uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5"
                          >
                            Limpar seleção
                          </Button>
                        )}
                      </div>
                    )}
                                         {todayEvents.map((event) => (
                      <div key={event.id} className={cn(
                        "flex items-start space-x-4 p-5 rounded-[1.5rem] border transition-all duration-300 group",
                        multiSelect.isSelected(event.id) 
                          ? "bg-primary/[0.03] border-primary/20 ring-2 ring-primary/10" 
                          : "bg-black/[0.01] dark:bg-white/[0.01] border-black/5 dark:border-white/5 hover:border-primary/20"
                      )}>
                        <Checkbox
                          checked={multiSelect.isSelected(event.id)}
                          onCheckedChange={() => multiSelect.toggleItem(event.id)}
                          className="mt-1 rounded-md border-black/10 dark:border-white/20"
                        />
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={cn("p-2 rounded-lg", getTypeColor(event.type).split(' ')[0].replace('100', '10'))}>
                                {getTypeIcon(event.type)}
                              </div>
                              <div className="text-sm font-black text-primary uppercase tracking-tighter">
                                {event.time}
                              </div>
                            </div>
                            <Badge className={cn("rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest", getStatusColor(event.status))}>
                              {event.status}
                            </Badge>
                          </div>
                          
                          <div>
                            <div className="font-black text-base text-foreground group-hover:text-primary transition-colors">{event.name}</div>
                            <div className="text-xs font-bold text-muted-foreground/60">{event.client}</div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                            <div className="flex items-center text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                              <MapPin className="h-3 w-3 mr-1.5 text-primary/40" />
                              {event.location || 'Local não definido'}
                            </div>
                            <Badge variant="outline" className={cn("rounded-md text-[9px] font-black uppercase tracking-tighter border-black/5 dark:border-white/10", getTypeColor(event.type))}>
                              {event.type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                                         {todayEvents.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                        <div className="p-4 rounded-full bg-primary/5 border border-primary/10">
                          <Calendar className="h-10 w-10 text-primary/30" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-foreground">Agenda livre hoje</p>
                          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            Aproveite para organizar suas tarefas ou colocar a leitura em dia.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
                  <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xl font-black">Próximos Compromissos</CardTitle>
                    <CardDescription className="font-medium">Agenda da próxima semana</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-3">
                    {events.slice(0, 10).map((compromisso) => (
                      <div key={compromisso.id} className="flex items-center justify-between p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] hover:bg-primary/[0.03] transition-all group cursor-pointer" onClick={() => handleEventClick(compromisso)}>
                        <div className="flex items-center gap-4">
                          <div className={cn("p-2.5 rounded-xl transition-colors group-hover:bg-primary/10", getTypeColor(compromisso.type).split(' ')[0].replace('100', '10'))}>
                            {getTypeIcon(compromisso.type)}
                          </div>
                          <div>
                            <div className="font-black text-sm text-foreground group-hover:text-primary transition-colors">{compromisso.name}</div>
                            <div className="text-[10px] font-bold text-muted-foreground/60">{compromisso.client}</div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-primary/40 mt-1">
                              {format(new Date(compromisso.datetime), "d 'de' MMM", { locale: ptBR })} • {compromisso.time}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <Badge className={cn("rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter", getStatusColor(compromisso.status))}>
                            {compromisso.status}
                          </Badge>
                          <Badge variant="outline" className={cn("rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter border-black/5 dark:border-white/10", getTypeColor(compromisso.type))}>
                            {compromisso.type}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="agenda" className="flex-1 p-8 overflow-auto">
            <div className="max-w-4xl mx-auto">
              <Card className="glass-card border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
                <CardHeader className="p-8 pb-4">
                  <CardTitle className="text-xl font-black">Agenda Completa</CardTitle>
                  <CardDescription className="font-medium">Visão detalhada de todos os compromissos</CardDescription>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                  <div className="space-y-10">
                    {currentMonthData.map((day, index) => (
                      <div key={index} className="border-l-2 border-primary/20 pl-6 py-2">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary mb-6 flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-primary" />
                          {format(day.day, "EEEE, d 'de' MMMM", { locale: ptBR })}
                          {isToday(day.day) && (
                            <Badge className="ml-2 bg-primary text-primary-foreground font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest">Hoje</Badge>
                          )}
                        </h3>
                        <div className="space-y-4">
                          {day.events.map((event) => (
                            <div 
                              key={event.id} 
                              className="flex items-center gap-5 p-5 bg-black/[0.01] dark:bg-white/[0.01] border border-black/5 dark:border-white/5 rounded-[1.5rem] hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all cursor-pointer group"
                              onClick={() => handleEventClick(event)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-xl group-hover:bg-primary/10 transition-colors", getTypeColor(event.type).split(' ')[0].replace('100', '10'))}>
                                  {getTypeIcon(event.type)}
                                </div>
                                <span className="text-sm font-black text-primary uppercase tracking-tighter">{event.time}</span>
                              </div>
                              <div className="flex-1">
                                <div className="font-black text-base text-foreground group-hover:text-primary transition-colors">{event.name}</div>
                                <div className="text-xs font-bold text-muted-foreground/60">{event.client}</div>
                                {event.location && (
                                  <div className="flex items-center text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-2">
                                    <MapPin className="h-3 w-3 mr-1.5 text-primary/40" />
                                    {event.location}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                <Badge className={cn("rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter", getStatusColor(event.status))}>
                                  {event.status}
                                </Badge>
                                <Badge variant="outline" className={cn("rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter border-black/5 dark:border-white/10", getTypeColor(event.type))}>
                                  {event.type}
                                </Badge>
                              </div>
                            </div>
                          ))}
                          {day.events.length === 0 && (
                            <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest pl-10 italic">
                              Sem compromissos
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Excluir Compromissos"
        description={`Tem certeza que deseja excluir ${multiSelect.selectedCount} compromisso(s)? Esta ação não pode ser desfeita.`}
        isLoading={isDeleting}
      />
      
      <NovoCompromissoDialog
        open={novoCompromissoOpen}
        onOpenChange={setNovoCompromissoOpen}
        selectedDate={selectedDateForNew}
      />
    </div>
  );
}

