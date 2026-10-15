// Formulário de cadastro detalhado do "Novo Processo" (identificação + capa jurídica) —
// extraído de NovoProcessoDialog.tsx sem mudança de comportamento. O estado e os
// handlers (formData/handleChange/submit) continuam no diálogo.
import type { Dispatch, SetStateAction, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gavel, Info, AlertTriangle } from 'lucide-react';
import { CreatableSelect } from '@/components/Settings/CreatableSelect';
import { ClientSelect } from '@/components/Clientes/ClientSelect';
import type { TipoProcesso } from '@/components/Settings/ProcessTypeSimple';
import type { useOfficeTeams } from '@/hooks/useOfficeTeams';
import type { useOfficeUsers } from '@/hooks/useOfficeUsers';
import { maskCNJ } from '@/utils/formatCNJ';
import { formatBRL } from '@/lib/currency';
import type { ProcessoCreateInput } from '@/types/processo';

interface Props {
  formData: ProcessoCreateInput;
  setFormData: Dispatch<SetStateAction<ProcessoCreateInput>>;
  handleChange: <K extends keyof ProcessoCreateInput>(field: K, value: ProcessoCreateInput[K]) => void;
  partesNaoLocalizadas: boolean;
  tiposProcessoCfg: TipoProcesso[];
  persistTipos: (items: TipoProcesso[]) => void;
  officeTeams: ReturnType<typeof useOfficeTeams>['teams'];
  teamMembers: ReturnType<typeof useOfficeUsers>['users'];
  user: { id: string } | null;
  isLimitReached: boolean;
  limiteProcessos: number;
  isLoading: boolean;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}

export function FormularioProcesso({
  formData, setFormData, handleChange, partesNaoLocalizadas, tiposProcessoCfg, persistTipos,
  officeTeams, teamMembers, user, isLimitReached, limiteProcessos, isLoading, onSubmit, onCancel,
}: Props) {
  return (
<form onSubmit={onSubmit} className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700 pb-10">
  {partesNaoLocalizadas && (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
      <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400">Partes não localizadas</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          O autor e o réu não foram encontrados na base pública (possível segredo de justiça ou cadastro incompleto no tribunal). Preencha o Polo Ativo e o Polo Passivo manualmente antes de salvar.
        </p>
      </div>
    </div>
  )}
  {/* Seção 1: Identificação Básica */}
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
        <Info className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="text-base font-bold text-foreground">Identificação Básica</h3>
        <p className="text-xs text-muted-foreground">Informações essenciais de registro</p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-xl bg-muted/30 border border-border">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="titulo">Título do Processo *</Label>
        <Input
          id="titulo"
          required
          value={formData.titulo}
          onChange={(e) => handleChange('titulo', e.target.value)}
          placeholder="Ex: Ação Trabalhista - Cliente X"
          className="h-11 rounded-xl"
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Tipo de processo</Label>
        <CreatableSelect
          value={formData.tipoProcesso || ''}
          onChange={(v) => handleChange('tipoProcesso', v)}
          options={tiposProcessoCfg.map((t) => t.nome)}
          onCreate={(v) => { persistTipos([...tiposProcessoCfg, { id: Date.now(), nome: v, descricao: '', area: '' }]); handleChange('tipoProcesso', v); }}
          placeholder="Selecione ou digite um tipo (gerido em Config → Processos)"
        />
      </div>
      <div className="space-y-2">
        <Label>Cliente (vincular ao cadastro) *</Label>
        <ClientSelect
          value={formData.clienteId || ''}
          onValueChange={(id, name) => setFormData((prev) => ({ ...prev, clienteId: id, cliente: name }))}
          placeholder="Selecionar cliente do cadastro..."
        />
        {(formData.parteAutora || formData.requerido) && !formData.clienteId && (
          <p className="text-[11px] text-muted-foreground/70">
            Partes: <span className="font-semibold">{formData.parteAutora || '—'}</span> × <span className="font-semibold">{formData.requerido || '—'}</span>. Selecione qual é o seu cliente.
          </p>
        )}
      </div>
      {officeTeams.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="teamId">Equipe Responsável</Label>
          <Select
            value={formData.teamId || ''}
            onValueChange={(v) => handleChange('teamId', v === 'none' ? '' : v)}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder="Selecionar equipe (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem equipe específica</SelectItem>
              {officeTeams.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: t.color }} />
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {teamMembers.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="responsavelId">Responsável</Label>
          <Select
            value={formData.responsavelId || user?.id || ''}
            onValueChange={(v) => handleChange('responsavelId', v)}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder="Selecionar responsável" />
            </SelectTrigger>
            <SelectContent>
              {teamMembers.map(m => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.profile?.full_name || m.profile?.email || "Membro"}
                  {m.user_id === user?.id ? " (você)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="numeroProcesso">Número do Processo (CNJ)</Label>
        <Input
          id="numeroProcesso"
          value={formData.numeroProcesso || ''}
          onChange={(e) => handleChange('numeroProcesso', maskCNJ(e.target.value))}
          placeholder="0000000-00.0000.0.00.0000"
          className="font-mono h-11 rounded-xl text-primary"
        />
      </div>
    </div>
  </div>

  {/* Seção 2: Capa Jurídica */}
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
        <Gavel className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div>
        <h3 className="text-base font-bold text-foreground">Capa Jurídica</h3>
        <p className="text-xs text-muted-foreground">Dados de localização do processo</p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-xl bg-muted/30 border border-border">
      <div className="space-y-2">
        <Label htmlFor="tribunal">Tribunal / Instância</Label>
        <Input id="tribunal" value={formData.tribunal || ''} onChange={(e) => handleChange('tribunal', e.target.value)} className="h-11 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vara">Vara / Secretaria</Label>
        <Input id="vara" value={formData.vara || ''} onChange={(e) => handleChange('vara', e.target.value)} className="h-11 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="parteAutora">Polo Ativo (Autor / Requerente)</Label>
        <Input id="parteAutora" value={formData.parteAutora || ''} onChange={(e) => handleChange('parteAutora', e.target.value)} placeholder="Não localizado — preencha manualmente" className="h-11 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="requerido">Polo Passivo (Réu / Requerido)</Label>
        <Input id="requerido" value={formData.requerido || ''} onChange={(e) => handleChange('requerido', e.target.value)} placeholder="Não localizado — preencha manualmente" className="h-11 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="valorCausa">Valor da Causa</Label>
        <Input
          id="valorCausa"
          inputMode="numeric"
          placeholder="R$ 0,00"
          value={formData.valorCausa ? formatBRL(formData.valorCausa) : ''}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            handleChange('valorCausa', digits ? Number(digits) / 100 : 0);
          }}
          className="h-11 rounded-xl"
        />
      </div>
    </div>
  </div>

  {isLimitReached && (
    <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
      Você atingiu o limite de {limiteProcessos} processos do seu plano.{" "}
      <a href="/pagamento" className="font-bold underline">Fazer upgrade</a> para cadastrar mais.
    </div>
  )}
  <DialogFooter className="pt-2">
    <Button variant="ghost" type="button" onClick={onCancel}>Cancelar</Button>
    <Button type="submit" disabled={isLoading || isLimitReached} className="px-8">
      {isLoading ? "Salvando..." : "Finalizar Cadastro"}
    </Button>
  </DialogFooter>
</form>
  );
}
