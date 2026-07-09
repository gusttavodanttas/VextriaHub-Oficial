import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, User, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useOfficeSettingList } from "@/hooks/useOfficeSettingList";
import { formatCpfCnpj } from "@/lib/document";
import { formatPhone } from "@/lib/phone";
import { clienteSchema, zodErrorsToMap } from "@/lib/validation";

interface ClientInput {
  name: string;
  email: string;
  phone: string;
  cpfCnpj: string;
  tipoPessoa: "fisica" | "juridica";
  origem: string;
  endereco: string;
  dataAniversario: string;
  status: string;
}

interface NovoClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Retorna true/undefined em sucesso, false para manter o modal aberto (ex.: duplicado)
  onSave: (client: ClientInput) => Promise<boolean | void> | boolean | void;
  initialName?: string; // pré-preenche o nome (ex.: vindo da busca do ClientSelect)
}

const ORIGENS_DEFAULT = ["Indicação", "Marketing Digital", "Redes Sociais", "Site", "Telefone", "Presencial", "Outros"];

const EMPTY: ClientInput = {
  name: "", email: "", phone: "", cpfCnpj: "", tipoPessoa: "fisica",
  origem: "", endereco: "", dataAniversario: "", status: "Ativo",
};

export const NovoClienteDialog = ({ open, onOpenChange, onSave, initialName }: NovoClienteDialogProps) => {
  const { toast } = useToast();
  const { items: origensCliente } = useOfficeSettingList<string>("origens_cliente", ORIGENS_DEFAULT);
  const [form, setForm] = useState<ClientInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Ao abrir, pré-preenche o nome com o que veio da busca (se houver)
  useEffect(() => { if (open) setForm({ ...EMPTY, name: initialName || "" }); }, [open, initialName]);

  const set = (patch: Partial<ClientInput>) => setForm((p) => ({ ...p, ...patch }));
  const isPJ = form.tipoPessoa === "juridica";

  const reset = () => { setForm(EMPTY); setErrors({}); };

  // Regras centralizadas em @/lib/validation (mesmas mensagens de antes)
  const validate = () => {
    const parsed = clienteSchema.safeParse(form);
    setErrors(parsed.success ? {} : zodErrorsToMap(parsed.error));
    return parsed.success;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast({ title: "Verifique os campos", description: "Há campos obrigatórios ou inválidos.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const result = await onSave({ ...form, origem: form.origem || "Não informado" });
      if (result === false) return; // duplicado ou falha — mantém o modal
      reset();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => { reset(); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto rounded-[1.75rem] p-0">
        <div className="p-6 md:p-7 space-y-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-black">
              <span className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><UserPlus className="h-5 w-5" /></span>
              Novo Cliente
            </DialogTitle>
            <DialogDescription className="text-xs">Cadastre um cliente. Campos com * são obrigatórios.</DialogDescription>
          </DialogHeader>

          {/* Tipo de pessoa */}
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
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} className="rounded-xl h-11" placeholder={isPJ ? "Razão social" : "Nome do cliente"} />
            </Field>

            <Field label={isPJ ? "CNPJ *" : "CPF *"} error={errors.cpfCnpj}>
              <Input
                value={form.cpfCnpj}
                onChange={(e) => set({ cpfCnpj: formatCpfCnpj(e.target.value, form.tipoPessoa) })}
                inputMode="numeric"
                className="rounded-xl h-11 font-mono"
                placeholder={isPJ ? "00.000.000/0000-00" : "000.000.000-00"}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="E-mail" error={errors.email}>
                <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className="rounded-xl h-11" placeholder="email@exemplo.com" />
              </Field>
              <Field label="Telefone" error={errors.phone}>
                <Input value={form.phone} onChange={(e) => set({ phone: formatPhone(e.target.value) })} inputMode="numeric" className="rounded-xl h-11" placeholder="(11) 99999-9999" />
              </Field>
            </div>

            <Field label="Endereço">
              <Input value={form.endereco} onChange={(e) => set({ endereco: e.target.value })} className="rounded-xl h-11" placeholder="Rua, nº, bairro, cidade" />
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
          </div>
        </div>

        <DialogFooter className="px-6 md:px-7 pb-6 gap-2">
          <Button variant="outline" onClick={handleCancel} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl font-bold gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Cadastrar Cliente
          </Button>
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
