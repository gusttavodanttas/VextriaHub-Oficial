import React, { useState } from 'react';
import { Share2, Mail, Trash2, RotateCw, Eye, PencilLine, Building2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useProcessoShareManager, type SharePermission } from '@/hooks/useProcessShares';

interface Props {
  processoId: string;
  active: boolean; // só busca quando a aba está aberta
}

export const ProcessoShareManager: React.FC<Props> = ({ processoId, active }) => {
  const { shares, loading, shareByEmail, revokeShare, sharing, revoking } = useProcessoShareManager(processoId, active);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<SharePermission>('ver');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await shareByEmail(email, permission);
      setEmail('');
      setPermission('ver');
    } catch {
      /* erro já exibido via toast no hook */
    }
  };

  return (
    <div className="space-y-6">
      {/* Explicação */}
      <div className="flex items-start gap-3 p-4 rounded-2xl border border-primary/15 bg-primary/5">
        <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
          <Share2 className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground">Compartilhar com escritório parceiro</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            O parceiro passa a ver este processo e tudo que está sendo feito nele (andamentos, prazos, audiências e tarefas).
            Seu financeiro e timesheet <span className="font-semibold">não</span> são compartilhados. Você pode revogar quando quiser.
          </p>
        </div>
      </div>

      {/* Formulário de convite */}
      <form onSubmit={handleShare} className="p-5 rounded-2xl border border-border bg-muted/20 space-y-4">
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">E-mail do escritório parceiro</p>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e-mail de cadastro do escritório ou do administrador"
              className="h-10 pl-9 rounded-xl bg-background border-border text-sm"
              required
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="space-y-1.5 flex-1">
            <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">Permissão</p>
            <Select value={permission} onValueChange={(v) => setPermission(v as SharePermission)}>
              <SelectTrigger className="h-10 rounded-xl bg-background border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ver">
                  <span className="flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> Somente ver</span>
                </SelectItem>
                <SelectItem value="editar">
                  <span className="flex items-center gap-2"><PencilLine className="h-3.5 w-3.5" /> Ver e editar</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={sharing || !email.trim()} className="h-10 rounded-xl gap-2 font-bold text-xs px-5">
            {sharing ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
            Compartilhar
          </Button>
        </div>
      </form>

      {/* Lista de compartilhamentos ativos */}
      <div className="space-y-3">
        <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">
          {loading ? 'Carregando…' : shares.length > 0 ? `${shares.length} escritório(s) com acesso` : 'Nenhum compartilhamento ativo'}
        </p>

        {shares.map((s) => (
          <div key={s.id} className="p-4 rounded-2xl border border-border bg-muted/10 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-sky-500/10 shrink-0">
              <Building2 className="h-5 w-5 text-sky-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{s.shared_office_name || 'Escritório parceiro'}</p>
              <Badge
                variant="outline"
                className={cn(
                  'text-[9px] font-bold uppercase mt-1 gap-1',
                  s.permission === 'editar'
                    ? 'border-amber-500/30 text-amber-600 bg-amber-500/10'
                    : 'border-slate-500/30 text-slate-500 bg-slate-500/5'
                )}
              >
                {s.permission === 'editar' ? <PencilLine className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                {s.permission === 'editar' ? 'Vê e edita' : 'Somente vê'}
              </Badge>
            </div>
            {confirmId === s.id ? (
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="destructive" className="h-8 rounded-xl text-[10px] font-black uppercase" disabled={revoking} onClick={() => revokeShare(s.id).finally(() => setConfirmId(null))}>
                  {revoking ? <RotateCw className="h-3 w-3 animate-spin" /> : 'Remover'}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-xl text-[10px] font-black uppercase" onClick={() => setConfirmId(null)}>Cancelar</Button>
              </div>
            ) : (
              <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl text-muted-foreground/50 hover:text-rose-500 shrink-0" title="Revogar acesso" onClick={() => setConfirmId(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}

        {!loading && shares.length === 0 && (
          <div className="py-10 flex flex-col items-center justify-center text-center space-y-2 opacity-40">
            <Shield className="h-8 w-8" />
            <p className="font-black uppercase tracking-widest text-[10px]">Este processo é privado do seu escritório</p>
          </div>
        )}
      </div>
    </div>
  );
};
