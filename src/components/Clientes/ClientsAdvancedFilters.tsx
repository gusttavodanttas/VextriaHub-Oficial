
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ClientsAdvancedFiltersProps {
  onFiltersChange: (filters: any) => void;
  onClearFilters: () => void;
}

export const ClientsAdvancedFilters = ({ onFiltersChange, onClearFilters }: ClientsAdvancedFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState({
    tipoPessoa: "",
    origem: "",
    status: "",
    dataInicioFrom: undefined as Date | undefined,
    dataInicioTo: undefined as Date | undefined,
    hasProcessos: "",
    hasAtendimentos: ""
  });

  const origensCliente = [
    "Indicação",
    "Site",
    "Redes Sociais",
    "Marketing Digital",
    "Parcerias",
    "Evento",
    "Outros"
  ];

  const statusCliente = [
    "ativo",
    "inativo",
    "prospecto",
    "ex-cliente"
  ];

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleClearFilters = () => {
    const emptyFilters = {
      tipoPessoa: "",
      origem: "",
      status: "",
      dataInicioFrom: undefined,
      dataInicioTo: undefined,
      hasProcessos: "",
      hasAtendimentos: ""
    };
    setFilters(emptyFilters);
    onFiltersChange(emptyFilters);
    onClearFilters();
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== "" && value !== undefined
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className={cn(
            "relative h-12 px-6 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all duration-300 shadow-premium",
            hasActiveFilters 
              ? "bg-primary/5 border-primary/20 text-primary shadow-lg shadow-primary/5" 
              : "glass-card border-black/5 dark:border-white/10 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5"
          )}
        >
          <Filter className={cn("h-4 w-4 mr-2", hasActiveFilters ? "text-primary" : "text-muted-foreground/40")} />
          Filtros Avançados
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full ring-2 ring-background animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-6 rounded-[2rem] bg-white/95 dark:bg-card/95 backdrop-blur-2xl border-black/5 dark:border-white/10 shadow-premium" align="end">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black uppercase tracking-widest text-primary">Filtros Avançados</h4>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-destructive/10 hover:text-destructive transition-all"
              >
                Limpar
              </Button>
            )}
          </div>

          <div className="grid gap-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Tipo de Pessoa</Label>
              <Select
                value={filters.tipoPessoa}
                onValueChange={(value) => handleFilterChange("tipoPessoa", value)}
              >
                <SelectTrigger className="h-11 rounded-xl bg-black/[0.02] dark:bg-white/[0.05] border-black/5 dark:border-white/10 font-bold text-xs shadow-inner">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-black/10 dark:border-white/10 shadow-2xl">
                  <SelectItem value="" className="font-bold text-xs">Todos os tipos</SelectItem>
                  <SelectItem value="fisica" className="font-bold text-xs">Pessoa Física</SelectItem>
                  <SelectItem value="juridica" className="font-bold text-xs">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Origem do Cliente</Label>
              <Select
                value={filters.origem}
                onValueChange={(value) => handleFilterChange("origem", value)}
              >
                <SelectTrigger className="h-11 rounded-xl bg-black/[0.02] dark:bg-white/[0.05] border-black/5 dark:border-white/10 font-bold text-xs shadow-inner">
                  <SelectValue placeholder="Todas as origens" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-black/10 dark:border-white/10 shadow-2xl">
                  <SelectItem value="" className="font-bold text-xs">Todas as origens</SelectItem>
                  {origensCliente.map((origem) => (
                    <SelectItem key={origem} value={origem} className="font-bold text-xs">
                      {origem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Status de Gestão</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger className="h-11 rounded-xl bg-black/[0.02] dark:bg-white/[0.05] border-black/5 dark:border-white/10 font-bold text-xs shadow-inner">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-black/10 dark:border-white/10 shadow-2xl">
                  <SelectItem value="" className="font-bold text-xs">Todos os status</SelectItem>
                  {statusCliente.map((status) => (
                    <SelectItem key={status} value={status} className="font-bold text-xs">
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Período de Cadastro</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 h-11 rounded-xl bg-black/[0.02] dark:bg-white/[0.05] border-black/5 dark:border-white/10 justify-start text-left font-bold text-xs shadow-inner",
                        !filters.dataInicioFrom && "text-muted-foreground/40"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />
                      {filters.dataInicioFrom ? format(filters.dataInicioFrom, "dd/MM/yy") : "Início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-black/10 dark:border-white/10 shadow-2xl">
                    <Calendar
                      mode="single"
                      selected={filters.dataInicioFrom}
                      onSelect={(date) => handleFilterChange("dataInicioFrom", date)}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 h-11 rounded-xl bg-black/[0.02] dark:bg-white/[0.05] border-black/5 dark:border-white/10 justify-start text-left font-bold text-xs shadow-inner",
                        !filters.dataInicioTo && "text-muted-foreground/40"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />
                      {filters.dataInicioTo ? format(filters.dataInicioTo, "dd/MM/yy") : "Fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-black/10 dark:border-white/10 shadow-2xl">
                    <Calendar
                      mode="single"
                      selected={filters.dataInicioTo}
                      onSelect={(date) => handleFilterChange("dataInicioTo", date)}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
