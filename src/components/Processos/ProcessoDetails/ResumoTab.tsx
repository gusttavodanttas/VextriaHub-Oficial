import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, DollarSign, Gavel, MapPin, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBRL } from '@/lib/currency';
import { Processo } from '@/types/processo';
import type { useOfficeTeams } from '@/hooks/useOfficeTeams';
import type { useOfficeUsers } from '@/hooks/useOfficeUsers';
import { CapaField } from './shared';
import type { ProcessoEditData, SetEditData } from './helpers';

const RESULTADO_LABELS: Record<string, string> = {
  ganho: 'Ganho', parcial: 'Parcialmente procedente', acordo: 'Acordo', perda: 'Perda', extinto: 'Extinto sem mérito',
};

interface Props {
  processo: Processo;
  editing: boolean;
  editData: ProcessoEditData;
  setEditData: SetEditData;
  officeTeams: ReturnType<typeof useOfficeTeams>['teams'];
  officeUsers: ReturnType<typeof useOfficeUsers>['users'];
  currentUserId?: string;
}

/** Aba "Resumo": valor da causa, capa jurídica (editável), cliente e partes. */
export function ResumoTab({ processo, editing, editData, setEditData, officeTeams, officeUsers, currentUserId }: Props) {
  // Atalho: liga um campo da capa ao editData (setState funcional evita closure obsoleto)
  const fieldProps = (field: keyof ProcessoEditData) => ({
    editing,
    value: String(editData[field] ?? ''),
    onChange: (v: string) =>
      setEditData((prev) => ({ ...prev, [field]: field === 'valor_causa' ? Number(v) || 0 : v })),
  });

  const team = officeTeams.find(t => t.id === editData.team_id);
  const resp = officeUsers.find(u => u.user_id === editData.responsavel_id);
  const respNome = resp?.profile?.full_name || resp?.profile?.email;
  const resultadoLabel = RESULTADO_LABELS[editData.resultado];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <DollarSign className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Valor da Causa</span>
          </div>
          {editing ? (
            <Input type="number" className="h-10 rounded-xl bg-background border-border" value={editData.valor_causa} onChange={(e) => setEditData({ ...editData, valor_causa: Number(e.target.value) || 0 })} />
          ) : (
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
              {formatBRL(processo.valorCausa)}
            </p>
          )}
        </div>
        <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-2">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Scale className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Classe</span>
          </div>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400 uppercase leading-tight">
            {processo.classeJudicial || processo.tipoProcesso || '—'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[.2em]">
          <Gavel className="h-4 w-4" /><span>Capa Jurídica</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 rounded-2xl border border-border bg-muted/20">
          <CapaField label="Classe" {...fieldProps('classe_judicial')} />
          <CapaField label="Assunto Principal" {...fieldProps('assunto_principal')} />
          <CapaField label="Fase Atual" {...fieldProps('fase_processual')} />
          <CapaField label="Instância" {...fieldProps('instancia')} />
          <CapaField label="Tribunal" icon={<Building2 className="h-3.5 w-3.5 text-primary/60" />} {...fieldProps('tribunal')} />
          <CapaField label="Vara" icon={<MapPin className="h-3.5 w-3.5 text-primary/60" />} {...fieldProps('vara')} />
          <CapaField label="Comarca / UF" {...fieldProps('comarca')} />

          {officeTeams.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">Equipe Responsável</p>
              {editing ? (
                <Select
                  value={editData.team_id || 'none'}
                  onValueChange={(v) => setEditData({ ...editData, team_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className="h-10 text-sm rounded-xl bg-background border-border">
                    <SelectValue placeholder="Sem equipe específica" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem equipe específica</SelectItem>
                    {officeTeams.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                          {t.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 min-h-[40px] px-3 py-2 rounded-xl bg-muted/20 border border-transparent">
                  {team
                    ? <><span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: team.color }} /><p className="text-sm font-semibold">{team.name}</p></>
                    : <p className="text-sm font-semibold text-foreground/40">—</p>}
                </div>
              )}
            </div>
          )}

          {officeUsers.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">Responsável</p>
              {editing ? (
                <Select
                  value={editData.responsavel_id || ''}
                  onValueChange={(v) => setEditData({ ...editData, responsavel_id: v })}
                >
                  <SelectTrigger className="h-10 text-sm rounded-xl bg-background border-border">
                    <SelectValue placeholder="Selecionar responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {officeUsers.map(u => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.profile?.full_name || u.profile?.email || "Membro"}
                        {u.user_id === currentUserId ? " (você)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 min-h-[40px] px-3 py-2 rounded-xl bg-muted/20 border border-transparent">
                  <p className={cn("text-sm font-semibold", !respNome && "text-foreground/40")}>{respNome || "—"}</p>
                </div>
              )}
            </div>
          )}

          {/* Situação / Status do processo (Em andamento / Suspenso / Concluído) */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">Situação</p>
            {editing ? (
              <Select value={editData.status || 'Em andamento'} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                <SelectTrigger className="h-10 text-sm rounded-xl bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Suspenso">Suspenso</SelectItem>
                  <SelectItem value="Concluído">Concluído / Encerrado</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 min-h-[40px] px-3 py-2 rounded-xl bg-muted/20 border border-transparent">
                <p className="text-sm font-semibold">{editData.status || 'Em andamento'}</p>
              </div>
            )}
          </div>

          {/* Resultado / Desfecho */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">Resultado</p>
            {editing ? (
              <Select value={editData.resultado || 'none'} onValueChange={(v) => setEditData({ ...editData, resultado: v === 'none' ? '' : v })}>
                <SelectTrigger className="h-10 text-sm rounded-xl bg-background border-border">
                  <SelectValue placeholder="Sem desfecho" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem desfecho</SelectItem>
                  <SelectItem value="ganho">Ganho (procedente)</SelectItem>
                  <SelectItem value="parcial">Parcialmente procedente</SelectItem>
                  <SelectItem value="acordo">Acordo</SelectItem>
                  <SelectItem value="perda">Perda (improcedente)</SelectItem>
                  <SelectItem value="extinto">Extinto sem mérito</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 min-h-[40px] px-3 py-2 rounded-xl bg-muted/20 border border-transparent">
                <p className={cn("text-sm font-semibold", !resultadoLabel && "text-foreground/40")}>{resultadoLabel || "—"}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {processo.clienteId && processo.cliente && !editing && (
        <div className="p-4 rounded-2xl border border-primary/15 bg-primary/5">
          <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1">Cliente</p>
          <p className="text-sm font-bold">{processo.cliente}</p>
        </div>
      )}
      {(processo.parteAutora || processo.requerido) && !editing && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl border border-emerald-500/10 bg-emerald-500/5">
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest mb-1">Autor</p>
            <p className="text-sm font-bold">{processo.parteAutora || 'Não identificado'}</p>
          </div>
          <div className="p-4 rounded-2xl border border-rose-500/10 bg-rose-500/5">
            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-black uppercase tracking-widest mb-1">Réu</p>
            <p className="text-sm font-bold">{processo.requerido || 'Não identificado'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
