
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, format, isSameDay } from "date-fns";

export type EventType = "audiencia" | "reuniao" | "atendimento" | "prazo" | "tarefa";
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
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!user?.office_id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const start = startOfMonth(targetDate);
      const end = endOfMonth(targetDate);

      // 1. Buscar Audiências
      const { data: audiencias, error: audError } = await supabase
        .from("audiencias")
        .select("*, clientes!cliente_id(nome)")
        .eq("office_id", user.office_id)
        .gte("data_audiencia", start.toISOString())
        .lte("data_audiencia", end.toISOString())
        .eq("deletado", false);

      // 2. Buscar Prazos (schema real: data_fim_prazo, sem deletado; título vem da publicação)
      const { data: prazos, error: praError } = await supabase
        .from("prazos")
        .select("*, publicacoes(titulo)")
        .eq("office_id", user.office_id)
        .gte("data_fim_prazo", format(start, "yyyy-MM-dd"))
        .lte("data_fim_prazo", format(end, "yyyy-MM-dd"));

      // 3. Buscar Atendimentos (Reuniões)
      const { data: atendimentos, error: ateError } = await supabase
        .from("atendimentos")
        .select("*, clientes!cliente_id(nome)")
        .eq("office_id", user.office_id)
        .gte("data_atendimento", start.toISOString())
        .lte("data_atendimento", end.toISOString())
        .eq("deletado", false);

      // 4. Buscar Tarefas
      const { data: tarefas, error: tarError } = await supabase
        .from("tarefas")
        .select("*, clientes!cliente_id(nome)")
        .eq("office_id", user.office_id)
        .gte("data_vencimento", start.toISOString())
        .lte("data_vencimento", end.toISOString())
        .eq("deletado", false);

      if (audError || praError || ateError || tarError) {
        console.error("Erro ao buscar eventos da agenda:", { audError, praError, ateError, tarError });
      }

      const allEvents: AgendaEvent[] = [
        ...(audiencias || []).map(a => ({
          id: a.id,
          name: a.titulo,
          time: format(new Date(a.data_audiencia), 'HH:mm'),
          datetime: a.data_audiencia,
          type: 'audiencia' as const,
          client: (a as any).clientes?.nome || 'Cliente não informado',
          location: a.local || 'Local não informado',
          status: (a.status as EventStatus) || 'pendente'
        })),
        ...(prazos || []).map((p: any) => ({
          id: p.id,
          name: p.publicacoes?.titulo || p.tipo_prazo || p.numero_processo || 'Prazo',
          time: '—',
          datetime: `${p.data_fim_prazo}T12:00:00`,
          type: 'prazo' as const,
          client: p.numero_processo || 'Prazo processual',
          location: 'Digital',
          status: 'pendente' as const
        })),
        ...(atendimentos || []).map(ate => ({
          id: ate.id,
          name: ({ reuniao: "Reunião", consulta: "Consulta", outro: "Atendimento" } as Record<string, string>)[ate.tipo_atendimento] || ate.tipo_atendimento || 'Atendimento',
          time: format(new Date(ate.data_atendimento), 'HH:mm'),
          datetime: ate.data_atendimento,
          type: 'atendimento' as const,
          client: (ate as any).clientes?.nome || 'Cliente não informado',
          location: 'Escritório',
          status: (ate.status as EventStatus) || 'confirmado'
        })),
        ...(tarefas || []).map(t => ({
          id: t.id,
          name: t.titulo,
          time: t.data_vencimento ? format(new Date(t.data_vencimento), 'HH:mm') : '00:00',
          datetime: t.data_vencimento || new Date().toISOString(),
          type: 'tarefa' as const,
          client: (t as any).clientes?.nome || 'N/A',
          location: 'Interno',
          status: t.concluida ? 'concluido' as const : 'pendente' as const
        }))
      ];

      setEvents(allEvents.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()));
    } catch (err) {
      console.error("Erro fatal no useAgendaEvents:", err);
    } finally {
      setLoading(false);
    }
  }, [user, targetDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(new Date(event.datetime), day));
  };

  return {
    events,
    loading,
    refresh: fetchEvents,
    getEventsForDay
  };
};
