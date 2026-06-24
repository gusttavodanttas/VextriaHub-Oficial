import React from 'react';
import { Plus, Trash2, Trophy, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';

interface TarefasPageHeaderProps {
  selectedCount: number;
  onDeleteSelected: () => void;
  onNewTarefa: () => void;
  isNoneSelected: boolean;
  stats: {
    total: number;
    completed: number;
    pending: number;
    totalPoints: number;
    earnedPoints: number;
    completionRate: number;
  };
}

export const TarefasPageHeader: React.FC<TarefasPageHeaderProps> = ({
  selectedCount,
  onDeleteSelected,
  onNewTarefa,
  isNoneSelected,
  stats
}) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header principal */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Target className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              </div>
              <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                Tarefas & Prazos
              </h1>
            </div>
            <p className="text-sm md:text-lg text-muted-foreground font-medium">
              Gerencie suas obrigações e prazos com gamificação por pontos.
            </p>
          </div>
        
        <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl">
          <PermissionGuard permission="canManageTarefas">
            {!isNoneSelected && (
              <Button
                variant="destructive"
                onClick={onDeleteSelected}
                className="rounded-xl h-10 md:h-12 px-4 md:px-6"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir ({selectedCount})
              </Button>
            )}
          </PermissionGuard>
          
          <Button 
            onClick={onNewTarefa}
            size="lg"
            className="rounded-xl shadow-premium h-10 md:h-12 px-4 md:px-6"
          >
            <Plus className="mr-2 h-4 w-4 md:h-5 md:w-5" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover-lift border-white/5 bg-card/40">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total</p>
                <p className="text-3xl font-extrabold tracking-tight">{stats.total}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Target className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift border-white/5 bg-card/40">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Concluídas</p>
                <p className="text-3xl font-extrabold tracking-tight text-emerald-500">{stats.completed}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <div className="h-2.5 w-2.5 bg-emerald-500 rounded-full animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift border-white/5 bg-card/40">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pendentes</p>
                <p className="text-3xl font-extrabold tracking-tight text-orange-500">{stats.pending}</p>
              </div>
              <div className="p-3 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <div className="h-2.5 w-2.5 bg-orange-500 rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift border-white/5 bg-card/40">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pontos</p>
                <p className="text-3xl font-extrabold tracking-tight text-yellow-500">
                  {stats.earnedPoints}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-yellow-500/10">
                <Trophy className="h-6 w-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progresso */}
      <Card className="border-white/5 bg-card/40 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <span className="text-sm font-bold uppercase tracking-wider">Taxa de Conclusão</span>
              <p className="text-xs text-muted-foreground">Percentual de tarefas entregues</p>
            </div>
            <Badge variant="outline" className="px-3 py-1 rounded-full border-primary/30 text-primary font-bold">
              {stats.completionRate.toFixed(1)}%
            </Badge>
          </div>
          <div className="w-full bg-muted/50 rounded-full h-3 p-1 border border-white/5">
            <div 
              className="bg-gradient-to-r from-primary to-primary/60 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(var(--primary),0.3)]"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};