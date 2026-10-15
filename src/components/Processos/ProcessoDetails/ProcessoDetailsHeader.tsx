import React from 'react';
import { DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Edit, Eye, PencilLine, Save, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCNJ } from '@/utils/formatCNJ';
import { Processo } from '@/types/processo';
import { getStatusStyle, type ProcessoEditData, type SetEditData } from './helpers';

export interface DrawerTab { value: string; label: string; icon: React.ElementType }

interface Props {
  processo: Processo;
  editing: boolean;
  setEditing: (v: boolean) => void;
  editData: ProcessoEditData;
  setEditData: SetEditData;
  canEditHeader: boolean;
  isMine: boolean;
  canEditShared: boolean;
  saving: boolean;
  onSave: () => void;
  onCompletarDados: () => void;
  tabs: DrawerTab[];
  activeTab: string;
  setActiveTab: (v: string) => void;
}

/** Cabeçalho do drawer: status, título/número (editáveis), ações e a barra de abas. */
export function ProcessoDetailsHeader({
  processo, editing, setEditing, editData, setEditData, canEditHeader, isMine, canEditShared,
  saving, onSave, onCompletarDados, tabs, activeTab, setActiveTab,
}: Props) {
  return (
    <div className="px-8 pt-7 pb-4 space-y-4 border-b border-border shrink-0 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 blur-[120px] -mr-40 -mt-40 rounded-full pointer-events-none" />

      <div className="flex items-start justify-between relative">
        <div className="space-y-2.5 flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className={cn("px-3 py-1 text-[10px] font-black uppercase tracking-widest border-2", getStatusStyle(processo.status))}>
              {processo.status}
            </Badge>
            <span className="text-[10px] text-muted-foreground/50 uppercase font-black tracking-widest flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Desde {processo.dataInicio ? new Date(processo.dataInicio).toLocaleDateString('pt-BR') : '—'}
            </span>
          </div>

          {editing ? (
            <Input className="text-2xl font-black rounded-xl bg-background border-border h-14 focus:ring-2 focus:ring-primary/20" value={editData.titulo} onChange={(e) => setEditData({ ...editData, titulo: e.target.value })} />
          ) : (
            <DialogTitle className="text-2xl md:text-3xl font-black text-foreground leading-tight tracking-tight pr-8">
              {processo.titulo}
            </DialogTitle>
          )}

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary/50 animate-pulse shrink-0" />
            {editing ? (
              <Input
                className="font-mono text-sm h-9 rounded-lg bg-background border-border max-w-[24rem]"
                value={editData.numero_processo}
                onChange={(e) => setEditData({ ...editData, numero_processo: e.target.value })}
                placeholder="Número CNJ — preencher após protocolar"
              />
            ) : processo.numeroProcesso ? (
              <span className="font-mono text-sm font-bold text-primary tracking-tight">{formatCNJ(processo.numeroProcesso)}</span>
            ) : canEditHeader ? (
              <button type="button" onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline">
                <Edit className="h-3.5 w-3.5" /> Sem número — adicionar o número do processo
              </button>
            ) : (
              <span className="text-xs font-bold text-muted-foreground/50">Sem número</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-9 rounded-xl text-xs gap-1.5"><X className="h-3.5 w-3.5" /> Cancelar</Button>
              <Button size="sm" onClick={onSave} disabled={saving} className="h-9 rounded-xl text-xs gap-1.5 shadow-md"><Save className="h-3.5 w-3.5" /> {saving ? 'Salvando...' : 'Salvar'}</Button>
            </>
          ) : canEditHeader ? (
            <div className="flex gap-2">
              {processo.numeroProcesso && (
                <Button variant="outline" size="sm" onClick={onCompletarDados} className="h-9 rounded-xl text-xs gap-1.5 border-border" title="Buscar dados no tribunal e completar os campos vazios">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Completar dados
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="h-9 rounded-xl text-xs gap-1.5 border-border"><Edit className="h-3.5 w-3.5" /> Editar</Button>
            </div>
          ) : isMine ? null : (
            <Badge variant="outline" className={cn("h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest gap-1.5 flex items-center", canEditShared ? "border-amber-500/30 text-amber-600 bg-amber-500/10" : "border-sky-500/30 text-sky-600 bg-sky-500/10")}>
              {canEditShared ? <PencilLine className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {canEditShared ? 'Compartilhado · pode editar' : 'Compartilhado · leitura'}
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs - scrollable */}
      <div className="overflow-x-auto -mx-8 px-8 pb-1">
        <div className="flex gap-1 bg-muted/40 p-1 rounded-2xl w-max min-w-full">
          {tabs.map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setActiveTab(t.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all",
                  isActive ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
