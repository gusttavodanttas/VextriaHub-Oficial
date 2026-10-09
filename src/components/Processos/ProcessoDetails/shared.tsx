import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, RotateCw } from 'lucide-react';

// Componentes de apresentação compartilhados pelas abas do ProcessoDetailsDrawer.
// Nada aqui tem estado próprio nem acessa o Supabase. Tipos e helpers: ./helpers.ts

// ── Campo da capa (componente ESTÁVEL: definido fora do drawer para o <Input>
//    não remontar a cada tecla — era a causa do travamento ao digitar) ──
export const CapaField = React.memo(function CapaField({ label, editing, value, icon, onChange }: {
  label: string; editing: boolean; value: string; icon?: React.ReactNode; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">{label}</p>
      {editing ? (
        <Input
          className="h-10 text-sm rounded-xl bg-background border-border focus:ring-2 focus:ring-primary/20"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="flex items-center gap-2 min-h-[40px] px-3 py-2 rounded-xl bg-muted/20 border border-transparent">
          {icon}
          <p className="text-sm font-semibold text-foreground">{value || '—'}</p>
        </div>
      )}
    </div>
  );
});

// ── Wrapper de formulário de adição rápida (também estável) ──
export const AddForm = React.memo(function AddForm({ children, onSubmit, onCancel, loading }: {
  children: React.ReactNode; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="p-5 rounded-2xl border border-primary/20 bg-primary/5 space-y-4 animate-in fade-in duration-300">
      {children}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="rounded-xl text-xs h-8">Cancelar</Button>
        <Button type="submit" size="sm" disabled={loading} className="rounded-xl text-xs h-8 gap-1.5">
          {loading ? <RotateCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Salvar
        </Button>
      </div>
    </form>
  );
});

export const EmptySub = ({ icon: Icon, label, loading }: { icon: React.ElementType; label: string; loading: boolean }) => (
  loading ? (
    <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 opacity-40">
      <RotateCw className="h-6 w-6 animate-spin" />
      <p className="font-black uppercase tracking-widest text-xs">Carregando…</p>
    </div>
  ) : (
    <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 opacity-30">
      <Icon className="h-10 w-10" />
      <p className="font-black uppercase tracking-widest text-xs">Nenhum(a) {label}</p>
    </div>
  )
);

export const SectionHeader = ({ label, count, loading, onAdd }: { label: string; count: number; loading: boolean; onAdd?: () => void }) => (
  <div className="flex items-center justify-between mb-4">
    <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">
      {loading ? 'Carregando...' : `${count} ${label}`}
    </p>
    {onAdd && (
      <Button variant="outline" size="sm" onClick={onAdd} className="h-7 rounded-xl text-[10px] gap-1 px-3 font-black uppercase tracking-widest">
        <Plus className="h-3 w-3" /> Novo
      </Button>
    )}
  </div>
);
