import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, Clock, AlertCircle, CheckSquare, Headphones, BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AgendaItemDialog, AgendaType } from "@/components/Dashboard/AgendaItemDialog";
import { atrasoLabel } from "@/lib/atraso";

// Quantos meses para trás o painel carrega itens vencidos e ainda pendentes.
// É um painel de resumo: o recuo cobre o caso real ("não concluí ontem / semana
// passada") sem virar histórico. A lista completa está na Agenda.
const ATRASO_MESES_ATRAS = 2;

interface DayEvent {
  type: AgendaType;
  id: string;
  titulo: string;
  hora?: string;
  sub?: string; // nome da parte / número do processo (mostrado sob o título)
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
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [eventMap, setEventMap] = useState<Record<string, DayEvent[]>>({});
  const [loading, setLoading] = useState(true);
  const [openItem, setOpenItem] = useState<{ type: AgendaType; id: string } | null>(null);

  const load = useCallback(async () => {
      if (!user?.office_id) return;
      const now = new Date();
      // Janela: 2 meses ATRÁS até o fim do mês que vem. O recuo existe para o bloco
      // "Atrasados" — antes a busca começava no dia 1 do mês corrente e o prazo que
      // venceu no fim do mês passado não era nem carregado. As consultas abaixo já
      // filtram por pendente (não concluído / não realizado), então o recuo não traz
      // histórico resolvido. A visão completa dos atrasados fica na Agenda.
      const start = new Date(now.getFullYear(), now.getMonth() - ATRASO_MESES_ATRAS, 1).toISOString().split("T")[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split("T")[0];

      const [{ data: prazos }, { data: audiencias }, { data: tarefas }, { data: atendimentos }, { data: consultivos }] = await Promise.all([
        // fatal = data_fim_prazo OU, em prazo sem fim (ex.: criado inline no processo, que grava
        // data_vencimento), a data_vencimento — senão esse prazo some da agenda (igual useAgendaEvents).
        supabase.from("prazos").select("id, titulo, tipo_prazo, numero_processo, processo_id, data_fim_prazo, data_vencimento, publicacoes(titulo)")
          .eq("office_id", user.office_id).neq("status", "concluido").eq("deletado", false)
          .or(`and(data_fim_prazo.gte.${start},data_fim_prazo.lte.${end}),and(data_fim_prazo.is.null,data_vencimento.gte.${start},data_vencimento.lte.${end})`),
        // realizada/cancelada saem do painel — aqui é "o que tenho pela frente".
        // Puxa cliente (nome da parte) e processo_id (nº do processo vem no map abaixo).
        supabase.from("audiencias").select("id, titulo, data_audiencia, processo_id, clientes!cliente_id(nome)")
          .eq("office_id", user.office_id).eq("deletado", false)
          .not("status", "in", "(cancelada,realizada)")
          .gte("data_audiencia", start).lte("data_audiencia", end),
        // tarefas TÊM office_id — a RLS por si só não restringe a UM escritório
        // (cobre todo escritório em que o usuário está ativo, mais compartilhados),
        // então sem este filtro um usuário de dois escritórios via tarefas do outro aqui.
        supabase.from("tarefas").select("id, titulo, data_vencimento, concluida")
          .eq("office_id", user.office_id).eq("deletado", false).eq("concluida", false)
          .gte("data_vencimento", start).lte("data_vencimento", end),
        // idem atendimentos — e "agendado" sozinho excluía "pendente" (status real e
        // distinto, ver Atendimentos.tsx); troca pela mesma lista de exclusão das audiências.
        supabase.from("atendimentos").select("id, tipo_atendimento, data_atendimento, status")
          .eq("office_id", user.office_id).eq("deletado", false)
          .not("status", "in", "(cancelado,realizado)")
          .gte("data_atendimento", start).lte("data_atendimento", end),
        // consultivos com prazo definido (que não estejam concluídos)
        supabase.from("consultivos").select("id, titulo, prazo, status")
          .eq("office_id", user.office_id).eq("deletado", false)
          .neq("status", "concluido")
          .gte("prazo", start).lte("prazo", end),
      ]);

      // Cliente + nº do processo (prazo E audiência costumam vir ligados só por
      // processo_id, sem número/cliente próprios) → resolve tudo pelo processo. (v11)
      const allProcIds = Array.from(new Set([
        ...(((prazos as any[]) || []).map(p => p.processo_id)),
        ...(((audiencias as any[]) || []).map(a => a.processo_id)),
      ].filter(Boolean)));
      let procMap: Record<string, { numero?: string; cliente?: string }> = {};
      if (allProcIds.length) {
        const { data: procs } = await supabase.from("processos").select("id, numero_processo, parte_autora, clientes!cliente_id(nome)").in("id", allProcIds);
        procMap = Object.fromEntries(((procs as any[]) || []).map(p => [p.id, { numero: p.numero_processo, cliente: p.clientes?.nome || p.parte_autora || undefined }]));
      }

      const map: Record<string, DayEvent[]> = {};
      for (const p of (prazos as any[]) || []) {
        const fatal = p.data_fim_prazo || p.data_vencimento;
        if (!fatal) continue;
        const k = String(fatal).slice(0, 10);
        if (!map[k]) map[k] = [];
        const info = p.processo_id ? procMap[p.processo_id] : undefined;
        const numero = p.numero_processo || info?.numero;
        map[k].push({
          type: "prazo", id: p.id, titulo: p.titulo || p.publicacoes?.titulo || p.tipo_prazo || p.numero_processo || "Prazo",
          sub: [info?.cliente, numero].filter(Boolean).join(" · ") || undefined,
        });
      }
      for (const a of (audiencias as any[]) || []) {
        if (!a.data_audiencia) continue;
        // data_audiencia é timestamptz → converter pro fuso LOCAL (o split cru mostrava UTC, hora errada).
        const d = new Date(a.data_audiencia);
        const k = format(d, "yyyy-MM-dd");
        if (!map[k]) map[k] = [];
        const info = a.processo_id ? procMap[a.processo_id] : undefined;
        const parte = (a.clientes?.nome as string | undefined) || info?.cliente; // audiência própria → processo
        const numero = info?.numero;
        map[k].push({
          type: "audiencia", id: a.id, titulo: a.titulo || "Audiência", hora: format(d, "HH:mm"),
          sub: [parte, numero].filter(Boolean).join(" · ") || undefined,
        });
      }
      for (const t of (tarefas as any[]) || []) {
        if (!t.data_vencimento) continue;
        const k = t.data_vencimento.split("T")[0];
        if (!map[k]) map[k] = [];
        map[k].push({ type: "tarefa", id: t.id, titulo: t.titulo || "Tarefa" });
      }
      for (const at of (atendimentos as any[]) || []) {
        if (!at.data_atendimento) continue;
        const d = new Date(at.data_atendimento); // timestamptz → fuso local (não o split cru = UTC)
        const k = format(d, "yyyy-MM-dd");
        if (!map[k]) map[k] = [];
        map[k].push({ type: "atendimento", id: at.id, titulo: at.tipo_atendimento || "Atendimento", hora: format(d, "HH:mm") });
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

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const comDia = (entries: [string, DayEvent[]][]) =>
    entries.flatMap(([k, evs]) => evs.map((e) => ({ ...e, dateKey: k })));

  // Próximos eventos (a partir de hoje) — para preencher o painel quando o dia está vazio
  const upcoming = comDia(Object.entries(eventMap).filter(([k]) => k >= todayKey))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(0, 6);

  // ATRASADOS: pendentes com data já vencida. Aparecem SEMPRE, acima de tudo —
  // antes o painel só olhava para frente (k >= hoje) e o prazo/tarefa que você
  // não concluiu ontem sumia do dashboard no dia seguinte, justamente quando
  // virava urgente. Mais recente primeiro ("venceu ontem" no topo).
  const atrasados = comDia(Object.entries(eventMap).filter(([k]) => k < todayKey))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  const atrasadosVisiveis = atrasados.slice(0, 4);

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

        {/* Coluna da direita: atrasados (sempre no topo) + o dia selecionado */}
        <div className="space-y-3 md:border-l md:border-black/5 md:dark:border-border md:pl-4">

        {atrasadosVisiveis.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 px-1 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" /> Atrasados
              <span className="opacity-50">· {atrasados.length}</span>
            </p>
            {atrasadosVisiveis.map((e, i) => {
              const st = EVENT_STYLE[e.type];
              return (
                <button key={`atr-${i}`} onClick={() => setOpenItem({ type: e.type, id: e.id })}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] text-rose-700 dark:text-rose-300 text-xs text-left hover:brightness-95 dark:hover:brightness-125 transition-all">
                  <st.Icon className="h-3 w-3 shrink-0" />
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="font-semibold truncate">{e.titulo}</span>
                    <span className="text-[10px] opacity-70 truncate">
                      {format(parseISO(e.dateKey), "dd/MM")} · {atrasoLabel(e.dateKey)}
                    </span>
                  </span>
                </button>
              );
            })}
            {atrasados.length > atrasadosVisiveis.length && (
              <button onClick={() => navigate("/agenda")}
                className="w-full text-[10px] font-black uppercase tracking-widest text-rose-600/70 dark:text-rose-400/70 hover:text-rose-600 dark:hover:text-rose-400 transition-colors py-1">
                + {atrasados.length - atrasadosVisiveis.length} na Agenda
              </button>
            )}
          </div>
        )}

        {selected && (
          <div className="space-y-1.5">
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
                        <span className="flex-1 min-w-0 flex flex-col">
                          <span className="font-semibold truncate">{e.titulo}</span>
                          {e.sub && <span className="text-[10px] opacity-60 truncate">{e.sub}</span>}
                        </span>
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
                    <span className="flex-1 min-w-0 flex flex-col">
                      <span className="font-semibold truncate">{e.titulo}</span>
                      {e.sub && <span className="text-[10px] opacity-60 truncate">{e.sub}</span>}
                    </span>
                    {e.hora && <span className="text-[10px] opacity-60 shrink-0">{e.hora}</span>}
                  </button>
                );
              })
            )}
          </div>
        )}

        </div>
      </div>

      <AgendaItemDialog item={openItem} onOpenChange={(o) => !o && setOpenItem(null)} onChanged={load} />
    </div>
  );
}
