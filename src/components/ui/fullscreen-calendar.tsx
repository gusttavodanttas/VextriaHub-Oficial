"use client"

import * as React from "react"
import {
  add,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isEqual,
  isSameDay,
  isSameMonth,
  isToday,
  startOfToday,
  startOfWeek,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeftIcon, ChevronRightIcon, PlusCircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface Event {
  id: number | string
  name: string
  time: string
  datetime: string
  type?: "audiencia" | "reuniao" | "atendimento" | "prazo" | "tarefa"
  client?: string
  location?: string
  status?: "confirmado" | "pendente" | "cancelado"
}

interface CalendarData {
  day: Date
  events: Event[]
}

interface FullScreenCalendarProps {
  data: CalendarData[]
  onEventClick?: (event: Event) => void
  onNewEvent?: (date: Date) => void
  onMonthChange?: (date: Date) => void
  onDayClick?: (date: Date) => void
}

const getEventTypeColor = (type?: string) => {
  switch (type) {
    case "audiencia": return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
    case "reuniao":
    case "atendimento": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
    case "prazo": return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
    case "tarefa": return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
    default: return "bg-muted text-muted-foreground border-border"
  }
}

const isValidDate = (date: Date): boolean => date instanceof Date && !isNaN(date.getTime())

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export function FullScreenCalendar({
  data = [],
  onEventClick,
  onNewEvent,
  onMonthChange,
  onDayClick,
}: FullScreenCalendarProps) {
  const today = startOfToday()
  const [selectedDay, setSelectedDay] = React.useState(today)
  const [currentDate, setCurrentDate] = React.useState(today)

  const firstDayCurrentMonth = isValidDate(currentDate) ? currentDate : today

  React.useEffect(() => {
    if (isValidDate(firstDayCurrentMonth)) onMonthChange?.(firstDayCurrentMonth)
  }, [firstDayCurrentMonth, onMonthChange])

  const days = eachDayOfInterval({
    start: startOfWeek(firstDayCurrentMonth, { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(firstDayCurrentMonth), { weekStartsOn: 0 }),
  })

  const previousMonth = () => setCurrentDate(add(firstDayCurrentMonth, { months: -1 }))
  const nextMonth = () => setCurrentDate(add(firstDayCurrentMonth, { months: 1 }))
  const goToToday = () => { setCurrentDate(today); setSelectedDay(today) }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-black/5 dark:border-border shrink-0">
        <div>
          <h2 className="text-lg font-black tracking-tight capitalize">
            {format(firstDayCurrentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
          <p className="text-xs text-muted-foreground font-medium">
            {data.reduce((sum, d) => sum + d.events.length, 0)} compromissos no mês
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-black/5 dark:border-border overflow-hidden">
            <Button onClick={previousMonth} variant="ghost" size="icon" className="rounded-none h-9 w-9" aria-label="Mês anterior">
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button onClick={goToToday} variant="ghost" className="rounded-none h-9 px-4 text-xs font-bold border-x border-black/5 dark:border-border">
              Hoje
            </Button>
            <Button onClick={nextMonth} variant="ghost" size="icon" className="rounded-none h-9 w-9" aria-label="Próximo mês">
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
          <Button className="h-9 gap-2 rounded-xl font-bold" onClick={() => onNewEvent?.(selectedDay)}>
            <PlusCircleIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Novo</span>
          </Button>
        </div>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 border-b border-black/5 dark:border-border shrink-0">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground/60">
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>

      {/* Grade do mês — responsiva, mesma para todos os tamanhos */}
      <div className="grid grid-cols-7">
        {days.map((day, dayIdx) => {
          const dayEvents = data?.find((d) => isSameDay(d.day, day))?.events || []
          const outside = !isSameMonth(day, firstDayCurrentMonth)
          const selected = isEqual(day, selectedDay)
          const maxShow = 3
          return (
            <div
              key={dayIdx}
              onClick={() => { setSelectedDay(day); onDayClick?.(day) }}
              className={cn(
                "relative flex flex-col gap-1 border-b border-r border-black/5 dark:border-border p-1.5 min-h-[92px] sm:min-h-[116px] lg:min-h-[132px] cursor-pointer transition-colors",
                outside ? "bg-muted/20 text-muted-foreground/50" : "hover:bg-muted/40",
                selected && "bg-primary/[0.04] ring-1 ring-inset ring-primary/30",
                dayIdx % 7 === 6 && "border-r-0",
              )}
            >
              <time
                dateTime={format(day, "yyyy-MM-dd")}
                className={cn(
                  "ml-auto flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0",
                  isToday(day) && "bg-primary text-primary-foreground",
                  selected && !isToday(day) && "bg-primary/15 text-primary",
                )}
              >
                {format(day, "d")}
              </time>

              <div className="flex flex-col gap-1 overflow-hidden">
                {dayEvents.slice(0, maxShow).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEventClick?.(event) }}
                    className={cn(
                      "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-left hover:brightness-95 transition-all",
                      getEventTypeColor(event.type),
                    )}
                    title={`${event.time !== "—" ? event.time + " · " : ""}${event.name}`}
                  >
                    <span className="truncate text-[10px] leading-tight font-semibold">
                      {event.time !== "—" && <span className="opacity-70 mr-0.5 hidden sm:inline">{event.time}</span>}
                      {event.name}
                    </span>
                  </button>
                ))}
                {dayEvents.length > maxShow && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDayClick?.(day) }}
                    className="text-left text-[10px] font-bold text-primary hover:underline px-1"
                  >
                    +{dayEvents.length - maxShow} mais
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
