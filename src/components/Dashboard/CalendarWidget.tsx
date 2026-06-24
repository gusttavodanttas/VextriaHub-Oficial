
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, MapPin } from "lucide-react";

// Criando eventos para datas mais próximas da atual
const getCurrentDate = () => new Date();
const getDateWithOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const mockEvents: any[] = [];

export function CalendarWidget() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(getCurrentDate());
  
  const selectedEvents = mockEvents.find(
    event => event.date.toDateString() === selectedDate?.toDateString()
  )?.events || [];

  const getEventColor = (type: string) => {
    switch (type) {
      case "audiencia": return "bg-red-500";
      case "prazo": return "bg-yellow-500";
      case "reuniao": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case "audiencia": return "Audiência";
      case "prazo": return "Prazo";
      case "reuniao": return "Reunião";
      default: return "Evento";
    }
  };

  return (
    <Card className="h-full flex flex-col animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          Agenda
        </CardTitle>
        <CardDescription>
          Compromissos e prazos
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          className="rounded-md border w-full [&_table]:text-xs"
          modifiers={{
            hasEvents: mockEvents.map(e => e.date)
          }}
          modifiersStyles={{
            hasEvents: { backgroundColor: 'hsl(var(--primary))', color: 'white', fontWeight: 'bold' }
          }}
        />
        
        {selectedDate && (
          <div className="flex-1 space-y-2">
            <h4 className="font-medium text-sm">
              {selectedDate.toLocaleDateString('pt-BR')}
            </h4>
            {selectedEvents.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedEvents.map((event, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${getEventColor(event.type)} mt-1.5 flex-shrink-0`} />
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span className="font-medium">{event.time}</span>
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {getEventTypeLabel(event.type)}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum evento para esta data</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
