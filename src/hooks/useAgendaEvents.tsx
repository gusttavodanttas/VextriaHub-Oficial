
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfMonth, endOfMonth, format, isSameDay } from 'date-fns';

export type EventType = "audiencia" | "reuniao" | "prazo" | "tarefa";
export type EventStatus = "confirmado" | "pendente" | "cancelado" | "concluido";

export interface AgendaEvent {
  id: string | number;
  name: string;
  time: string;
  datetime: string;
  type: EventType;
  client: string;
  location: string;
  status: EventStatus;
  description?: string;
}

export interface AgendaDay {
  day: Date;
  events: AgendaEvent[];
}

export const useAgendaEvents = (targetDate: Date) => {
  const { user } = useAuth();

  const { data: events = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['agenda_events', user?.office_id, targetDate],
    queryFn: async () => {
      if (!user?.office_id) return [];
      const start = startOfMonth(targetDate);
      const end = endOfMonth(targetDate);

      const [audienciasRes, prazosRes, atendimentosRes, tarefasRes] = await Promise.all([
        supabase.from("audiencias").select("*, clientes!cliente_id(nome)").eq("office_id", user.office_id).gte("data_audiencia", start.toISOString()).lte("data_audiencia", end.toISOString()).eq("deletado", false),
        supabase.from("prazos").select("*, processos(titulo)").eq("office_id", user.office_id).gte("data_vencimento", start.toISOString()).lte("data_vencimento", end.toISOString()).eq("deletado", false),
        supabase.from("atendimentos").select("*, clientes!cliente_id(nome)").eq("office_id", user.office_id).gte("data_atendimento", start.toISOString()).lte("data_atendimento", end.toISOString()).eq("deletado", false),
        supabase.from("tarefas").select("*, clientes!cliente_id(nome)").eq("office_id", user.office_id).gte("data_vencimento", start.toISOString()).lte("data_vencimento", end.toISOString()).eq("deletado", false),
      ]);

      const allEvents: AgendaEvent[] = [
        ...(audienciasRes.data || []).map((a: Record<string, any>) => ({
          id: a.id,
          name: a.titulo,
          time: format(new Date(a.data_audiencia), 'HH:mm'),
          datetime: a.data_audiencia,
          type: 'audiencia' as const,
          client: a.clientes?.nome || 'Cliente não informado',
          location: a.local || 'Local não informado',
          status: (a.status as EventStatus) || 'pendente'
        })),
        ...(prazosRes.data || []).map((p: Record<string, any>) => ({
          id: p.id,
          name: p.titulo,
          time: format(new Date(p.data_vencimento), 'HH:mm'),
          datetime: p.data_vencimento,
          type: 'prazo' as const,
          client: p.processos?.titulo || 'Processo não informado',
          location: 'Digital',
          status: (p.status as EventStatus) || 'pendente'
        })),
        ...(atendimentosRes.data || []).map((ate: Record<string, any>) => ({
          id: ate.id,
          name: `Atendimento: ${ate.tipo_atendimento || 'Reunião'}`,
          time: format(new Date(ate.data_atendimento), 'HH:mm'),
          datetime: ate.data_atendimento,
          type: 'reuniao' as const,
          client: ate.clientes?.nome || 'Cliente não informado',
          location: 'Escritório',
          status: (ate.status as EventStatus) || 'confirmado'
        })),
        ...(tarefasRes.data || []).map((t: Record<string, any>) => ({
          id: t.id,
          name: t.titulo,
          time: t.data_vencimento ? format(new Date(t.data_vencimento), 'HH:mm') : '00:00',
          datetime: t.data_vencimento || new Date().toISOString(),
          type: 'tarefa' as const,
          client: t.clientes?.nome || 'N/A',
          location: 'Interno',
          status: t.concluida ? 'concluido' as const : 'pendente' as const
        }))
      ];

      return allEvents.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    },
  });

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(new Date(event.datetime), day));
  };

  return {
    events,
    loading,
    refresh: () => {}, // query will handle
    getEventsForDay
  };
};
