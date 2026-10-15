import { useState, useEffect, memo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, X, Zap, Pencil, Trash2, Plus, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { assertRowsAffected, getErrorMessage } from "@/lib/errors";
import { patchOfficeSettings } from "@/lib/officeSettings";
import { carregarTiposAto, tiposAtoDefaultRows, type TipoAto } from "@/lib/tiposAtoPrazo";

// ─────────────────────────────────────────────
// Modal de gerenciar tipos de ato e feriados do escritório (Supabase)
// ─────────────────────────────────────────────
interface GerenciarTiposProps {
  open: boolean;
  onClose: () => void;
  officeId: string;
}
// Formulário de tipo de ato — ESTÁVEL (fora do modal) para os <Input> não remontarem a cada tecla
const DraftForm = memo(function DraftForm({ draft, setDraft, saving, onSave, onCancel }: {
  draft: Omit<TipoAto, 'id'>;
  setDraft: (fn: (d: Omit<TipoAto, 'id'>) => Omit<TipoAto, 'id'>) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-3 mt-2">
      <Input placeholder="Nome do tipo de ato" value={draft.label}
        onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} className="h-8 rounded-lg text-xs" />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Dias</p>
          <Input type="number" min={1} max={365} value={draft.diasUteis}
            onChange={e => setDraft(d => ({ ...d, diasUteis: Number(e.target.value) }))} className="h-8 rounded-lg text-xs" />
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Tipo</p>
          <select value={draft.corridos ? 'corridos' : 'uteis'}
            onChange={e => setDraft(d => ({ ...d, corridos: e.target.value === 'corridos' }))}
            className="h-8 w-full rounded-lg text-xs border border-border bg-background px-2">
            <option value="uteis">Úteis</option>
            <option value="corridos">Corridos</option>
          </select>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Margem int.</p>
          <Input type="number" min={0} max={30} value={draft.margem}
            onChange={e => setDraft(d => ({ ...d, margem: Number(e.target.value) }))} className="h-8 rounded-lg text-xs" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-7 rounded-lg text-xs" disabled={saving}>Cancelar</Button>
        <Button type="button" size="sm" onClick={onSave} disabled={saving} className="h-7 rounded-lg text-xs gap-1">
          <Check className="h-3 w-3" /> {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
});

export function GerenciarTiposModal({ open, onClose, officeId }: GerenciarTiposProps) {
  const { toast } = useToast();
  const [tipos, setTipos] = useState<TipoAto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<TipoAto,'id'>>({ value: '', label: '', diasUteis: 15, corridos: false, margem: 3, ordem: 0 });
  const [adding, setAdding] = useState(false);
  const [feriados, setFeriados] = useState<string[]>([]);
  const [feriadosError, setFeriadosError] = useState<string | null>(null);
  const [novoFeriado, setNovoFeriado] = useState('');
  const [feriadoAnual, setFeriadoAnual] = useState(false);

  const fetchFeriados = async () => {
    const { data, error } = await supabase.from('offices').select('settings').eq('id', officeId).maybeSingle();
    // Sem checar o erro, uma falha de busca cai como "nenhum feriado" — e salvar
    // dali (addFeriado/removeFeriado grava a lista inteira de novo) apagaria os
    // feriados reais já cadastrados (mesmo risco de useOfficeSettingList).
    if (error) {
      setFeriadosError(getErrorMessage(error, "Não foi possível carregar os feriados."));
      return;
    }
    setFeriadosError(null);
    setFeriados(((data?.settings as any)?.prazo_feriados as string[]) ?? []);
  };
  const saveFeriados = async (arr: string[]) => {
    if (feriadosError) {
      toast({ title: 'Não foi possível salvar', description: 'Os feriados não carregaram — recarregue antes de editar.', variant: 'destructive' });
      return;
    }
    const previous = feriados;
    setFeriados(arr); // otimista
    try {
      await patchOfficeSettings(officeId, { prazo_feriados: arr });
    } catch (e) {
      setFeriados(previous);
      toast({ title: 'Erro ao salvar feriado', description: getErrorMessage(e), variant: 'destructive' });
    }
  };
  const addFeriado = () => {
    if (!novoFeriado) return;
    const val = feriadoAnual ? novoFeriado.slice(5) : novoFeriado; // MM-DD (anual) ou YYYY-MM-DD
    if (feriados.includes(val)) return;
    saveFeriados([...feriados, val].sort());
    setNovoFeriado(''); setFeriadoAnual(false);
  };
  const removeFeriado = (f: string) => saveFeriados(feriados.filter(x => x !== f));

  const fetchTipos = async () => {
    setLoading(true);
    try {
      const r = await carregarTiposAto(officeId);
      setTipos(r.tipos);
      if (r.fallback) {
        toast({ title: 'Tipos padrão não puderam ser gravados', description: 'Mostrando os padrões do CPC sem salvar. Tente "Restaurar padrão" ou fale com o administrador.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Erro ao carregar tipos de prazo', description: getErrorMessage(e), variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && officeId) { fetchTipos(); fetchFeriados(); setEditingId(null); setAdding(false); }
  }, [open, officeId]);

  const startEdit = (t: TipoAto) => {
    setAdding(false);
    setEditingId(t.id!);
    setDraft({ value: t.value, label: t.label, diasUteis: t.diasUteis, corridos: t.corridos, margem: t.margem, ordem: t.ordem });
  };

  const applyEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const { data, error } = await supabase.from('tipos_ato_prazo').update({
      label: draft.label, dias_uteis: draft.diasUteis, corridos: draft.corridos, margem: draft.margem,
    }).eq('id', editingId).select('id');
    try {
      assertRowsAffected(data, error, 1);
      await fetchTipos(); setEditingId(null);
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: getErrorMessage(e), variant: 'destructive' });
    }
    setSaving(false);
  };

  const deleteItem = async (t: TipoAto) => {
    setSaving(true);
    const { data, error } = await supabase.from('tipos_ato_prazo').delete().eq('id', t.id!).select('id');
    try {
      assertRowsAffected(data, error, 1);
      await fetchTipos(); if (editingId === t.id) setEditingId(null);
    } catch (e) {
      toast({ title: 'Erro ao excluir', description: getErrorMessage(e), variant: 'destructive' });
    }
    setSaving(false);
  };

  const startAdd = () => {
    setEditingId(null);
    setDraft({ value: `custom_${Date.now()}`, label: '', diasUteis: 15, corridos: false, margem: 3, ordem: tipos.length });
    setAdding(true);
  };

  const applyAdd = async () => {
    if (!draft.label.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('tipos_ato_prazo').insert({
      office_id: officeId, value: draft.value, label: draft.label,
      dias_uteis: draft.diasUteis, corridos: draft.corridos, margem: draft.margem, ordem: draft.ordem,
    });
    if (error) { toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' }); }
    else { await fetchTipos(); setAdding(false); }
    setSaving(false);
  };

  const resetDefault = async () => {
    setSaving(true);
    try {
      // Apaga os atuais e grava os padrões; qualquer falha (inclusive RLS
      // barrando em silêncio o insert) vira erro visível em vez de "restaurado".
      // Apaga tudo do escritório: a RLS barrando devolve 0 linhas sem erro e o
      // insert dos padrões viraria duplicata em cima dos atuais.
      const { data: del, error: delError } = await supabase.from('tipos_ato_prazo').delete().eq('office_id', officeId).select('id');
      assertRowsAffected(del, delError, tipos.length);
      const rows = tiposAtoDefaultRows(officeId);
      const { data, error } = await supabase.from('tipos_ato_prazo').insert(rows).select('id');
      assertRowsAffected(data, error, rows.length);
      await fetchTipos();
      setEditingId(null); setAdding(false);
      toast({ title: 'Tipos restaurados', description: 'Padrões CPC aplicados para o escritório.' });
    } catch (e) {
      toast({ title: 'Erro ao restaurar padrão', description: getErrorMessage(e), variant: 'destructive' });
      await fetchTipos();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="max-w-sm bg-background border border-border p-0 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle className="text-sm font-black flex items-center gap-2">
            <Zap className="h-4 w-4 text-violet-500" /> Tipos de Ato
          </DialogTitle>
          <p className="text-[10px] text-muted-foreground mt-0.5">Prazos legais usados na calculadora automática</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            <div className="py-10 flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {tipos.map(t => (
                <div key={t.id ?? t.value}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
                    editingId === t.id ? "border-primary/30 bg-primary/5" : "border-border bg-muted/10"
                  )}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {t.diasUteis}d {t.corridos ? 'corridos' : 'úteis'} · margem {t.margem}d
                      </p>
                    </div>
                    <button type="button" onClick={() => startEdit(t)} disabled={saving}
                      className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => deleteItem(t)} disabled={saving}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  {editingId === t.id && (
                    <DraftForm draft={draft} setDraft={setDraft} saving={saving} onSave={applyEdit} onCancel={() => setEditingId(null)} />
                  )}
                </div>
              ))}

              {adding && <DraftForm draft={draft} setDraft={setDraft} saving={saving} onSave={applyAdd} onCancel={() => setAdding(false)} />}

              {!adding && (
                <button type="button" onClick={startAdd} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-dashed border-border text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:border-primary/30 hover:text-primary transition-all disabled:opacity-50">
                  <Plus className="h-3.5 w-3.5" /> Novo tipo de ato
                </button>
              )}
            </>
          )}

          {/* Feriados do escritório */}
          <div className="pt-3 mt-2 border-t border-border/60 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1.5">
              <CalendarClock className="h-3 w-3" /> Feriados do escritório
            </p>
            <p className="text-[10px] text-muted-foreground/50 leading-tight">Feriados estaduais/municipais ou suspensões — entram no cálculo de dias úteis.</p>
            {feriadosError && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-destructive truncate">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {feriadosError}
                </span>
                <button type="button" onClick={fetchFeriados} className="text-[10px] font-black uppercase text-destructive underline underline-offset-2 shrink-0">Tentar de novo</button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {!feriadosError && feriados.length === 0 && <span className="text-[11px] text-muted-foreground/40 italic">Nenhum feriado adicionado.</span>}
              {feriados.map(f => (
                <span key={f} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/40 text-[11px] font-bold">
                  {f.length === 5 ? `${f.slice(3)}/${f.slice(0, 2)} · todo ano` : f.split('-').reverse().join('/')}
                  <button type="button" onClick={() => removeFeriado(f)} className="hover:text-red-500 transition-colors"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={novoFeriado} onChange={e => setNovoFeriado(e.target.value)}
                className="h-8 rounded-lg text-xs border border-border bg-background px-2 flex-1 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={feriadoAnual} onChange={e => setFeriadoAnual(e.target.checked)} className="accent-primary" /> todo ano
              </label>
              <Button type="button" size="sm" onClick={addFeriado} disabled={!novoFeriado || !!feriadosError} className="h-8 rounded-lg px-3"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-border shrink-0 flex gap-2">
          <button type="button" onClick={resetDefault} disabled={saving}
            className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors underline underline-offset-2 disabled:opacity-40">
            Restaurar padrões CPC
          </button>
          <div className="flex-1" />
          <Button size="sm" onClick={onClose} className="rounded-xl h-8 text-xs font-black px-5">Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
