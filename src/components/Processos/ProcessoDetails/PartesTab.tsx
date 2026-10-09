import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, RotateCw, Save, User, Users, X } from 'lucide-react';
import { Processo } from '@/types/processo';
import type { ProcessoEditData, SetEditData } from './helpers';

interface Props {
  processo: Processo;
  editing: boolean;
  setEditing: (v: boolean) => void;
  editData: ProcessoEditData;
  setEditData: SetEditData;
  isMine: boolean;
  saving: boolean;
  savingCliente: boolean;
  onSave: () => void;
  onSetCliente: (polo: 'autor' | 'reu') => void;
}

/** Aba "Partes": polo ativo/passivo (editáveis) e vínculo de cliente a partir da parte. */
export function PartesTab({ processo, editing, setEditing, editData, setEditData, isMine, saving, savingCliente, onSave, onSetCliente }: Props) {
  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 space-y-4">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <User className="h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Polo Ativo (Autor / Requerente)</span>
        </div>
        {editing ? (
          <Input className="h-10 rounded-xl bg-background border-border" value={editData.parte_autora} onChange={(e) => setEditData({ ...editData, parte_autora: e.target.value })} placeholder="Nome do autor..." />
        ) : (
          <p className="text-base font-bold text-foreground leading-relaxed">{processo.parteAutora || <span className="text-muted-foreground/50 italic">Não identificado</span>}</p>
        )}
        {isMine && (
          <Button variant={processo.clienteId && processo.cliente === (processo.parteAutora || '') ? 'default' : 'outline'} size="sm" className="w-full rounded-xl gap-2 font-black text-[10px] h-9 uppercase tracking-widest" disabled={savingCliente || !(editData.parte_autora || processo.parteAutora)} onClick={() => onSetCliente('autor')}>
            {savingCliente ? <RotateCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Este é meu cliente
          </Button>
        )}
      </div>

      <div className="p-6 rounded-2xl border border-rose-500/15 bg-rose-500/5 space-y-4">
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <Users className="h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Polo Passivo (Réu / Requerido)</span>
        </div>
        {editing ? (
          <Input className="h-10 rounded-xl bg-background border-border" value={editData.requerido} onChange={(e) => setEditData({ ...editData, requerido: e.target.value })} placeholder="Nome do réu..." />
        ) : (
          <p className="text-base font-bold text-foreground leading-relaxed">{processo.requerido || <span className="text-muted-foreground/50 italic">Não identificado</span>}</p>
        )}
        {isMine && (
          <Button variant={processo.clienteId && processo.cliente === (processo.requerido || '') ? 'default' : 'outline'} size="sm" className="w-full rounded-xl gap-2 font-black text-[10px] h-9 uppercase tracking-widest" disabled={savingCliente || !(editData.requerido || processo.requerido)} onClick={() => onSetCliente('reu')}>
            {savingCliente ? <RotateCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Este é meu cliente
          </Button>
        )}
      </div>

      {editing && (
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-9 rounded-xl text-xs gap-1.5"><X className="h-3.5 w-3.5" /> Cancelar</Button>
          <Button size="sm" onClick={onSave} disabled={saving} className="h-9 rounded-xl text-xs gap-1.5 shadow-md"><Save className="h-3.5 w-3.5" /> {saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      )}
    </div>
  );
}
