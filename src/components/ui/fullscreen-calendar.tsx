"use client"

import * as React from "react"
import {
  add,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isEqual,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfToday,
  startOfWeek,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusCircleIcon,
  SearchIcon,
  Clock,
  MapPin,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Badge } from "@/components/ui/badge"

interface Event {
  id: number
  name: string
  time: string
  datetime: string
  type?: "audiencia" | "reuniao" | "prazo" | "tarefa"
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
  onEventTypeFilter?: (type: string) => void
  onMonthChange?: (date: Date) => void
}

const colStartClasses = [
  "",
  "col-start-2",
  "col-start-3",
  "col-start-4",
  "col-start-5",
  "col-start-6",
  "col-start-7",
]

const getEventTypeColor = (type?: string) => {
  switch (type) {
    case "audiencia": return "bg-red-100 text-red-800 border-red-200"
    case "reuniao": return "bg-blue-100 text-blue-800 border-blue-200"
    case "prazo": return "bg-orange-100 text-orange-800 border-orange-200"
    case "tarefa": return "bg-green-100 text-green-800 border-green-200"
    default: return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

const getEventStatusDot = (status?: string) => {
  switch (status) {
    case "confirmado": return "bg-green-500"
    case "pendente": return "bg-yellow-500"
    case "cancelado": return "bg-red-500"
    default: return "bg-gray-500"
  }
}

// Função auxiliar para validar se uma data é válida
const isValidDate = (date: Date): boolean => {
  return date instanceof Date && !isNaN(date.getTime())
}

export function FullScreenCalendar({ 
  data = [], 
  onEventClick, 
  onNewEvent,
  onEventTypeFilter,
  onMonthChange 
}: FullScreenCalendarProps) {
  const today = startOfToday()
  const [selectedDay, setSelectedDay] = React.useState(today)
  // Usar Date diretamente em vez de string para evitar conversões problemáticas
  const [currentDate, setCurrentDate] = React.useState(today)
  const isDesktop = useMediaQuery("(min-width: 768px)")

  // Garantir que currentDate seja sempre válido
  const firstDayCurrentMonth = React.useMemo(() => {
    if (!isValidDate(currentDate)) {
      console.warn('Data inválida detectada, usando data atual como fallback')
      return today
    }
    return currentDate
  }, [currentDate, today])

  // Notificar mudança de mês
  React.useEffect(() => {
    if (isValidDate(firstDayCurrentMonth)) {
      onMonthChange?.(firstDayCurrentMonth)
    }
  }, [firstDayCurrentMonth, onMonthChange])

  const days = eachDayOfInterval({
    start: startOfWeek(firstDayCurrentMonth, { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(firstDayCurrentMonth), { weekStartsOn: 0 }),
  })

  function previousMonth() {
    try {
      const previousMonthDate = add(firstDayCurrentMonth, { months: -1 })
      if (isValidDate(previousMonthDate)) {
        setCurrentDate(previousMonthDate)
      } else {
        console.error('Erro ao calcular mês anterior, mantendo data atual')
      }
    } catch (error) {
      console.error('Erro na navegação do mês anterior:', error)
    }
  }

  function nextMonth() {
    try {
      const nextMonthDate = add(firstDayCurrentMonth, { months: 1 })
      if (isValidDate(nextMonthDate)) {
        setCurrentDate(nextMonthDate)
      } else {
        console.error('Erro ao calcular próximo mês, mantendo data atual')
      }
    } catch (error) {
      console.error('Erro na navegação do próximo mês:', error)
    }
  }

  function goToToday() {
    try {
      if (isValidDate(today)) {
        setCurrentDate(today)
        setSelectedDay(today)
      }
    } catch (error) {
      console.error('Erro ao navegar para hoje:', error)
    }
  }

  const selectedDayEvents = data?.find(d => isSameDay(d.day, selectedDay))?.events || []

  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* Calendar Header */}
      <div className="flex flex-col space-y-4 p-4 md:flex-row md:items-center md:justify-between md:space-y-0 lg:flex-none border-b">
        <div className="flex flex-auto">
          <div className="flex items-center gap-4">
            <div className="hidden w-20 flex-col items-center justify-center rounded-lg border bg-muted p-0.5 md:flex">
              <h1 className="p-1 text-xs uppercase text-muted-foreground">
                {format(today, "MMM", { locale: ptBR })}
              </h1>
              <div className="flex w-full items-center justify-center rounded-lg border bg-background p-0.5 text-lg font-bold">
                <span>{format(today, "d")}</span>
              </div>
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold text-foreground">
                {format(firstDayCurrentMonth, "MMMM, yyyy", { locale: ptBR })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {format(firstDayCurrentMonth, "d 'de' MMM", { locale: ptBR })} -{" "}
                {format(endOfMonth(firstDayCurrentMonth), "d 'de' MMM, yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 md:flex-row md:gap-6">
          <Button variant="outline" size="icon" className="hidden lg:flex">
            <SearchIcon size={16} strokeWidth={2} aria-hidden="true" />
          </Button>

          <Separator orientation="vertical" className="hidden h-6 lg:block" />

          <div className="inline-flex w-full -space-x-px rounded-lg shadow-sm shadow-black/5 md:w-auto rtl:space-x-reverse">
            <Button
              onClick={previousMonth}
              className="rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10"
              variant="outline"
              size="icon"
              aria-label="Mês anterior"
            >
              <ChevronLeftIcon size={16} strokeWidth={2} aria-hidden="true" />
            </Button>
            <Button
              onClick={goToToday}
              className="w-full rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10 md:w-auto"
              variant="outline"
            >
              Hoje
            </Button>
            <Button
              onClick={nextMonth}
              className="rounded-none shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10"
              variant="outline"
              size="icon"
              aria-label="Próximo mês"
            >
              <ChevronRightIcon size={16} strokeWidth={2} aria-hidden="true" />
            </Button>
          </div>

          <Separator orientation="vertical" className="hidden h-6 md:block" />
          <Separator
            orientation="horizontal"
            className="block w-full md:hidden"
          />

          <Button 
            className="w-full gap-2 md:w-auto"
            onClick={() => onNewEvent?.(selectedDay)}
          >
            <PlusCircleIcon size={16} strokeWidth={2} aria-hidden="true" />
            <span>Novo Compromisso</span>
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="lg:flex lg:flex-auto lg:flex-col">
        {/* Week Days Header */}
        <div className="grid grid-cols-7 border text-center text-xs font-semibold leading-6 lg:flex-none">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
            <div key={day} className={`border-r py-2.5 ${index === 6 ? 'border-r-0' : ''}`}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="flex text-xs leading-6 lg:flex-auto">
          <div className="hidden w-full border-x lg:grid lg:grid-cols-7 lg:grid-rows-6">
            {days.map((day, dayIdx) => {
              const dayEvents = data?.find(d => isSameDay(d.day, day))?.events || []
              
              return (
                <div
                  key={dayIdx}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    dayIdx === 0 && colStartClasses[getDay(day)],
                    !isEqual(day, selectedDay) &&
                      !isToday(day) &&
                      !isSameMonth(day, firstDayCurrentMonth) &&
                      "bg-accent/50 text-muted-foreground",
                    "relative flex flex-col border-b border-r hover:bg-muted focus:z-10 cursor-pointer min-h-[120px]",
                    !isEqual(day, selectedDay) && "hover:bg-accent/75",
                    isEqual(day, selectedDay) && "ring-2 ring-primary ring-inset",
                  )}
                >
                  <header className="flex items-center justify-between p-2">
                    <button
                      type="button"
                      className={cn(
                        isEqual(day, selectedDay) && "text-primary-foreground",
                        !isEqual(day, selectedDay) &&
                          !isToday(day) &&
                          isSameMonth(day, firstDayCurrentMonth) &&
                          "text-foreground",
                        !isEqual(day, selectedDay) &&
                          !isToday(day) &&
                          !isSameMonth(day, firstDayCurrentMonth) &&
                          "text-muted-foreground",
                        isEqual(day, selectedDay) &&
                          isToday(day) &&
                          "border-none bg-primary",
                        isToday(day) &&
                          !isEqual(day, selectedDay) &&
                          "bg-primary text-primary-foreground",
                        isEqual(day, selectedDay) &&
                          !isToday(day) &&
                          "bg-primary text-primary-foreground",
                        (isEqual(day, selectedDay) || isToday(day)) &&
                          "font-semibold",
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs hover:border",
                      )}
                    >
                      <time dateTime={format(day, "yyyy-MM-dd")}>
                        {format(day, "d")}
                      </time>
                    </button>
                  </header>
                  <div className="flex-1 p-1 space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick?.(event)
                        }}
                        className={cn(
                          "flex items-center gap-1 rounded-sm border p-1 text-xs leading-tight cursor-pointer hover:opacity-80 transition-opacity",
                          getEventTypeColor(event.type)
                        )}
                      >
                        <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", getEventStatusDot(event.status))} />
                        <div className="truncate">
                          <p className="font-medium leading-none truncate">
                            {event.name}
                          </p>
                          <p className="leading-none text-[10px] opacity-70">
                            {event.time}
                          </p>
                        </div>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayEvents.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mobile Calendar */}
          <div className="isolate grid w-full grid-cols-7 grid-rows-6 border-x lg:hidden">
            {days.map((day, dayIdx) => {
              const dayEvents = data?.find(d => isSameDay(d.day, day))?.events || []
              
              return (
                <button
                  onClick={() => setSelectedDay(day)}
                  key={dayIdx}
                  type="button"
                  className={cn(
                    isEqual(day, selectedDay) && "text-primary-foreground",
                    !isEqual(day, selectedDay) &&
                      !isToday(day) &&
                      isSameMonth(day, firstDayCurrentMonth) &&
                      "text-foreground",
                    !isEqual(day, selectedDay) &&
                      !isToday(day) &&
                      !isSameMonth(day, firstDayCurrentMonth) &&
                      "text-muted-foreground",
                    (isEqual(day, selectedDay) || isToday(day)) &&
                      "font-semibold",
                    "flex h-14 flex-col border-b border-r px-3 py-2 hover:bg-muted focus:z-10",
                  )}
                >
                  <time
                    dateTime={format(day, "yyyy-MM-dd")}
                    className={cn(
                      "ml-auto flex size-6 items-center justify-center rounded-full",
                      isEqual(day, selectedDay) &&
                        isToday(day) &&
                        "bg-primary text-primary-foreground",
                      isToday(day) &&
                        !isEqual(day, selectedDay) &&
                        "bg-primary text-primary-foreground",
                      isEqual(day, selectedDay) &&
                        !isToday(day) &&
                        "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </time>
                  {dayEvents.length > 0 && (
                    <div className="-mx-0.5 mt-auto flex flex-wrap-reverse">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          className={cn(
                            "mx-0.5 mt-1 h-1.5 w-1.5 rounded-full",
                            getEventStatusDot(event.status)
                          )}
                        />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Selected Day Events Panel - Mobile Only */}
      {selectedDayEvents.length > 0 && !isDesktop && (
        <div className="border-t bg-background p-4">
          <h3 className="font-semibold mb-3">
            Compromissos - {format(selectedDay, "d 'de' MMMM", { locale: ptBR })}
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {selectedDayEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => onEventClick?.(event)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors",
                  getEventTypeColor(event.type)
                )}
              >
                <div className={cn("w-2 h-2 rounded-full mt-1 flex-shrink-0", getEventStatusDot(event.status))} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{event.name}</div>
                  <div className="flex items-center gap-2 text-xs opacity-70 mt-1">
                    <Clock className="h-3 w-3" />
                    {event.time}
                    {event.location && (
                      <>
                        <MapPin className="h-3 w-3 ml-1" />
                        <span className="truncate">{event.location}</span>
                      </>
                    )}
                  </div>
                  {event.client && (
                    <div className="text-xs opacity-60 mt-1 truncate">
                      {event.client}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 