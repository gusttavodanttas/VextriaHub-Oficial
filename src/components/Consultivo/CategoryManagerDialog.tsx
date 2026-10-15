import React, { useState } from "react";
import { ConsultivoCategoria } from "@/hooks/useConsultivoCategorias";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Settings, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLOR_OPTIONS, ICON_OPTIONS, getColorCfg, getIconEl } from "./consultivoConfig";

type CatForm = { label: string; cor: string; icone: string };
const BLANK_CAT: CatForm = { label: "", cor: "blue", icone: "FileText" };

/** Diálogo "Gerenciar Categorias" do Consultivo: lista, edição inline e criação. */
export function CategoryManagerDialog({
  open, onOpenChange, categorias, onCreate, onUpdate, onRemove,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categorias: ConsultivoCategoria[];
  onCreate: (label: string, cor: string, icone: string) => Promise<boolean>;
  onUpdate: (id: string, label: string, cor: string, icone: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CatForm>({ ...BLANK_CAT });
  const [saving, setSaving] = useState(false);

  const startEdit = (cat: ConsultivoCategoria) => {
    setEditId(cat.id);
    setForm({ label: cat.label, cor: cat.cor ?? "blue", icone: cat.icone ?? "FileText" });
  };
  const startCreate = () => {
    setEditId(null);
    setForm({ ...BLANK_CAT });
  };

  const handleSave = async () => {
    if (!form.label.trim()) return;
    setSaving(true);
    const ok = editId
      ? await onUpdate(editId, form.label.trim(), form.cor, form.icone)
      : await onCreate(form.label.trim(), form.cor, form.icone);
    setSaving(false);
    if (ok) { setEditId(null); setForm({ ...BLANK_CAT }); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle className="font-black text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Gerenciar Categorias
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 divide-y divide-border">
          {/* lista de categorias existentes */}
          {categorias.map(cat => {
            const cc = getColorCfg(cat.cor);
            const CIcon = getIconEl(cat.icone);
            const isEditing = editId === cat.id;
            return (
              <div key={cat.id} className="px-5 py-3">
                {isEditing ? (
                  <CatFormInline
                    form={form} setForm={setForm} saving={saving}
                    onSave={handleSave} onCancel={() => { setEditId(null); setForm({ ...BLANK_CAT }); }}
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl shrink-0", cc.bg)}>
                      <CIcon className={cn("h-4 w-4", cc.color)} />
                    </div>
                    <span className="font-bold text-sm flex-1">{cat.label}</span>
                    <button onClick={() => startEdit(cat)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors text-muted-foreground hover:text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir categoria "{cat.label}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Consultivos com esta categoria não serão excluídos, mas perderão a classificação.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onRemove(cat.id)}
                            className="rounded-xl bg-destructive hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            );
          })}

          {/* form nova categoria */}
          <div className="px-5 py-4 bg-muted/20">
            {editId === null ? (
              <>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">
                  {categorias.length === 0 ? "Criar primeira categoria" : "Nova categoria"}
                </p>
                <CatFormInline
                  form={form} setForm={setForm} saving={saving}
                  onSave={handleSave} onCancel={() => setForm({ ...BLANK_CAT })}
                  isNew
                />
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={startCreate}
                className="w-full rounded-xl text-xs font-black gap-2 border border-dashed border-border hover:border-primary/40">
                <Plus className="h-3.5 w-3.5" />Nova categoria
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
          <Button onClick={() => onOpenChange(false)} className="rounded-xl font-black w-full">
            Concluído
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CatFormInline({ form, setForm, saving, onSave, onCancel, isNew }: {
  form: CatForm;
  setForm: React.Dispatch<React.SetStateAction<CatForm>>;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
}) {
  const CatIcon = getIconEl(form.icone);
  const catColor = getColorCfg(form.cor);

  return (
    <div className="space-y-3">
      {/* preview */}
      <div className="flex items-center gap-2">
        <div className={cn("p-2 rounded-xl shrink-0", catColor.bg)}>
          <CatIcon className={cn("h-4 w-4", catColor.color)} />
        </div>
        <Input
          placeholder="Nome da categoria"
          value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          className="rounded-xl border-black/8 dark:border-border h-9 text-sm font-bold"
          autoFocus
        />
      </div>

      {/* cores */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Cor</p>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_OPTIONS.map(c => (
            <button key={c.value} type="button"
              onClick={() => setForm(f => ({ ...f, cor: c.value }))}
              title={c.label}
              className={cn(
                "h-7 w-7 rounded-lg border-2 transition-all",
                c.bg,
                form.cor === c.value ? "border-foreground scale-110 shadow" : "border-transparent hover:scale-105"
              )}>
              <span className={cn("block h-3 w-3 rounded-full mx-auto", c.bg.replace("/10", ""))} />
            </button>
          ))}
        </div>
      </div>

      {/* ícones */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Ícone</p>
        <div className="grid grid-cols-6 gap-1.5">
          {ICON_OPTIONS.map(ic => {
            const Ic = ic.Icon;
            return (
              <button key={ic.value} type="button"
                onClick={() => setForm(f => ({ ...f, icone: ic.value }))}
                title={ic.label}
                className={cn(
                  "p-2 rounded-xl border flex items-center justify-center transition-all",
                  form.icone === ic.value
                    ? cn("border-current shadow-sm", catColor.color, catColor.bg)
                    : "border-black/8 dark:border-border hover:bg-muted/40"
                )}>
                <Ic className={cn("h-4 w-4", form.icone === ic.value ? catColor.color : "text-muted-foreground")} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={saving || !form.label.trim()}
          className="rounded-xl font-black flex-1">
          {saving ? "..." : isNew ? "Criar" : "Salvar"}
        </Button>
        {!isNew && (
          <Button size="sm" variant="outline" onClick={onCancel} className="rounded-xl font-black">
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
