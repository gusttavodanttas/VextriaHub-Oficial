import React from 'react';
import { Search, Filter, Calendar, Clock, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AtendimentosFiltersProps {
  searchValue: string;
  statusFilter: string;
  tipoFilter: string;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onTipoFilterChange: (value: string) => void;
  onClearFilters: () => void;
  activeFiltersCount: number;
}

export const AtendimentosFilters: React.FC<AtendimentosFiltersProps> = ({
  searchValue,
  statusFilter,
  tipoFilter,
  onSearchChange,
  onStatusFilterChange,
  onTipoFilterChange,
  onClearFilters,
  activeFiltersCount
}) => {
  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-[2rem] border border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl shadow-premium">
        <div className="flex flex-col gap-6">
          {/* Primeira linha - Pesquisa */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary opacity-50" />
              <Input
                placeholder="Buscar por cliente, tipo, observações..."
                className="pl-12 h-12 bg-black/[0.02] dark:bg-muted/20 border-black/5 dark:border-white/5 rounded-xl font-medium"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
            {activeFiltersCount > 0 && (
              <Button 
                variant="ghost" 
                onClick={onClearFilters}
                className="whitespace-nowrap h-12 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest text-primary hover:bg-primary/10"
              >
                Limpar Filtros
                <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-none">
                  {activeFiltersCount}
                </Badge>
              </Button>
            )}
          </div>

          {/* Segunda linha - Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                <SelectTrigger className="h-12 bg-black/[0.02] dark:bg-muted/20 border-black/5 dark:border-white/5 rounded-xl font-bold">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Filtrar por status" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-black/5 dark:border-white/10">
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="Agendado">Agendado</SelectItem>
                  <SelectItem value="Confirmado">Confirmado</SelectItem>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Select value={tipoFilter} onValueChange={onTipoFilterChange}>
                <SelectTrigger className="h-12 bg-black/[0.02] dark:bg-muted/20 border-black/5 dark:border-white/5 rounded-xl font-bold">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Filtrar por tipo" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-black/5 dark:border-white/10">
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="Presencial">Presencial</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Telefone">Telefone</SelectItem>
                  <SelectItem value="Consultoria">Consultoria</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};