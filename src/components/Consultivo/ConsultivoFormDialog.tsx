import React from "react";
import { Button } from "@/components/ui/button";
import { ClientSelect } from "@/components/Clientes/ClientSelect";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORIDADES, STATUS_MAP, getColorCfg, getIconEl, type CatCfg, type ConsultivoForm } from "./consultivoConfig";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isEdit: boolean;
  form: ConsultivoForm;
  setForm: React.Dispatch<React.SetStateAction<ConsultivoForm>>;
  categorias: CatCfg[];
  membros: { id: string; label: string }[];
  canManage: boolean;
  saving: boolean;
  onSave: () => void;
  /** Só vem preenchido em edição com permissão — habilita o botão de excluir. */
  onDelete?: () => void;
  onGerenciarCategorias: () => void;
}

/** Diálogo de criar/editar consultivo. O estado do formulário fica na página. */
export function ConsultivoFormDialog({
  open, onOpenChange, isEdit, form, setForm, categorias, membros, canManage, saving, onSave, onDelete, onGerenciarCategorias,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle className="font-black text-lg">
            {isEdit ? "Editar Consultivo" : "Novo Consultivo"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Título *</Label>
            <Input placeholder="Ex: Análise de Contrato de Prestação de Serviços"
              value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              className="rounded-xl border-black/8 dark:border-border" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Cliente</Label>
              <ClientSelect value={form.cliente_id || ""} onValueChange={(id) => setForm(f => ({ ...f, cliente_id: id }))} placeholder="Selecionar cliente..." />
            </div>
            {membros.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Responsável</Label>
                <Select value={form.responsavel_id} onValueChange={v => setForm(f => ({ ...f, responsavel_id: v }))}>
                  <SelectTrigger className="rounded-xl border-black/8 dark:border-border">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {membros.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Prazo (aparece na agenda)</Label>
            <Input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
              className="rounded-xl border-black/8 dark:border-border" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Categoria *</Label>
              <button onClick={onGerenciarCategorias}
                className="text-[10px] text-primary font-bold flex items-center gap-1 hover:underline">
                <Settings className="h-3 w-3" />Gerenciar
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {categorias.map(cat => {
                const cc   = getColorCfg(cat.cor);
                const CIcon = getIconEl(cat.icone);
                const ativo = form.categoria === cat.valor;
                return (
                  <button key={cat.valor} type="button"
                    onClick={() => setForm(f => ({ ...f, categoria: cat.valor }))}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all",
                      ativo
                        ? cn("border-current shadow-sm", cc.color, cc.bg)
                        : "border-black/8 dark:border-border hover:bg-muted/40"
                    )}>
                    <CIcon className={cn("h-4 w-4", ativo ? cc.color : "text-muted-foreground")} />
                    <span className={cn("text-[9px] font-black leading-tight line-clamp-1", ativo ? cc.color : "text-muted-foreground")}>
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v }))}>
                <SelectTrigger className="rounded-xl border-black/8 dark:border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="rounded-xl border-black/8 dark:border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_MAP.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Descrição</Label>
            <Textarea placeholder="Descreva os detalhes da consulta jurídica..."
              value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              rows={3} className="rounded-xl border-black/8 dark:border-border resize-none" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Observações</Label>
            <Textarea placeholder="Notas internas, conclusões, próximos passos..."
              value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              rows={2} className="rounded-xl border-black/8 dark:border-border resize-none" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Tags <span className="text-muted-foreground/50 normal-case font-medium">(separadas por vírgula)</span>
            </Label>
            <Input placeholder="contrato, revisão, urgente"
              value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              className="rounded-xl border-black/8 dark:border-border" />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0 flex gap-2">
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-rose-500 hover:bg-rose-500/10 rounded-xl mr-auto">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir consultivo?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}
                    className="rounded-xl bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl font-black" disabled={saving}>
            Cancelar
          </Button>
          {canManage && (
            <Button onClick={onSave} className="rounded-xl font-black" disabled={saving || !form.titulo.trim()}>
              {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
