import { useState, useEffect } from "react";
import { Trash2, Pencil, User, Building2, Scale, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useOfficeSettingList } from "@/hooks/useOfficeSettingList";
import { formatCpfCnpj, isValidCpfCnpj, onlyDigits } from "@/lib/document";
import { formatPhone, isValidPhone } from "@/lib/phone";
import { Client } from "@/types/client";

interface EditClientDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (client: Client) => Promise<boolean | void> | boolean | void;
  onDelete?: (clientId: string) => void;
}

const ORIGENS_DEFAULT = ["Indicação", "Marketing Digital", "Redes Sociais", "Site", "Telefone", "Presencial", "Outros"];
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export const EditClientDialog = ({ client, open, onOpenChange, onSave, onDelete }: EditClientDialogProps) => {
  const { toast } = useToast();
  const { items: origensCliente } = useOfficeSettingList<string>("origens_cliente", ORIGENS_DEFAULT);
  const [form, setForm] = useState<Client | null>(client);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) setForm({ ...client, cpfCnpj: formatCpfCnpj(client.cpfCnpj, client.tipoPessoa), phone: formatPhone(client.phone || "") });
    else setForm(null);
    setErrors({});
  }, [client]);

  if (!form) return null;
  const isPJ = form.tipoPessoa === "juridica";
  const set = (patch: Partial<Client>) => setForm((p) => (p ? { ...p, ...patch } : p));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nome é obrigatório.";
    if (!onlyDigits(form.cpfCnpj)) e.cpfCnpj = `${isPJ ? "CNPJ" : "CPF"} é obrigatório.`;
    else if (!isValidCpfCnpj(form.cpfCnpj, form.tipoPessoa)) e.cpfCnpj = `${isPJ ? "CNPJ" : "CPF"} inválido.`;
    if (form.email && !emailOk(form.email)) e.email = "E-mail inválido.";
    if (form.phone && !isValidPhone(form.phone)) e.phone = "Telefone inválido (use DDD + número).";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast({ title: "Verifique os campos", description: "Há campos obrigatórios ou inválidos.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const result = await onSave(form);
      if (result === false) return;
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const isAtivo = (form.status || "").toLowerCase() === "ativo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto rounded-[1.75rem] p-0">
        <div className="p-6 md:p-7 space-y-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-black">
              <span className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><Pencil className="h-5 w-5" /></span>
              Editar Cliente
            </DialogTitle>
            <DialogDescription className="text-xs">Atualize os dados do cliente.</DialogDescription>
          </DialogHeader>

          {/* Tipo de pessoa + status */}
          <div className="grid grid-cols-2 gap-2">
            {([["fisica", "Pessoa Física", User], ["juridica", "Pessoa Jurídica", Building2]] as const).map(([val, label, Icon]) => (
              <button
                key={val}
                type="button"
                onClick={() => set({ tipoPessoa: val, cpfCnpj: formatCpfCnpj(form.cpfCnpj, val) })}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-3 text-sm font-bold transition-all",
                  form.tipoPessoa === val ? "border-primary/40 bg-primary/5 text-primary" : "border-black/8 dark:border-border text-muted-foreground hover:bg-muted/40"
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <Field label="Nome completo *" error={errors.name}>
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} className="rounded-xl h-11" />
            </Field>

            <Field label={isPJ ? "CNPJ *" : "CPF *"} error={errors.cpfCnpj}>
              <Input value={form.cpfCnpj} onChange={(e) => set({ cpfCnpj: formatCpfCnpj(e.target.value, form.tipoPessoa) })} inputMode="numeric" className="rounded-xl h-11 font-mono" />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="E-mail" error={errors.email}>
                <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className="rounded-xl h-11" />
              </Field>
              <Field label="Telefone" error={errors.phone}>
                <Input value={form.phone} onChange={(e) => set({ phone: formatPhone(e.target.value) })} inputMode="numeric" className="rounded-xl h-11" />
              </Field>
            </div>

            <Field label="Endereço">
              <Input value={form.endereco} onChange={(e) => set({ endereco: e.target.value })} className="rounded-xl h-11" />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Data de aniversário">
                <Input type="date" value={form.dataAniversario} onChange={(e) => set({ dataAniversario: e.target.value })} className="rounded-xl h-11" />
              </Field>
              <Field label="Origem">
                <Select value={form.origem} onValueChange={(v) => set({ origem: v })}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {origensCliente.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* Status + processos (reais) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-black/8 dark:border-border p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Status</p>
                <button
                  type="button"
                  onClick={() => set({ status: isAtivo ? "Inativo" : "Ativo" })}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-black border transition-all",
                    isAtivo ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-muted/40 text-muted-foreground border-border"
                  )}
                >
                  {isAtivo ? "Ativo" : "Inativo"}
                </button>
              </div>
              <div className="rounded-xl border border-black/8 dark:border-border p-3 space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Processos vinculados</p>
                <div className="flex items-center gap-1.5">
                  <Scale className="h-4 w-4 text-primary" />
                  <span className="text-lg font-black leading-none">{form.cases}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 md:px-7 pb-6 flex sm:justify-between items-center w-full">
          {onDelete && client ? (
            <Button variant="ghost" size="sm" onClick={() => { onOpenChange(false); onDelete(client.id); }} className="rounded-xl gap-2 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl font-bold gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar Alterações
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</Label>
      {children}
      {error && <p className="text-[11px] font-semibold text-destructive">{error}</p>}
    </div>
  );
}
