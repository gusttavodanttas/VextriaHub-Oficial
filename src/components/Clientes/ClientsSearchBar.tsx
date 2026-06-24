import React from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ClientsSearchBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onFilterClick: () => void;
}

export const ClientsSearchBar: React.FC<ClientsSearchBarProps> = ({
  searchValue,
  onSearchChange,
  onFilterClick
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar clientes..."
          className="pl-10"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Button variant="outline" className="w-full sm:w-auto" onClick={onFilterClick}>
        <Filter className="h-4 w-4 mr-2" />
        Filtros
      </Button>
    </div>
  );
};