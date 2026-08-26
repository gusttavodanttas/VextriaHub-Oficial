import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Handshake, Check, RotateCw, MapPin, CalendarClock } from 'lucide-react';
import { useCorrespondentes } from '@/hooks/useCorrespondentes';

interface AudienciaLite {
  id: string;
  titulo?: string | null;
  local?: string | null;
  processo_id?: string | null;
  data_audiencia: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  audiencia: AudienciaLite | null;
}

const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const DesignarCorrespondenteDialog: React.FC<Props> = ({ open, onOpenChange, audiencia }) => {
  const navigate = useNavigate();
  const { correspondentes, saveDiligencia, savingDiligencia } = useCorrespondentes();
  const ativos = correspondentes.filter((c) => c.ativo);

  const [correspondenteId, setCorrespondenteId] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');

  // Ao abrir/trocar de audiência, reseta e pré-preenche a descrição com o título.
  useEffect(() => {
    if (open) {
      setCorrespondenteId('');
      setValor('');
      setDescricao(audiencia?.titulo || '');
    }
  }, [open, audiencia?.id, audiencia?.titulo]);

  // Ao escolher o correspondente, sugere o valor padrão dele.
  const onSelectCorrespondente = (id: string) => {
    setCorrespondenteId(id);
    const c = correspondentes.find((x) => x.id === id);
    if (c?.valor_padrao != null) setValor(String(c.valor_padrao));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audiencia) return;
    const ok = await saveDiligencia(undefined, {
      correspondente_id: correspondenteId || null,
      tipo: 'audiencia',
      audiencia_id: audiencia.id,
      processo_id: audiencia.processo_id ?? null,
      comarca: audiencia.local ?? null,
      data_diligencia: audiencia.data_audiencia,
      descricao: descricao.trim() || audiencia.titulo || null,
      valor: valor ? Number(valor) : null,
      status: 'solicitada',
    }).then(() => true).catch(() => false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-md rounded-3xl">
        <DialogTitle className="text-xl font-black flex items-center gap-2">
          <span className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Handshake className="h-4 w-4" /></span>
          Designar correspondente
        </DialogTitle>

        {audiencia && (
          <div className="rounded-2xl border border-border bg-muted/20 p-3 text-xs space-y-1">
            <p className="font-bold text-sm">{audiencia.titulo || 'Audiência'}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
              <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{fmtDateTime(audiencia.data_audiencia)}</span>
              {audiencia.local && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{audiencia.local}</span>}
            </div>
          </div>
        )}

        {ativos.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Nenhum correspondente cadastrado ainda.</p>
            <Button onClick={() => { onOpenChange(false); navigate('/correspondentes'); }} className="rounded-xl gap-2">
              <Handshake className="h-4 w-4" /> Cadastrar correspondente
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Correspondente</label>
              <select value={correspondenteId} onChange={(e) => onSelectCorrespondente(e.target.value)} required
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
                <option value="" disabled>Selecione…</option>
                {ativos.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.uf ? ` (${c.uf})` : ''}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Valor combinado (R$)</label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Instruções (opcional)</label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que o correspondente precisa fazer…" className="rounded-xl min-h-[70px]" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
              <Button type="submit" disabled={savingDiligencia || !correspondenteId} className="rounded-xl gap-2">
                {savingDiligencia ? <RotateCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Designar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
