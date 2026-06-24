import React from "react";
import { Search, X, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface PublicationFiltersProps {
  filters: {
    search: string;
    status: string;
    urgencia: string;
    cnj: string;
    dateRange: { from: Date | undefined; to: Date | undefined };
  };
  setFilters: (filters: any) => void;
  activeFiltersCount: number;
  onClear: () => void;
}

export const PublicationFilters = ({
  filters,
  setFilters,
  activeFiltersCount,
  onClear
}: PublicationFiltersProps) => {
  const getActiveQuickFilter = (): 'today' | 'week' | 'month' | null => {
    if (!filters.dateRange.from || !filters.dateRange.to) return null;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const fromStr = filters.dateRange.from.toDateString();
    if (fromStr === todayStart.toDateString() && filters.dateRange.to.toDateString() === todayEnd.toDateString()) return 'today';
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    if (fromStr === monthStart.toDateString()) return 'month';
    return 'week';
  };
  const activeQuick = getActiveQuickFilter();

  const handleQuickFilter = (period: 'today' | 'week' | 'month') => {
    // Toggle off if already active
    if (activeQuick === period) {
      setFilters({ ...filters, dateRange: { from: undefined, to: undefined } });
      return;
    }
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    if (period === 'week') {
      // Segunda-feira da semana atual
      const day = from.getDay(); // 0=dom,1=seg,...,6=sab
      const daysToMon = day === 0 ? 6 : day - 1;
      from.setDate(from.getDate() - daysToMon);
    } else if (period === 'month') {
      from.setDate(1);
    }
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    setFilters({ ...filters, dateRange: { from, to } });
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Quick Filters Row */}
      <div className="flex flex-wrap items-center gap-2 px-2">
        {(['today', 'week', 'month'] as const).map(period => {
          const labels = { today: 'Hoje', week: 'Esta Semana', month: 'Este Mês' };
          const isActive = activeQuick === period;
          return (
            <Button
              key={period}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleQuickFilter(period)}
              className={cn(
                "rounded-xl h-8 px-4 font-black text-[10px] uppercase tracking-widest transition-all",
                isActive ? "bg-primary text-primary-foreground shadow-md" : "border-primary/20 hover:bg-primary/10"
              )}
            >
              {labels[period]}
            </Button>
          );
        })}
      </div>

      {/* Main Filter Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 glass-morphism p-3 rounded-[2rem] border-border bg-card/10 backdrop-blur-sm">
        <div className="relative group flex-1 md:min-w-[300px]">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-primary/40 h-5 w-5 transition-colors group-focus-within:text-primary" />
          <Input 
            placeholder="Busca rápida por termo ou resumo..." 
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-12 h-12 bg-background/50 border-input rounded-2xl focus:ring-primary/20 placeholder:text-muted-foreground/50 transition-all font-medium"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filters.status} onValueChange={(val) => setFilters({ ...filters, status: val })}>
            <SelectTrigger className="w-[140px] h-12 bg-background/50 border-input rounded-2xl font-bold text-xs uppercase tracking-wider">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-background border-border rounded-xl">
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="nova">Novas</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="lida">Tratadas</SelectItem>
              <SelectItem value="arquivada">Arquivadas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.urgencia} onValueChange={(val) => setFilters({ ...filters, urgencia: val })}>
            <SelectTrigger className="w-[140px] h-12 bg-background/50 border-input rounded-2xl font-bold text-xs uppercase tracking-wider">
              <SelectValue placeholder="Urgência" />
            </SelectTrigger>
            <SelectContent className="bg-background border-border rounded-xl">
              <SelectItem value="all">Todas Urgências</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-12 bg-background/50 border-input rounded-2xl px-4 flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                <CalendarIcon className="h-4 w-4 text-primary/60" />
                {filters.dateRange.from ? (
                  filters.dateRange.to ? (
                    <>
                      {format(filters.dateRange.from, "dd/MM")} - {format(filters.dateRange.to, "dd/MM")}
                    </>
                  ) : format(filters.dateRange.from, "dd/MM")
                ) : (
                  <span>Período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-border rounded-2xl overflow-hidden shadow-2xl" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={filters.dateRange.from}
                selected={{ from: filters.dateRange.from, to: filters.dateRange.to }}
                onSelect={(range) => setFilters({ ...filters, dateRange: range || { from: undefined, to: undefined } })}
                numberOfMonths={2}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          {activeFiltersCount > 0 && (
            <Button 
              variant="ghost" 
              onClick={onClear}
              className="h-12 px-4 rounded-2xl hover:bg-red-500/10 text-red-500 font-bold text-xs uppercase tracking-wider flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Limpar ({activeFiltersCount})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
