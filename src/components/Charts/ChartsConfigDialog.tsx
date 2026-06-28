import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trophy, AlertTriangle } from "lucide-react";
import type { PontosConfig } from "@/hooks/useChartsData";

export function ChartsConfigDialog({
  open, onClose, officeId, pontos, tiposPrazo, tiposAudiencia, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  officeId: string;
  pontos: PontosConfig;
  tiposPrazo: string[];
  tiposAudiencia: string[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [tarefa, setTarefa] = useState(pontos.tarefa);
  const [processo, setProcesso] = useState(pontos.processo);
  const [penalidade, setPenalidade] = useState(pontos.penalidadeAtraso);
  const [prazoMap, setPrazoMap] = useState<Record<string, number>>(pontos.prazo);
  const [audMap, setAudMap] = useState<Record<string, number>>(pontos.audiencia);
  const [allPrazoTipos, setAllPrazoTipos] = useState<string[]>(tiposPrazo);
  const [allAudTipos, setAllAudTipos] = useState<string[]>(tiposAudiencia);
  const [saving, setSaving] = useState(false);

  // Busca os tipos cadastrados no escritório (aparecem mesmo sem item criado)
  useEffect(() => {
    if (!open || !officeId) return;
    (async () => {
      const [pz, au] = await Promise.all([
        supabase.from("tipos_ato_prazo").select("label").eq("office_id", officeId),
        supabase.from("audiencia_tipos").select("nome").eq("office_id", officeId),
      ]);
      const pzTipos = (pz.data || []).map((r: any) => String(r.label).trim()).filter(Boolean);
      const auTipos = (au.data || []).map((r: any) => String(r.nome).trim()).filter(Boolean);
      setAllPrazoTipos([...new Set([...tiposPrazo, ...pzTipos])].sort());
      setAllAudTipos([...new Set([...tiposAudiencia, ...auTipos])].sort());
    })();
  }, [open, officeId, tiposPrazo, tiposAudiencia]);

  useEffect(() => {
    if (open) {
      setTarefa(pontos.tarefa); setProcesso(pontos.processo); setPenalidade(pontos.penalidadeAtraso);
      const pm: Record<string, number> = { _default: pontos.prazo._default, ...pontos.prazo };
      allPrazoTipos.forEach(t => { if (pm[t] === undefined) pm[t] = pontos.prazo._default; });
      setPrazoMap(pm);
      const am: Record<string, number> = { _default: pontos.audiencia._default, ...pontos.audiencia };
      allAudTipos.forEach(t => { if (am[t] === undefined) am[t] = pontos.audiencia._default; });
      setAudMap(am);
    }
  }, [open, pontos, allPrazoTipos, allAudTipos]);

  const handleSave = async () => {
    setSaving(true);
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", officeId).maybeSingle();
    const clean = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Number(v) || 0]));
    const merged = {
      ...((cur?.settings as any) || {}),
      chart_pontos: {
        tarefa: Number(tarefa) || 0,
        processo: Number(processo) || 0,
        penalidadeAtraso: Number(penalidade) || 0,
        prazo: clean(prazoMap),
        audiencia: clean(audMap),
      },
      chart_meta: null, // meta de contratos fica no CRM
    };
    const { error } = await supabase.from("offices").update({ settings: merged }).eq("id", officeId);
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Pontuação salva" });
    onSaved();
    onClose();
  };

  const TipoRows = ({ map, setMap, tipos }: { map: Record<string, number>; setMap: (m: Record<string, number>) => void; tipos: string[] }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-[11px] text-muted-foreground flex-1">Padrão (tipos sem valor específico)</Label>
        <Input type="number" min={0} value={map._default ?? 0}
          onChange={e => setMap({ ...map, _default: Number(e.target.value) })}
          className="h-8 w-20 rounded-lg text-xs" />
      </div>
      {tipos.map(t => (
        <div key={t} className="flex items-center gap-2">
          <Label className="text-[11px] flex-1 truncate">{t}</Label>
          <Input type="number" min={0} value={map[t] ?? map._default ?? 0}
            onChange={e => setMap({ ...map, [t]: Number(e.target.value) })}
            className="h-8 w-20 rounded-lg text-xs" />
        </div>
      ))}
      {tipos.length === 0 && <p className="text-[10px] text-muted-foreground/50">Nenhum tipo cadastrado ainda — use o valor padrão.</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden max-h-[88vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-base font-black flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" /> Pontuação de Produtividade
          </DialogTitle>
          <DialogDescription className="text-xs">Defina quantos pontos vale cada finalização. Prazos e audiências podem ter pontuação por tipo.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Tarefa concluída</Label>
              <Input type="number" min={0} value={tarefa} onChange={e => setTarefa(Number(e.target.value))} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Processo encerrado</Label>
              <Input type="number" min={0} value={processo} onChange={e => setProcesso(Number(e.target.value))} className="h-9 rounded-xl" />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Prazos (por tipo)</p>
            <TipoRows map={prazoMap} setMap={setPrazoMap} tipos={allPrazoTipos} />
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Audiências (por tipo)</p>
            <TipoRows map={audMap} setMap={setAudMap} tipos={allAudTipos} />
          </div>

          <div className="space-y-1 pt-2 border-t border-border">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Penalidade por item em atraso (pontos descontados)
            </Label>
            <Input type="number" min={0} value={penalidade} onChange={e => setPenalidade(Number(e.target.value))} className="h-9 rounded-xl w-28" />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs font-bold" disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} className="rounded-xl text-xs font-black" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
