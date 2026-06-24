import React from 'react';
import { LayoutGrid, List, Settings2, Check } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ProcessoViewSwitcherProps {
  view: 'grid' | 'table';
  onViewChange: (view: 'grid' | 'table') => void;
}

export const ProcessoViewSwitcher: React.FC<ProcessoViewSwitcherProps> = ({
  view,
  onViewChange
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="h-10 w-10 rounded-xl glass-morphism border-white/10 hover:bg-white/5"
          title="Configurações de Visualização"
        >
          <Settings2 className="h-5 w-5 text-primary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 glass-morphism border-white/10">
        <DropdownMenuLabel>Visualização</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/5" />
        
        <DropdownMenuItem 
          onClick={() => onViewChange('table')}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <List className="h-4 w-4" />
            <span>Vista em Tabela</span>
          </div>
          {view === 'table' && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={() => onViewChange('grid')}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span>Vista em Cards (Grid)</span>
          </div>
          {view === 'grid' && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
