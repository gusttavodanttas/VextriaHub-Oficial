import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DayEvent {
  type: "prazo" | "audiencia";
  titulo: string;
  hora?: string;
}

export function CalendarWidget() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [eventMap, setEventMap] = useState<Record<string, DayEvent[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.office_id) return;
    const load = async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split("T")[0];

      const [{ data: prazos }, { data: audiencias }] = await Promise.all([
        supabase.from("prazos").select("tipo_prazo, numero_processo, data_fim_prazo, publicacoes(titulo)")
          .eq("office_id", user.office_id)
          .gte("data_fim_prazo", start).lte("data_fim_prazo", end),
        supabase.from("audiencias").select("titulo, data_audiencia")
          .eq("office_id", user.office_id).eq("deletado", false)
          .gte("data_audiencia", start).lte("data_audiencia", end),
      ]);

      const map: Record<string, DayEvent[]> = {};
      for (const p of (prazos as any[]) || []) {
        if (!p.data_fim_prazo) continue;
        const k = p.data_fim_prazo;
        if (!map[k]) map[k] = [];
        map[k].push({ type: "prazo", titulo: p.publicacoes?.titulo || p.tipo_prazo || p.numero_processo || "Prazo" });
      }
      for (const a of audiencias || []) {
        if (!a.data_audiencia) continue;
        const k = a.data_audiencia.split("T")[0];
        if (!map[k]) map[k] = [];
        map[k].push({ type: "audiencia", titulo: a.titulo || "Audiência", hora: a.data_audiencia.split("T")[1]?.slice(0, 5) });
      }
      setEventMap(map);
      setLoading(false);
    };
    load();
  }, [user?.office_id]);

  const markedDates = Object.keys(eventMap).map(k => parseISO(k));
  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : null;
  const dayEvents = selectedKey ? eventMap[selectedKey] || [] : [];

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
          className="w-full rounded-xl border border-black/5 dark:border-border p-2"
          modifiers={{ hasEvents: markedDates }}
          modifiersClassNames={{
            hasEvents: "font-black text-primary after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary after:content-[''] relative",
          }}
        />

        {/* Eventos do dia selecionado */}
        {selected && (
          <div className="space-y-1.5 md:border-l md:border-black/5 md:dark:border-border md:pl-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 px-1">
              {format(selected, "dd 'de' MMMM", { locale: ptBR })}
            </p>
            {dayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-8 gap-2 text-muted-foreground/40">
                <CalendarDays className="h-7 w-7 opacity-50" />
                <p className="text-xs font-semibold">Sem eventos nesta data</p>
              </div>
            ) : (
              dayEvents.map((e, i) => (
                <div key={i} className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs",
                  e.type === "prazo"
                    ? "border-rose-500/15 bg-rose-500/5 text-rose-600 dark:text-rose-400"
                    : "border-orange-500/15 bg-orange-500/5 text-orange-600 dark:text-orange-400"
                )}>
                  {e.type === "prazo"
                    ? <AlertCircle className="h-3 w-3 shrink-0" />
                    : <Clock className="h-3 w-3 shrink-0" />
                  }
                  <span className="font-semibold truncate flex-1">{e.titulo}</span>
                  {e.hora && <span className="text-[10px] opacity-60 shrink-0">{e.hora}</span>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
