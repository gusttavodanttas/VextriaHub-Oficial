// Passo 1 do "Novo Processo": escolha do método (OAB / CNJ / manual) —
// extraído de NovoProcessoDialog.tsx sem mudança de comportamento.
import { RotateCw, Search, Plus } from 'lucide-react';

export type MetodoNovoProcesso = 'oab' | 'cnj_search' | 'form';

export function MetodoEntrada({ onEscolher }: { onEscolher: (metodo: MetodoNovoProcesso) => void }) {
  return (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* Sincronizar OAB */}
    <button
      type="button"
      onClick={() => onEscolher('oab')}
      className="group relative flex flex-col items-center gap-5 p-7 rounded-2xl border border-border bg-card hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all duration-200 text-center cursor-pointer"
    >
      <div className="w-14 h-14 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-200">
        <RotateCw className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h4 className="font-bold text-base text-foreground">Sincronizar OAB</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">Importa todos os processos<br/>vinculados ao seu número de OAB</p>
      </div>
      <div className="absolute bottom-0 inset-x-0 h-0.5 rounded-b-2xl bg-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-200" />
    </button>

    {/* Buscar por CNJ */}
    <button
      type="button"
      onClick={() => onEscolher('cnj_search')}
      className="group relative flex flex-col items-center gap-5 p-7 rounded-2xl border border-border bg-card hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-0.5 transition-all duration-200 text-center cursor-pointer"
    >
      <div className="w-14 h-14 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-200">
        <Search className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h4 className="font-bold text-base text-foreground">Buscar por CNJ</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">Preenche automaticamente<br/>com dados do DataJud pelo número</p>
      </div>
      <div className="absolute bottom-0 inset-x-0 h-0.5 rounded-b-2xl bg-emerald-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-200" />
    </button>

    {/* Manual */}
    <button
      type="button"
      onClick={() => onEscolher('form')}
      className="group relative flex flex-col items-center gap-5 p-7 rounded-2xl border border-border bg-card hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5 transition-all duration-200 text-center cursor-pointer"
    >
      <div className="w-14 h-14 rounded-xl bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-all duration-200">
        <Plus className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h4 className="font-bold text-base text-foreground">Manual</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">Preencha os dados<br/>do processo manualmente</p>
      </div>
      <div className="absolute bottom-0 inset-x-0 h-0.5 rounded-b-2xl bg-amber-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-200" />
    </button>
  </div>
  );
}
