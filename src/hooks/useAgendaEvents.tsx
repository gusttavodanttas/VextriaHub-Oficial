
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, format, isSameDay } from "date-fns";
import { localYmd } from "@/lib/dates";

// Teto de itens atrasados carregados. Escritório com anos de pendência não
// derruba a tela; os mais recentes (o que você deixou passar ontem, semana
// passada) vêm primeiro e são os que interessam.
const LIMITE_ATRASADOS = 50;

export type EventType = "audiencia" | "reuniao" | "atendimento" | "prazo" | "tarefa" | "consultivo";
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

// ── Formas mínimas das linhas usadas aqui (os selects trazem "*") ───────────
interface ClienteRef { nome?: string | null }
interface AudienciaRow { id: string; titulo?: string | null; data_audiencia: string; local?: string | null; status?: string | null; clientes?: ClienteRef | null }
interface PrazoRow { id: string; titulo?: string | null; tipo_prazo?: string | null; numero_processo?: string | null; data_fim_prazo?: string | null; data_vencimento?: string | null; status?: string | null; publicacoes?: { titulo?: string | null } | null }
interface AtendimentoRow { id: string; tipo_atendimento?: string | null; data_atendimento: string; status?: string | null; clientes?: ClienteRef | null }
interface TarefaRow { id: string; titulo?: string | null; data_vencimento?: string | null; concluida?: boolean | null; clientes?: ClienteRef | null }
interface ConsultivoRow { id: string; titulo?: string | null; prazo?: string | null; status?: string | null; clientes?: ClienteRef | null }

const rows = <T,>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : []);

// ── Conversores para o vocabulário único da agenda ──────────────────────────
// Extraídos do corpo do hook porque agora servem a DOIS carregamentos (o mês
// visível e os atrasados de qualquer mês anterior) — duplicá-los faria as duas
// listas divergirem na primeira manutenção.
const toAudiencia = (a: AudienciaRow): AgendaEvent => ({
  id: a.id,
  name: a.titulo || "Audiência",
  time: format(new Date(a.data_audiencia), "HH:mm"),
  datetime: a.data_audiencia,
  type: "audiencia",
  client: a.clientes?.nome || "Cliente não informado",
  location: a.local || "Local não informado",
  // normaliza pro vocabulário da agenda: realizada = concluída
  status: (a.status === "realizada" ? "concluido" : a.status === "cancelada" ? "cancelado" : "pendente") as EventStatus,
});

const toPrazo = (p: PrazoRow): AgendaEvent => ({
  id: p.id,
  name: p.titulo || p.publicacoes?.titulo || p.tipo_prazo || p.numero_processo || "Prazo",
  time: "—",
  datetime: `${p.data_fim_prazo || p.data_vencimento}T12:00:00`,
  type: "prazo",
  client: p.numero_processo || "Prazo processual",
  location: "Digital",
  // status REAL — antes era 'pendente' fixo e prazo concluído parecia pendente pra sempre
  status: (p.status === "concluido" ? "concluido" : "pendente") as EventStatus,
});

const toAtendimento = (ate: AtendimentoRow): AgendaEvent => ({
  id: ate.id,
  name: ({ reuniao: "Reunião", consulta: "Consulta", outro: "Atendimento" } as Record<string, string>)[ate.tipo_atendimento || ""] || ate.tipo_atendimento || "Atendimento",
  time: format(new Date(ate.data_atendimento), "HH:mm"),
  datetime: ate.data_atendimento,
  type: "atendimento",
  client: ate.clientes?.nome || "Cliente não informado",
  location: "Escritório",
  status: (ate.status as EventStatus) || "confirmado",
});

const toTarefa = (t: TarefaRow): AgendaEvent => ({
  id: t.id,
  name: t.titulo || "Tarefa",
  // Tarefa não tem horário específico → "Dia todo"; usa T12:00:00 p/ não escorregar de dia (fuso)
  time: "Dia todo",
  datetime: t.data_vencimento ? `${String(t.data_vencimento).slice(0, 10)}T12:00:00` : new Date().toISOString(),
  type: "tarefa",
  client: t.clientes?.nome || "N/A",
  location: "Interno",
  status: t.concluida ? "concluido" : "pendente",
});

const toConsultivo = (c: ConsultivoRow): AgendaEvent => ({
  id: c.id,
  name: c.titulo || "Consultivo",
  time: "Dia todo",
  datetime: c.prazo ? `${String(c.prazo).slice(0, 10)}T12:00:00` : new Date().toISOString(),
  type: "consultivo",
  client: c.clientes?.nome || "N/A",
  location: "Consultivo",
  status: (c.status === "concluido" ? "concluido" : "pendente") as EventStatus,
});

const porData = (a: AgendaEvent, b: AgendaEvent) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime();

export const useAgendaEvents = (targetDate: Date) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [atrasados, setAtrasados] = useState<AgendaEvent[]>([]);
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

      // 1. Buscar Audiências (canceladas ficam de fora; realizadas aparecem como concluídas)
      const { data: audiencias, error: audError } = await supabase
        .from("audiencias")
        .select("*, clientes!cliente_id(nome)")
        .eq("office_id", user.office_id)
        .gte("data_audiencia", start.toISOString())
        .lte("data_audiencia", end.toISOString())
        .eq("deletado", false)
        .neq("status", "cancelada");

      // 2. Buscar Prazos: fatal = data_fim_prazo OU, em prazo legado sem fatal, data_vencimento.
      //    (Antes filtrava só data_fim_prazo → prazo legado com só data_vencimento sumia da agenda.)
      const praIni = format(start, "yyyy-MM-dd");
      const praFim = format(end, "yyyy-MM-dd");
      const { data: prazos, error: praError } = await supabase
        .from("prazos")
        .select("*, publicacoes(titulo)")
        .eq("office_id", user.office_id)
        .eq("deletado", false)
        .or(`and(data_fim_prazo.gte.${praIni},data_fim_prazo.lte.${praFim}),and(data_fim_prazo.is.null,data_vencimento.gte.${praIni},data_vencimento.lte.${praFim})`);

      // 3. Buscar Atendimentos (Reuniões)
      const { data: atendimentos, error: ateError } = await supabase
        .from("atendimentos")
        .select("*, clientes!cliente_id(nome)")
        .eq("office_id", user.office_id)
        .gte("data_atendimento", start.toISOString())
        .lte("data_atendimento", end.toISOString())
        .eq("deletado", false);

      // 4. Buscar Tarefas (data_vencimento é DATE → compara com strings de data)
      const { data: tarefas, error: tarError } = await supabase
        .from("tarefas")
        .select("*, clientes!cliente_id(nome)")
        .eq("office_id", user.office_id)
        .gte("data_vencimento", praIni)
        .lte("data_vencimento", praFim)
        .eq("deletado", false);

      // 5. Buscar Consultivos com prazo definido (data DATE → compara com strings de data)
      const { data: consultivos, error: conError } = await supabase
        .from("consultivos")
        .select("*, clientes!cliente_id(nome)")
        .eq("office_id", user.office_id)
        .eq("deletado", false)
        .gte("prazo", praIni)
        .lte("prazo", praFim);

      if (audError || praError || ateError || tarError || conError) {
        console.error("Erro ao buscar eventos da agenda:", { audError, praError, ateError, tarError, conError });
      }

      const allEvents: AgendaEvent[] = [
        ...rows<AudienciaRow>(audiencias).map(toAudiencia),
        ...rows<PrazoRow>(prazos).map(toPrazo),
        ...rows<AtendimentoRow>(atendimentos).map(toAtendimento),
        ...rows<TarefaRow>(tarefas).map(toTarefa),
        ...rows<ConsultivoRow>(consultivos).map(toConsultivo),
      ];

      setEvents(allEvents.sort(porData));
    } catch (err) {
      console.error("Erro fatal no useAgendaEvents:", err);
    } finally {
      setLoading(false);
    }
  }, [user, targetDate]);

  // ── ATRASADOS ──────────────────────────────────────────────────────────────
  // O que venceu e continua pendente, de QUALQUER mês anterior. Consulta própria
  // (não depende do mês navegado) porque o item atrasado precisa aparecer hoje,
  // não no dia em que venceu — era exatamente esse o buraco: a lista da agenda
  // filtrava "a partir de hoje" e o prazo/tarefa de ontem sumia da tela.
  const fetchAtrasados = useCallback(async () => {
    if (!user?.office_id) return;
    const hoje = localYmd(new Date());
    const inicioDeHoje = `${hoje}T00:00:00`;

    try {
      const [aud, pra, ate, tar, con] = await Promise.all([
        supabase.from("audiencias").select("*, clientes!cliente_id(nome)")
          .eq("office_id", user.office_id).eq("deletado", false)
          .not("status", "in", "(cancelada,realizada)")
          .lt("data_audiencia", inicioDeHoje)
          .order("data_audiencia", { ascending: false }).limit(LIMITE_ATRASADOS),
        supabase.from("prazos").select("*, publicacoes(titulo)")
          .eq("office_id", user.office_id).eq("deletado", false)
          .neq("status", "concluido")
          .or(`data_fim_prazo.lt.${hoje},and(data_fim_prazo.is.null,data_vencimento.lt.${hoje})`)
          .order("data_fim_prazo", { ascending: false, nullsFirst: false }).limit(LIMITE_ATRASADOS),
        supabase.from("atendimentos").select("*, clientes!cliente_id(nome)")
          .eq("office_id", user.office_id).eq("deletado", false)
          .eq("status", "agendado")
          .lt("data_atendimento", inicioDeHoje)
          .order("data_atendimento", { ascending: false }).limit(LIMITE_ATRASADOS),
        supabase.from("tarefas").select("*, clientes!cliente_id(nome)")
          .eq("office_id", user.office_id).eq("deletado", false)
          .eq("concluida", false)
          .lt("data_vencimento", hoje)
          .order("data_vencimento", { ascending: false }).limit(LIMITE_ATRASADOS),
        supabase.from("consultivos").select("*, clientes!cliente_id(nome)")
          .eq("office_id", user.office_id).eq("deletado", false)
          .neq("status", "concluido")
          .lt("prazo", hoje)
          .order("prazo", { ascending: false }).limit(LIMITE_ATRASADOS),
      ]);

      if (aud.error || pra.error || ate.error || tar.error || con.error) {
        console.error("Erro ao buscar itens atrasados:", { aud: aud.error, pra: pra.error, ate: ate.error, tar: tar.error, con: con.error });
      }

      const lista: AgendaEvent[] = [
        ...rows<AudienciaRow>(aud.data).map(toAudiencia),
        ...rows<PrazoRow>(pra.data).map(toPrazo),
        ...rows<AtendimentoRow>(ate.data).map(toAtendimento),
        ...rows<TarefaRow>(tar.data).map(toTarefa),
        ...rows<ConsultivoRow>(con.data).map(toConsultivo),
      ];

      // Mais recente primeiro: "venceu ontem" no topo, o resto abaixo.
      setAtrasados(lista.sort((a, b) => porData(b, a)).slice(0, LIMITE_ATRASADOS));
    } catch (err) {
      console.error("Erro fatal ao buscar atrasados:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchAtrasados();
  }, [fetchAtrasados]);

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(new Date(event.datetime), day));
  };

  const refresh = useCallback(async () => {
    await Promise.all([fetchEvents(), fetchAtrasados()]);
  }, [fetchEvents, fetchAtrasados]);

  return {
    events,
    atrasados,
    loading,
    refresh,
    getEventsForDay
  };
};
