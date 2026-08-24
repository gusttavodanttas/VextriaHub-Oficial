import { useState, useEffect, useCallback } from "react";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, Clock, AlertCircle, CheckSquare, Headphones, BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AgendaItemDialog, AgendaType } from "@/components/Dashboard/AgendaItemDialog";

interface DayEvent {
  type: AgendaType;
  id: string;
  titulo: string;
  hora?: string;
}

// Estilo/ícone por tipo de evento da agenda
const EVENT_STYLE: Record<DayEvent["type"], { cls: string; Icon: any }> = {
  prazo: { cls: "border-rose-500/15 bg-rose-500/5 text-rose-600 dark:text-rose-400", Icon: AlertCircle },
  audiencia: { cls: "border-orange-500/15 bg-orange-500/5 text-orange-600 dark:text-orange-400", Icon: Clock },
  tarefa: { cls: "border-violet-500/15 bg-violet-500/5 text-violet-600 dark:text-violet-400", Icon: CheckSquare },
  atendimento: { cls: "border-cyan-500/15 bg-cyan-500/5 text-cyan-600 dark:text-cyan-400", Icon: Headphones },
  consultivo: { cls: "border-indigo-500/15 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400", Icon: BookOpen },
};

export function CalendarWidget({ refreshKey }: { refreshKey?: number }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [eventMap, setEventMap] = useState<Record<string, DayEvent[]>>({});
  const [loading, setLoading] = useState(true);
  const [openItem, setOpenItem] = useState<{ type: AgendaType; id: string } | null>(null);

  const load = useCallback(async () => {
      if (!user?.office_id) return;
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split("T")[0];

      const [{ data: prazos }, { data: audiencias }, { data: tarefas }, { data: atendimentos }, { data: consultivos }] = await Promise.all([
        // fatal = data_fim_prazo OU, em prazo sem fim (ex.: criado inline no processo, que grava
        // data_vencimento), a data_vencimento — senão esse prazo some da agenda (igual useAgendaEvents).
        supabase.from("prazos").select("id, tipo_prazo, numero_processo, data_fim_prazo, data_vencimento, publicacoes(titulo)")
          .eq("office_id", user.office_id).neq("status", "concluido").eq("deletado", false)
          .or(`and(data_fim_prazo.gte.${start},data_fim_prazo.lte.${end}),and(data_fim_prazo.is.null,data_vencimento.gte.${start},data_vencimento.lte.${end})`),
        // realizada/cancelada saem do painel — aqui é "o que tenho pela frente"
        supabase.from("audiencias").select("id, titulo, data_audiencia")
          .eq("office_id", user.office_id).eq("deletado", false)
          .not("status", "in", "(cancelada,realizada)")
          .gte("data_audiencia", start).lte("data_audiencia", end),
        // tarefas não têm office_id — a RLS já limita ao escritório/usuário
        supabase.from("tarefas").select("id, titulo, data_vencimento, concluida")
          .eq("deletado", false).eq("concluida", false)
          .gte("data_vencimento", start).lte("data_vencimento", end),
        // atendimentos agendados (sem office_id — RLS limita)
        supabase.from("atendimentos").select("id, tipo_atendimento, data_atendimento, status")
          .eq("deletado", false).eq("status", "agendado")
          .gte("data_atendimento", start).lte("data_atendimento", end),
        // consultivos com prazo definido (que não estejam concluídos)
        supabase.from("consultivos").select("id, titulo, prazo, status")
          .eq("office_id", user.office_id).eq("deletado", false)
          .neq("status", "concluido")
          .gte("prazo", start).lte("prazo", end),
      ]);

      const map: Record<string, DayEvent[]> = {};
      for (const p of (prazos as any[]) || []) {
        const fatal = p.data_fim_prazo || p.data_vencimento;
        if (!fatal) continue;
        const k = String(fatal).slice(0, 10);
        if (!map[k]) map[k] = [];
        map[k].push({ type: "prazo", id: p.id, titulo: p.publicacoes?.titulo || p.tipo_prazo || p.numero_processo || "Prazo" });
      }
      for (const a of audiencias || []) {
        if (!a.data_audiencia) continue;
        const k = a.data_audiencia.split("T")[0];
        if (!map[k]) map[k] = [];
        map[k].push({ type: "audiencia", id: a.id, titulo: a.titulo || "Audiência", hora: a.data_audiencia.split("T")[1]?.slice(0, 5) });
      }
      for (const t of (tarefas as any[]) || []) {
        if (!t.data_vencimento) continue;
        const k = t.data_vencimento.split("T")[0];
        if (!map[k]) map[k] = [];
        map[k].push({ type: "tarefa", id: t.id, titulo: t.titulo || "Tarefa" });
      }
      for (const at of (atendimentos as any[]) || []) {
        if (!at.data_atendimento) continue;
        const k = at.data_atendimento.split("T")[0];
        if (!map[k]) map[k] = [];
        map[k].push({ type: "atendimento", id: at.id, titulo: at.tipo_atendimento || "Atendimento", hora: at.data_atendimento.split("T")[1]?.slice(0, 5) });
      }
      for (const co of (consultivos as any[]) || []) {
        if (!co.prazo) continue;
        const k = co.prazo.split("T")[0];
        if (!map[k]) map[k] = [];
        map[k].push({ type: "consultivo", id: co.id, titulo: co.titulo || "Consultivo" });
      }
      setEventMap(map);
      setLoading(false);
  }, [user?.office_id]);

  // recarrega no mount, ao trocar de escritório E quando o dashboard sinaliza criação (refreshKey)
  useEffect(() => { load(); }, [load, refreshKey]);

  const markedDates = Object.keys(eventMap).map(k => parseISO(k));
  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : null;
  const dayEvents = selectedKey ? eventMap[selectedKey] || [] : [];

  // Próximos eventos (a partir de hoje) — para preencher o painel quando o dia está vazio
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const upcoming = Object.entries(eventMap)
    .filter(([k]) => k >= todayKey)
    .flatMap(([k, evs]) => (evs as DayEvent[]).map((e) => ({ ...e, dateKey: k })))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(0, 6);

  return (
    <div className="p-4 space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-1">
        <CalendarDays className="h-4 w-4 text-primary" />
        <span className="text-sm font-black">Agenda</span>
        {!loading && Object.keys(eventMap).length > 0 && (
          <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-primary/60">
            {Object.keys(eventMap).length} dia{Object.keys(eventMap).length > 1 ? 's' : ''} com eventos
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Calendário */}
        <Calendar
          mode="single"
          selected={selected}
          onSelect={setSelected}
          locale={ptBR}
          className="w-full rounded-xl border border-black/5 dark:border-border p-3"
          // células fluidas (flex-1) e mais altas — o calendário ocupa a coluna inteira
          classNames={{
            months: "flex flex-col w-full",
            month: "space-y-4 w-full",
            table: "w-full border-collapse",
            head_row: "flex w-full",
            head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: "h-10 flex-1 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
            day: "h-10 w-full p-0 font-normal inline-flex items-center justify-center text-sm rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground aria-selected:opacity-100",
          }}
          modifiers={{ hasEvents: markedDates }}
          modifiersClassNames={{
            hasEvents: "font-black text-primary after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary after:content-[''] relative",
          }}
        />

        {/* Eventos do dia selecionado */}
        {selected && (
          <div className="space-y-1.5 md:border-l md:border-black/5 md:dark:border-border md:pl-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 px-1">
              {format(selected, "dd 'de' MMMM", { locale: ptBR })}
            </p>
            {dayEvents.length === 0 ? (
              upcoming.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 px-1 pt-1">Próximos eventos</p>
                  {upcoming.map((e, i) => {
                    const st = EVENT_STYLE[e.type];
                    return (
                      <button key={i} onClick={() => setOpenItem({ type: e.type, id: e.id })}
                        className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs text-left hover:brightness-95 dark:hover:brightness-125 transition-all", st.cls)}>
                        <st.Icon className="h-3 w-3 shrink-0" />
                        <span className="font-semibold truncate flex-1">{e.titulo}</span>
                        <span className="text-[10px] opacity-60 shrink-0">{format(parseISO(e.dateKey), "dd/MM")}{e.hora ? ` ${e.hora}` : ""}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-8 gap-2 text-muted-foreground/40">
                  <CalendarDays className="h-7 w-7 opacity-50" />
                  <p className="text-xs font-semibold">Sem eventos nesta data</p>
                </div>
              )
            ) : (
              dayEvents.map((e, i) => {
                const st = EVENT_STYLE[e.type];
                return (
                  <button key={i} onClick={() => setOpenItem({ type: e.type, id: e.id })}
                    className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs text-left hover:brightness-95 dark:hover:brightness-125 transition-all", st.cls)}>
                    <st.Icon className="h-3 w-3 shrink-0" />
                    <span className="font-semibold truncate flex-1">{e.titulo}</span>
                    {e.hora && <span className="text-[10px] opacity-60 shrink-0">{e.hora}</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <AgendaItemDialog item={openItem} onOpenChange={(o) => !o && setOpenItem(null)} onChanged={load} />
    </div>
  );
}
