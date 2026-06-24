import React from 'react';
import { Filter, Calendar, User, Scale, Hash } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ProcessoFilters as IProcessoFilters, statusProcesso, areasJuridicas } from '@/types/processo';

interface ProcessoFiltersProps {
  filters: IProcessoFilters;
  onFiltersChange: (filters: IProcessoFilters) => void;
  clientes: string[];
  activeFiltersCount: number;
  onClearFilters: () => void;
}

export const ProcessoFilters: React.FC<ProcessoFiltersProps> = ({
  filters,
  onFiltersChange,
  clientes,
  activeFiltersCount,
  onClearFilters
}) => {
  const handleFilterChange = (key: keyof IProcessoFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Filtros específicos - Compact Grid */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Filtro de Cliente */}
        <Select value={filters.cliente} onValueChange={(value) => handleFilterChange('cliente', value)}>
          <SelectTrigger className="w-auto min-w-[180px] h-12 bg-white dark:bg-black/20 border-black/5 dark:border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest focus:ring-primary/20 transition-all hover:bg-black/5 dark:hover:bg-white/5 shadow-premium">
            <div className="flex items-center gap-2 pr-2">
              <User className="h-4 w-4 text-primary" />
              <SelectValue placeholder="Filtrar por Cliente" />
            </div>
          </SelectTrigger>
          <SelectContent className="glass-card border-black/10 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl">
            <SelectItem value="all" className="font-black text-[10px] uppercase tracking-widest">Todos os clientes</SelectItem>
            {clientes.map((cliente) => (
              <SelectItem key={cliente} value={cliente} className="font-bold text-xs">{cliente}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtro de Área */}
        <Select value={filters.area} onValueChange={(value) => handleFilterChange('area', value)}>
          <SelectTrigger className="w-auto min-w-[160px] h-12 bg-white dark:bg-black/20 border-black/5 dark:border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest focus:ring-primary/20 transition-all hover:bg-black/5 dark:hover:bg-white/5 shadow-premium">
            <div className="flex items-center gap-2 pr-2">
              <Scale className="h-4 w-4 text-primary" />
              <SelectValue placeholder="Área" />
            </div>
          </SelectTrigger>
          <SelectContent className="glass-card border-black/10 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl">
            <SelectItem value="all" className="font-black text-[10px] uppercase tracking-widest">Todas as áreas</SelectItem>
            {areasJuridicas.map((area) => (
              <SelectItem key={area} value={area} className="font-bold text-xs">{area}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtro de Status */}
        <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
          <SelectTrigger className="w-auto min-w-[160px] h-12 bg-white dark:bg-black/20 border-black/5 dark:border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest focus:ring-primary/20 transition-all hover:bg-black/5 dark:hover:bg-white/5 shadow-premium">
            <div className="flex items-center gap-2 pr-2">
              <Hash className="h-4 w-4 text-primary" />
              <SelectValue placeholder="Status" />
            </div>
          </SelectTrigger>
          <SelectContent className="glass-card border-black/10 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl">
            <SelectItem value="all" className="font-black text-[10px] uppercase tracking-widest">Todos os status</SelectItem>
            {statusProcesso.map((status) => (
              <SelectItem key={status} value={status} className="font-bold text-xs">{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtro de Movimentação */}
        <Select value={filters.movimentacao} onValueChange={(value) => handleFilterChange('movimentacao', value)}>
          <SelectTrigger className="w-auto min-w-[200px] h-12 bg-white dark:bg-black/20 border-black/5 dark:border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest focus:ring-primary/20 transition-all hover:bg-black/5 dark:hover:bg-white/5 shadow-premium">
            <div className="flex items-center gap-2 pr-2">
              <Calendar className="h-4 w-4 text-primary" />
              <SelectValue placeholder="Última Movimentação" />
            </div>
          </SelectTrigger>
          <SelectContent className="glass-card border-black/10 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl">
            <SelectItem value="all" className="font-black text-[10px] uppercase tracking-widest">Todas as datas</SelectItem>
            <SelectItem value="7dias" className="font-bold text-xs">Últimos 7 dias</SelectItem>
            <SelectItem value="15dias" className="font-bold text-xs">Últimos 15 dias</SelectItem>
            <SelectItem value="30dias" className="font-bold text-xs">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>

        {/* Botão de Limpar */}
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            onClick={onClearFilters}
            className="h-12 px-6 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl transition-all"
          >
            Limpar Filtros ({activeFiltersCount})
          </Button>
        )}
      </div>
    </div>
  );
};