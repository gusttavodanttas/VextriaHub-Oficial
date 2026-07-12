// StatCard e dialog de configurações do Timesheet — extraídos de pages/Timesheet.tsx.
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock, Play, Pause, Square, Timer, Plus, TrendingUp,
  FileText, Users, Phone, Gavel, Scale, Search, BookOpen,
  CalendarDays, CalendarClock, AlertCircle, CheckSquare,
  UserCircle, MessageSquareText, ExternalLink, ArrowRight,
  Pencil, Trash2, MoreVertical, DollarSign, Receipt, PlayCircle, PenLine,
  Settings2, BadgeCheck, Layers, AlertTriangle, Loader2,
} from "lucide-react";
import { useTimesheet } from "@/hooks/useTimesheet";
import { useTimesheetConfig, roundMinutes, type Arredondamento, type TimesheetConfig } from "@/hooks/useTimesheetConfig";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TIMESHEET_CATEGORIAS, type TimesheetCategoria } from "@/types/timesheet";
import { cn } from "@/lib/utils";
import { formatBRL } from "./shared";

function StatCard({ label, value, sub, Icon, color }: { label: string; value: string; sub?: string; Icon: React.FC<any>; color: string }) {
  return (
    <div className="glass-card rounded-2xl border border-black/5 dark:border-border bg-card/40 shadow-premium p-3.5 sm:p-5 flex items-center gap-3 sm:gap-4">
      <div className={cn("h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 truncate">{label}</p>
        <p className="text-lg sm:text-2xl font-black tracking-tight truncate">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground/50 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

const NONE = "__none__";

// ─── Settings Dialog (faturamento) ──────────────────────────────────────────────

const TimesheetSettingsDialog: React.FC<{
  open: boolean; onClose: () => void;
  config: TimesheetConfig; clientes: { id: string; nome: string }[];
  onSave: (cfg: Partial<TimesheetConfig>) => Promise<void>;
}> = ({ open, onClose, config, clientes, onSave }) => {
  const [padrao, setPadrao] = useState("");
  const [arred, setArred] = useState<Arredondamento>("nenhum");
  const [mapa, setMapa] = useState<Record<string, number>>({});
  const [novoCli, setNovoCli] = useState("");
  const [novoRate, setNovoRate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPadrao(config.valorPadrao != null ? String(config.valorPadrao) : "");
    setArred(config.arredondamento);
    setMapa({ ...config.valorClientes });
    setNovoCli(""); setNovoRate("");
  }, [open, config]);

  const nomeCli = (id: string) => clientes.find(c => c.id === id)?.nome || id;
  const addRate = () => { if (!novoCli || !novoRate) return; setMapa(m => ({ ...m, [novoCli]: Number(novoRate) })); setNovoCli(""); setNovoRate(""); };
  const salvar = async () => { setSaving(true); await onSave({ valorPadrao: padrao ? Number(padrao) : null, arredondamento: arred, valorClientes: mapa }); setSaving(false); onClose(); };

  const disponiveis = clientes.filter(c => mapa[c.id] == null);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 pt-5 pb-4 border-b border-black/5 dark:border-border shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-base">
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center"><Settings2 className="h-3.5 w-3.5 text-primary" /></div>
              Configurações de faturamento
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Valor/hora padrão</Label>
              <Input type="number" min={0} step="0.01" value={padrao} onChange={e => setPadrao(e.target.value)} placeholder="Ex: 350" className="h-10 rounded-xl text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Arredondamento</Label>
              <Select value={arred} onValueChange={(v) => setArred(v as Arredondamento)}>
                <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem arredondar</SelectItem>
                  <SelectItem value="6">6 min (0,1h)</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Valor/hora por cliente</Label>
            {Object.keys(mapa).length === 0 && <p className="text-xs text-muted-foreground/40 italic">Nenhum valor específico. Usa o padrão.</p>}
            <div className="space-y-1.5">
              {Object.entries(mapa).map(([cid, rate]) => (
                <div key={cid} className="flex items-center gap-2 rounded-lg border border-black/5 dark:border-border px-3 py-1.5">
                  <span className="flex-1 text-sm font-semibold truncate">{nomeCli(cid)}</span>
                  <span className="text-sm font-bold tabular-nums">{rate.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/h</span>
                  <button onClick={() => setMapa(m => { const n = { ...m }; delete n[cid]; return n; })} className="text-muted-foreground/40 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Select value={novoCli} onValueChange={setNovoCli}>
                <SelectTrigger className="h-9 rounded-lg text-sm flex-1"><SelectValue placeholder="Cliente" /></SelectTrigger>
                <SelectContent className="max-h-60">{disponiveis.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" min={0} step="0.01" value={novoRate} onChange={e => setNovoRate(e.target.value)} placeholder="R$/h" className="h-9 rounded-lg text-sm w-24" />
              <Button size="sm" onClick={addRate} disabled={!novoCli || !novoRate} className="h-9 rounded-lg px-3"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2 justify-end border-t border-black/5 dark:border-border pt-3 shrink-0">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button onClick={salvar} disabled={saving} className="rounded-xl font-black px-6">{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export { StatCard, TimesheetSettingsDialog };
