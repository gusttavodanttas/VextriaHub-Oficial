import { useState, useEffect, useRef, memo } from "react";
import { format, parseISO } from "date-fns";
import { AvisoDiasSelect } from "@/components/Notifications/AvisoDiasSelect";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  CalendarClock, Newspaper, Shield, AlertOctagon, Search, X,
  Zap, CalendarIcon, Pencil, Trash2, Plus, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
interface ProcessoOption {
  id: string;
  titulo: string;
  numero_processo: string;
}

export interface PrazoFormData {
  id?: string;
  titulo: string;
  descricao?: string | null;
  data_publicacao?: string | null;
  data_prazo_interno?: string | null;
  data_fim_prazo?: string | null;
  prioridade: string;
  processo_id?: string | null;
  office_id?: string | null;
  user_id?: string;
  avisos_dias?: number[] | null;
  titular?: string | null;
}

interface NovoPrazoStandaloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  publicacaoId?: string;
  numeroProcesso?: string;
  tituloSugerido?: string;
  prazoParaEditar?: PrazoFormData;
}

// ─────────────────────────────────────────────
// Tipos de ato — armazenados no Supabase
// ─────────────────────────────────────────────
export interface TipoAto {
  id?: string;
  value: string;
  label: string;
  diasUteis: number;
  corridos: boolean;
  margem: number;
  ordem: number;
}

const TIPOS_ATO_DEFAULT: Omit<TipoAto, 'id'>[] = [
  { value: 'contestacao',   label: 'Contestação',               diasUteis: 15, corridos: false, margem: 3,  ordem: 0  },
  { value: 'apelacao',      label: 'Recurso de Apelação',       diasUteis: 15, corridos: false, margem: 3,  ordem: 1  },
  { value: 'agravo',        label: 'Agravo de Instrumento',     diasUteis: 15, corridos: false, margem: 3,  ordem: 2  },
  { value: 'embargos',      label: 'Embargos de Declaração',    diasUteis: 5,  corridos: false, margem: 1,  ordem: 3  },
  { value: 'contrarrazoes', label: 'Contrarrazões',             diasUteis: 15, corridos: false, margem: 3,  ordem: 4  },
  { value: 'manifestacao',  label: 'Manifestação / Petição',    diasUteis: 5,  corridos: false, margem: 1,  ordem: 5  },
  { value: 'impugnacao',    label: 'Impugnação ao cumprimento', diasUteis: 15, corridos: false, margem: 3,  ordem: 6  },
  { value: 'resp_rext',     label: 'REsp / RE',                 diasUteis: 15, corridos: false, margem: 3,  ordem: 7  },
  { value: 'juizado_5',     label: 'Juizado — 5 dias corridos', diasUteis: 5,  corridos: true,  margem: 1,  ordem: 8  },
  { value: 'juizado_10',    label: 'Juizado — 10 dias corridos',diasUteis: 10, corridos: true,  margem: 2,  ordem: 9  },
  { value: 'juizado_15',    label: 'Juizado — 15 dias corridos',diasUteis: 15, corridos: true,  margem: 3,  ordem: 10 },
];

function dbToTipoAto(row: any): TipoAto {
  return {
    id: row.id,
    value: row.value,
    label: row.label,
    diasUteis: row.dias_uteis,
    corridos: row.corridos,
    margem: row.margem,
    ordem: row.ordem,
  };
}

// ─────────────────────────────────────────────
// Cálculo de dias úteis
// ─────────────────────────────────────────────
const FERIADOS_FIXOS = new Set([
  '01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25',
]);

const _mmddOf = (d: Date) => `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const _addDaysLocal = (base: Date, n: number) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };

// Domingo de Páscoa (algoritmo de Meeus/Butcher)
function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Feriados forenses móveis por ano (Carnaval seg/ter, Sexta-feira Santa, Corpus Christi)
const _movableCache: Record<number, Set<string>> = {};
function movableFeriados(year: number): Set<string> {
  if (_movableCache[year]) return _movableCache[year];
  const pascoa = easterSunday(year);
  const set = new Set<string>([
    _mmddOf(_addDaysLocal(pascoa, -48)), // Carnaval (segunda)
    _mmddOf(_addDaysLocal(pascoa, -47)), // Carnaval (terça)
    _mmddOf(_addDaysLocal(pascoa, -2)),  // Sexta-feira Santa
    _mmddOf(_addDaysLocal(pascoa, 60)),  // Corpus Christi
  ]);
  _movableCache[year] = set;
  return set;
}

// Recesso forense: 20/12 a 20/01 inclusive (CPC art. 220) — prazos suspensos
function isRecesso(d: Date) {
  const mo = d.getMonth() + 1, day = d.getDate();
  return (mo === 12 && day >= 20) || (mo === 1 && day <= 20);
}

function isFeriado(d: Date) {
  const mmdd = _mmddOf(d);
  return FERIADOS_FIXOS.has(mmdd) || movableFeriados(d.getFullYear()).has(mmdd);
}
function isUtil(d: Date) { const w = d.getDay(); return w !== 0 && w !== 6 && !isFeriado(d) && !isRecesso(d); }

// Versões que consideram feriados do escritório (anuais MM-DD + específicos YYYY-MM-DD)
const _ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function isUtilWith(d: Date, extraAnual: Set<string>, extraData: Set<string>) {
  const w = d.getDay();
  return w !== 0 && w !== 6 && !isFeriado(d) && !isRecesso(d) && !extraAnual.has(_mmddOf(d)) && !extraData.has(_ymdOf(d));
}
function addDiasUteisWith(from: Date, n: number, extraAnual: Set<string>, extraData: Set<string>): Date {
  const d = new Date(from); let c = 0;
  while (c < n) { d.setDate(d.getDate() + 1); if (isUtilWith(d, extraAnual, extraData)) c++; }
  return d;
}
function addDiasUteis(from: Date, n: number): Date {
  const d = new Date(from); let c = 0;
  while (c < n) { d.setDate(d.getDate()+1); if (isUtil(d)) c++; }
  return d;
}
function addDiasCorridos(from: Date, n: number): Date {
  const d = new Date(from); d.setDate(d.getDate()+n); return d;
}
function toISO(d: Date) { return d.toISOString().split('T')[0]; }
function fromISO(s: string) { return parseISO(s); }

// ─────────────────────────────────────────────
// DatePicker — input nativo + mini calendário
// ─────────────────────────────────────────────
interface DatePickerProps {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  highlight?: boolean;
  placeholder?: string;
}
function DatePicker({ value, onChange, required, highlight, placeholder }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? fromISO(value) : undefined;

  return (
    <div className="flex items-center gap-1">
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className={cn(
          "w-32 h-8 px-2 rounded-lg text-xs bg-background border text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all",
          highlight ? "border-emerald-500/40" : "border-border"
        )}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-lg border transition-all",
              "hover:bg-muted/60 hover:border-primary/30",
              open ? "border-primary/40 bg-primary/5" : "border-border",
              highlight && "border-emerald-500/30 bg-emerald-500/5"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={d => { if (d) { onChange(toISO(d)); setOpen(false); } }}
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─────────────────────────────────────────────
// Formulário e estados
// ─────────────────────────────────────────────
type FormState = {
  titulo: string;
  descricao: string;
  dataPublicacao: string;
  dataPrazoInterno: string;
  dataPrazoFatal: string;
  prioridade: string;
  responsavel_id: string;
  avisosDias: number[] | null;
  titular: string;
};

function emptyForm(tituloSugerido?: string, numeroProcesso?: string, userId = ""): FormState {
  return {
    titulo: tituloSugerido || "",
    descricao: numeroProcesso ? `Prazo vinculado à publicação do processo ${numeroProcesso}` : "",
    dataPublicacao: "", dataPrazoInterno: "", dataPrazoFatal: "", prioridade: "media",
    responsavel_id: userId,
    avisosDias: null,
    titular: "nosso",
  };
}
function prazoToForm(p: PrazoFormData, userId = ""): FormState {
  return {
    titulo: p.titulo,
    descricao: p.descricao || "",
    dataPublicacao: p.data_publicacao || "",
    dataPrazoInterno: p.data_prazo_interno || "",
    dataPrazoFatal: p.data_fim_prazo || "",
    prioridade: p.prioridade || "media",
    responsavel_id: (p as any).responsavel_id || userId,
    avisosDias: (p as any).avisos_dias ?? null,
    titular: (p as any).titular || "nosso",
  };
}

// ─────────────────────────────────────────────
// Modal de gerenciar tipos de ato (Supabase)
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

function GerenciarTiposModal({ open, onClose, officeId }: GerenciarTiposProps) {
  const { toast } = useToast();
  const [tipos, setTipos] = useState<TipoAto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<TipoAto,'id'>>({ value: '', label: '', diasUteis: 15, corridos: false, margem: 3, ordem: 0 });
  const [adding, setAdding] = useState(false);
  const [feriados, setFeriados] = useState<string[]>([]);
  const [novoFeriado, setNovoFeriado] = useState('');
  const [feriadoAnual, setFeriadoAnual] = useState(false);

  const fetchFeriados = async () => {
    const { data } = await supabase.from('offices').select('settings').eq('id', officeId).single();
    setFeriados(((data?.settings as any)?.prazo_feriados as string[]) ?? []);
  };
  const saveFeriados = async (arr: string[]) => {
    setFeriados(arr);
    const { data: cur } = await supabase.from('offices').select('settings').eq('id', officeId).single();
    const merged = { ...((cur?.settings as any) ?? {}), prazo_feriados: arr };
    await supabase.from('offices').update({ settings: merged }).eq('id', officeId);
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
    const { data } = await supabase
      .from('tipos_ato_prazo')
      .select('*')
      .eq('office_id', officeId)
      .order('ordem', { ascending: true });
    setTipos((data || []).map(dbToTipoAto));
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
    const { error } = await supabase.from('tipos_ato_prazo').update({
      label: draft.label, dias_uteis: draft.diasUteis, corridos: draft.corridos, margem: draft.margem,
    }).eq('id', editingId);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); }
    else { await fetchTipos(); setEditingId(null); }
    setSaving(false);
  };

  const deleteItem = async (t: TipoAto) => {
    setSaving(true);
    const { error } = await supabase.from('tipos_ato_prazo').delete().eq('id', t.id!);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); }
    else { await fetchTipos(); if (editingId === t.id) setEditingId(null); }
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
    await supabase.from('tipos_ato_prazo').delete().eq('office_id', officeId);
    const rows = TIPOS_ATO_DEFAULT.map(t => ({ ...t, office_id: officeId, dias_uteis: t.diasUteis }));
    await supabase.from('tipos_ato_prazo').insert(rows.map(({ diasUteis: _, ...r }) => r));
    await fetchTipos();
    setEditingId(null); setAdding(false);
    toast({ title: 'Tipos restaurados', description: 'Padrões CPC aplicados para o escritório.' });
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
            <div className="flex flex-wrap gap-1.5">
              {feriados.length === 0 && <span className="text-[11px] text-muted-foreground/40 italic">Nenhum feriado adicionado.</span>}
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
              <Button type="button" size="sm" onClick={addFeriado} disabled={!novoFeriado} className="h-8 rounded-lg px-3"><Plus className="h-4 w-4" /></Button>
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

// ─────────────────────────────────────────────
// Dialog principal
// ─────────────────────────────────────────────
const DATE_FIELDS = [
  { key: 'dataPublicacao'   as const, label: 'Data da Publicação', hint: 'Quando foi publicado no diário',  icon: Newspaper,    color: 'text-sky-500',    ring: 'border-sky-500/20',    bg: 'bg-sky-500/5',    required: false },
  { key: 'dataPrazoInterno' as const, label: 'Prazo Interno',       hint: 'Limite interno do escritório',    icon: Shield,       color: 'text-amber-500',  ring: 'border-amber-500/20',  bg: 'bg-amber-500/5',  required: false },
  { key: 'dataPrazoFatal'   as const, label: 'Prazo Fatal',          hint: 'Data limite legal — obrigatório', icon: AlertOctagon, color: 'text-red-500',    ring: 'border-red-500/20',    bg: 'bg-red-500/5',    required: true  },
] as const;
type DateKey = typeof DATE_FIELDS[number]['key'];

export const NovoPrazoStandaloneDialog = ({
  open, onOpenChange, onSuccess, publicacaoId, numeroProcesso, tituloSugerido, prazoParaEditar,
}: NovoPrazoStandaloneDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { users: officeUsers } = useOfficeUsers();
  const membros = officeUsers.map(u => ({
    id: u.user_id,
    label: u.profile?.full_name || u.profile?.email || "Membro",
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormState>(emptyForm(tituloSugerido, numeroProcesso, user?.id));
  const [tipoAto, setTipoAto] = useState('');
  const [dobro, setDobro] = useState(false);
  const [calculoAplicado, setCalculoAplicado] = useState(false);
  const [gerenciarOpen, setGerenciarOpen] = useState(false);
  const [tipos, setTipos] = useState<TipoAto[]>([]);
  const [feriadosAnual, setFeriadosAnual] = useState<Set<string>>(new Set());
  const [feriadosData, setFeriadosData] = useState<Set<string>>(new Set());

  const fetchFeriados = async () => {
    if (!user?.office_id) return;
    const { data } = await supabase.from('offices').select('settings').eq('id', user.office_id).single();
    const arr = ((data?.settings as any)?.prazo_feriados as string[]) ?? [];
    const anual = new Set<string>(); const esp = new Set<string>();
    arr.forEach(s => { if (s.length === 5) anual.add(s); else if (s.length === 10) esp.add(s); });
    setFeriadosAnual(anual); setFeriadosData(esp);
  };

  const isEditing = !!prazoParaEditar?.id;

  // Busca de processo
  const [processoSearch, setProcessoSearch] = useState('');
  const [processoOptions, setProcessoOptions] = useState<ProcessoOption[]>([]);
  const [selectedProcesso, setSelectedProcesso] = useState<ProcessoOption | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchTipos = async () => {
    if (!user?.office_id) return;
    const { data } = await supabase
      .from('tipos_ato_prazo')
      .select('*')
      .eq('office_id', user.office_id)
      .order('ordem', { ascending: true });
    if (data && data.length > 0) {
      setTipos(data.map(dbToTipoAto));
    } else {
      // Primeiro acesso: seed com padrões
      const rows = TIPOS_ATO_DEFAULT.map(t => ({
        office_id: user.office_id, value: t.value, label: t.label,
        dias_uteis: t.diasUteis, corridos: t.corridos, margem: t.margem, ordem: t.ordem,
      }));
      await supabase.from('tipos_ato_prazo').insert(rows);
      setTipos(TIPOS_ATO_DEFAULT.map((t, i) => ({ ...t, id: String(i) })));
    }
  };

  useEffect(() => {
    if (!gerenciarOpen) { fetchTipos(); fetchFeriados(); } // recarrega após fechar modal de gerenciamento
  }, [gerenciarOpen, user?.office_id]);

  useEffect(() => {
    if (open) {
      setFormData(prazoParaEditar ? prazoToForm(prazoParaEditar, user?.id) : emptyForm(tituloSugerido, numeroProcesso, user?.id));
      setProcessoSearch(''); setSelectedProcesso(null); setProcessoOptions([]);
      setTipoAto(''); setDobro(false); setCalculoAplicado(false);
      fetchTipos(); fetchFeriados();
    }
  }, [open, prazoParaEditar, tituloSugerido, numeroProcesso]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowOptions(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    if (!processoSearch.trim() || processoSearch.length < 2 || !user?.office_id) {
      setProcessoOptions([]); return;
    }
    const t = setTimeout(async () => {
      const term = processoSearch.trim();
      const { data } = await supabase.from('processos').select('id, titulo, numero_processo')
        .eq('office_id', user.office_id).eq('deletado', false)
        .or(`titulo.ilike.%${term}%,numero_processo.ilike.%${term}%`).limit(6);
      setProcessoOptions((data || []) as ProcessoOption[]);
      setShowOptions(true);
    }, 300);
    return () => clearTimeout(t);
  }, [processoSearch, user?.office_id]);

  const calcularDatas = (tipo: string, pubDate: string, emDobro = dobro) => {
    const ato = tipos.find(t => t.value === tipo);
    if (!ato || !pubDate) return;
    const dias = emDobro ? ato.diasUteis * 2 : ato.diasUteis; // CPC 229/183/180/186
    const pub = new Date(`${pubDate}T12:00:00`);
    const intimacao = addDiasUteisWith(pub, 1, feriadosAnual, feriadosData); // CPC art. 231
    const fatal = ato.corridos ? addDiasCorridos(intimacao, dias) : addDiasUteisWith(intimacao, dias, feriadosAnual, feriadosData);
    const internoDias = Math.max(1, dias - ato.margem);
    const interno = ato.corridos
      ? addDiasCorridos(intimacao, internoDias)
      : addDiasUteisWith(intimacao, internoDias, feriadosAnual, feriadosData);
    setFormData(prev => ({ ...prev, dataPrazoFatal: toISO(fatal), dataPrazoInterno: toISO(interno) }));
    setCalculoAplicado(true);
  };

  const handleTipoChange = (v: string) => {
    setTipoAto(v); setCalculoAplicado(false);
    if (formData.dataPublicacao && v) calcularDatas(v, formData.dataPublicacao);
  };

  const handleDobroChange = (v: boolean) => {
    setDobro(v);
    if (tipoAto && formData.dataPublicacao) calcularDatas(tipoAto, formData.dataPublicacao, v);
  };

  const handleDateChange = (field: string, v: string) => {
    setFormData(prev => ({ ...prev, [field]: v }));
    if (field === 'dataPublicacao') {
      setCalculoAplicado(false);
      if (tipoAto && v) calcularDatas(tipoAto, v);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !formData.dataPrazoFatal) {
      toast({ title: "Campos obrigatórios", description: "Preencha o título e o prazo fatal.", variant: "destructive" }); return;
    }
    if (!user?.id) { toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" }); return; }

    setIsLoading(true);
    try {
      if (isEditing) {
        const updates: Record<string, unknown> = {
          titulo: formData.titulo, descricao: formData.descricao || null,
          data_fim_prazo: formData.dataPrazoFatal, prioridade: formData.prioridade,
          data_publicacao: formData.dataPublicacao || null,
          data_prazo_interno: formData.dataPrazoInterno || null,
          responsavel_id: formData.responsavel_id || user?.id || null,
          titular: formData.titular,
        };
        if (formData.avisosDias != null) updates.avisos_dias = formData.avisosDias;
        let { error } = await supabase.from('prazos').update(updates).eq('id', prazoParaEditar!.id!);
        if (error && /titular/.test(error.message || '')) { // coluna ainda não criada
          const { titular: _t, ...semTitular } = updates;
          ({ error } = await supabase.from('prazos').update(semTitular).eq('id', prazoParaEditar!.id!));
        }
        if (error) throw error;
        toast({ title: "Prazo atualizado", description: "As alterações foram salvas." });
      } else {
        let processoId: string | null = selectedProcesso?.id || null;
        if (!processoId && numeroProcesso && user.office_id) {
          const { data } = await supabase.from('processos').select('id')
            .eq('numero_processo', numeroProcesso.replace(/\D/g, '')).eq('office_id', user.office_id).maybeSingle();
          processoId = data?.id || null;
        }
        const payload: Record<string, unknown> = {
          user_id: user.id, office_id: user.office_id, processo_id: processoId,
          publicacao_id: publicacaoId || null, titulo: formData.titulo,
          descricao: formData.descricao || null, data_fim_prazo: formData.dataPrazoFatal,
          prioridade: formData.prioridade, status: 'pendente',
          responsavel_id: formData.responsavel_id || user.id,
        };
        if (formData.dataPublicacao) payload.data_publicacao = formData.dataPublicacao;
        if (formData.dataPrazoInterno) payload.data_prazo_interno = formData.dataPrazoInterno;
        if (formData.avisosDias != null) payload.avisos_dias = formData.avisosDias;
        payload.titular = formData.titular;
        let { error } = await supabase.from('prazos').insert(payload);
        if (error && /titular/.test(error.message || '')) { // coluna ainda não criada
          const { titular: _t, ...semTitular } = payload;
          ({ error } = await supabase.from('prazos').insert(semTitular));
        }
        if (error) throw error;
        toast({ title: "Prazo adicionado", description: "O prazo foi salvo com sucesso." });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      toast({ title: "Erro ao salvar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const atoSelecionado = tipos.find(t => t.value === tipoAto);

  return (
    <>
      <GerenciarTiposModal open={gerenciarOpen} onClose={() => setGerenciarOpen(false)} officeId={user?.office_id || ''} />

      <Dialog open={open} onOpenChange={v => { if (!v) onOpenChange(false); }}>
        <DialogContent aria-describedby={undefined} className="max-w-md bg-background border border-border p-0 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto [&>button]:z-20">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
            <DialogTitle className="flex items-center gap-2.5 text-base font-black text-foreground">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                <CalendarClock className="h-4 w-4" />
              </div>
              {isEditing ? "Editar Prazo" : "Agendar Prazo"}
            </DialogTitle>
            {numeroProcesso && (
              <p className="text-[11px] text-muted-foreground font-mono mt-1 ml-0.5">Processo: {numeroProcesso}</p>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

            {/* Título */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Título <span className="text-red-500">*</span>
              </Label>
              <Input value={formData.titulo} onChange={e => setFormData(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Ex: Contestação, Recurso, Manifestação..." className="rounded-xl h-10" required />
            </div>

            {/* Processo vinculado */}
            {!numeroProcesso && (
              <div className="space-y-1.5" ref={searchRef}>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Processo vinculado
                </Label>
                {selectedProcesso ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/30 bg-primary/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{selectedProcesso.titulo}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{selectedProcesso.numero_processo}</p>
                    </div>
                    <button type="button" onClick={() => { setSelectedProcesso(null); setProcessoSearch(''); }}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    <Input value={processoSearch} onChange={e => setProcessoSearch(e.target.value)}
                      onFocus={() => processoOptions.length > 0 && setShowOptions(true)}
                      placeholder="Buscar por número ou nome..." className="pl-9 h-10 rounded-xl text-sm" />
                    {showOptions && processoOptions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                        {processoOptions.map(p => (
                          <button key={p.id} type="button"
                            onMouseDown={() => { setSelectedProcesso(p); setProcessoSearch(''); setShowOptions(false); }}
                            className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0">
                            <p className="text-xs font-bold truncate">{p.titulo}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{p.numero_processo}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── CALCULADORA ── */}
            {!isEditing && (
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-violet-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">Calculadora automática</p>
                  </div>
                  <button type="button" onClick={() => setGerenciarOpen(true)}
                    className="text-[10px] text-violet-500 hover:text-violet-700 font-bold underline underline-offset-2 transition-colors flex items-center gap-1">
                    <Pencil className="h-2.5 w-2.5" /> Gerenciar tipos
                  </button>
                </div>

                {/* Data da publicação com calendário */}
                <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80 leading-none mb-0.5 flex items-center gap-1">
                      <Newspaper className="h-3 w-3 text-sky-500" /> Data da Publicação
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 leading-none">Intimação = pub. + 1 dia útil (CPC 231)</p>
                  </div>
                  <DatePicker
                    value={formData.dataPublicacao}
                    onChange={v => handleDateChange('dataPublicacao', v)}
                  />
                </div>

                {/* Tipo de ato */}
                <div className="flex gap-2">
                  <Select value={tipoAto} onValueChange={handleTipoChange} disabled={!formData.dataPublicacao}>
                    <SelectTrigger className={cn("flex-1 rounded-xl h-10 text-sm", !formData.dataPublicacao && "opacity-50")}>
                      <SelectValue placeholder={formData.dataPublicacao ? "Selecionar tipo de ato..." : "Informe a data de publicação primeiro"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {tipos.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                          <span className="text-muted-foreground ml-1 text-[10px]">
                            ({t.diasUteis}d {t.corridos ? 'corridos' : 'úteis'})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Prazo em dobro */}
                <label className="flex items-center gap-2 px-2 py-2 rounded-lg border border-violet-500/20 bg-violet-500/5 cursor-pointer select-none">
                  <input type="checkbox" checked={dobro} onChange={e => handleDobroChange(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-violet-500" />
                  <span className="text-[11px] font-bold text-foreground/80">
                    Prazo em dobro <span className="text-muted-foreground/60 font-normal">(litisconsortes / Fazenda / MP / Defensoria)</span>
                  </span>
                </label>

                {/* Confirmação do cálculo */}
                {calculoAplicado && atoSelecionado && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Zap className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-emerald-600 font-bold leading-relaxed">
                      Calculado: {dobro ? atoSelecionado.diasUteis * 2 : atoSelecionado.diasUteis}d {atoSelecionado.corridos ? 'corridos' : 'úteis'}{dobro ? ' (em dobro)' : ''} a partir da intimação.
                      Prazo interno com {atoSelecionado.margem}d de antecedência.
                      Ajuste manualmente se necessário.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Datas com DatePicker */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {isEditing ? 'Datas' : 'Ajuste fino das datas'}
              </Label>
              <div className="space-y-2">
                {DATE_FIELDS.filter(f => isEditing ? true : f.key !== 'dataPublicacao').map(
                  ({ key, label, hint, icon: Icon, color, ring, bg, required }) => (
                    <div key={key} className={cn(
                      'grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border px-3 py-2.5 transition-all',
                      bg, ring,
                      calculoAplicado && (key === 'dataPrazoFatal' || key === 'dataPrazoInterno') && 'ring-1 ring-emerald-500/30'
                    )}>
                      <div className={cn('shrink-0', color)}><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80 leading-none mb-0.5">
                          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 leading-none">{hint}</p>
                      </div>
                      <DatePicker
                        value={formData[key as DateKey]}
                        onChange={v => handleDateChange(key, v)}
                        required={required}
                        highlight={calculoAplicado && (key === 'dataPrazoFatal' || key === 'dataPrazoInterno')}
                      />
                    </div>
                  )
                )}
              </div>
            </div>

            {/* De quem é o prazo */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">De quem é o prazo?</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setFormData(p => ({ ...p, titular: 'nosso' }))}
                  className={cn("h-10 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all",
                    formData.titular === 'nosso' ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-foreground/20")}>
                  Nosso escritório
                </button>
                <button type="button" onClick={() => setFormData(p => ({ ...p, titular: 'contraria' }))}
                  className={cn("h-10 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all",
                    formData.titular === 'contraria' ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400" : "border-border text-muted-foreground hover:border-foreground/20")}>
                  Parte contrária
                </button>
              </div>
              {formData.titular === 'contraria' && (
                <p className="text-[10px] text-muted-foreground/60">Somente acompanhamento — não gera alertas no sino.</p>
              )}
            </div>

            {/* Prioridade */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prioridade</Label>
              <Select value={formData.prioridade} onValueChange={v => setFormData(p => ({ ...p, prioridade: v }))}>
                <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="alta">🔴 Alta</SelectItem>
                  <SelectItem value="media">🟡 Média</SelectItem>
                  <SelectItem value="baixa">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Avisar (antecedência do lembrete) */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avisar</Label>
              <AvisoDiasSelect value={formData.avisosDias} onChange={v => setFormData(p => ({ ...p, avisosDias: v }))} />
            </div>

            {/* Responsável */}
            {membros.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Responsável</Label>
                <Select value={formData.responsavel_id} onValueChange={v => setFormData(p => ({ ...p, responsavel_id: v }))}>
                  <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {membros.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observações</Label>
              <Textarea value={formData.descricao} onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Detalhes adicionais do prazo..." rows={2} className="rounded-xl resize-none text-sm" />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}
                className="flex-1 rounded-xl h-10" disabled={isLoading}>Cancelar</Button>
              <Button type="submit" className="flex-1 rounded-xl h-10 font-black" disabled={isLoading}>
                {isLoading ? "Salvando…" : isEditing ? "Salvar Alterações" : "Criar Prazo"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
