import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClientSelect } from "@/components/Clientes/ClientSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Scale, Landmark, ShieldCheck, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

/**
 * Assistente "Novo Caso": pergunta o tipo de entrada e faz os cadastros em cadeia.
 *  - Judicial a protocolar → processo SEM número CNJ + tarefa "Protocolar petição inicial"
 *    (o número é preenchido depois, no processo — é ele que liga o robô de publicações)
 *  - Administrativo       → consultivo na categoria "Administrativo" (criada se faltar)
 *  - Preventivo           → consultivo na categoria "Preventivo" (criada se faltar)
 */

type TipoCaso = "judicial" | "administrativo" | "preventivo";

interface NovoCasoWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const TIPOS: { key: TipoCaso; titulo: string; desc: string; icon: typeof Scale; cor: string }[] = [
  { key: "judicial", titulo: "Judicial (a protocolar)", desc: "Petição inicial ainda sem número — cria o processo e a tarefa de protocolar", icon: Scale, cor: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  { key: "administrativo", titulo: "Administrativo", desc: "Requerimento em órgão (INSS, prefeitura…) — vira consultivo com protocolo e prazo", icon: Landmark, cor: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
  { key: "preventivo", titulo: "Preventivo / Consultivo", desc: "Contrato, parecer, compliance — vira consultivo com prazo e tarefas", icon: ShieldCheck, cor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
];

// Mesma fórmula de slug do useConsultivoCategorias — o item grava o slug, a tela resolve o label
const slugCategoria = (label: string) =>
  label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

async function ensureCategoria(officeId: string, label: string, cor: string, icone: string): Promise<string> {
  const valor = slugCategoria(label);
  const { data: existing } = await supabase
    .from("consultivo_categorias")
    .select("valor")
    .eq("office_id", officeId)
    .eq("valor", valor)
    .maybeSingle();
  if (existing) return (existing as { valor: string }).valor;
  const { count } = await supabase
    .from("consultivo_categorias")
    .select("id", { count: "exact", head: true })
    .eq("office_id", officeId);
  const { error } = await supabase.from("consultivo_categorias").insert({
    office_id: officeId, label, valor, cor, icone, ordem: count ?? 0,
  });
  if (error) throw error;
  return valor;
}

const BLANK = { titulo: "", clienteId: "", clienteNome: "", parteContraria: "", protocolo: "", orgao: "", prazo: "", observacoes: "" };

// Etapas da petição inicial (ramo judicial): elaborar → revisar (se for o caso) → protocolar
type EtapaKey = "elaborar" | "revisar" | "protocolar";
const ETAPAS_DEFAULT: Record<EtapaKey, { on: boolean; data: string }> = {
  elaborar: { on: true, data: "" },
  revisar: { on: false, data: "" },
  protocolar: { on: true, data: "" },
};
const ETAPAS_META: { key: EtapaKey; label: string; prioridade: string }[] = [
  { key: "elaborar", label: "Elaborar petição inicial", prioridade: "alta" },
  { key: "revisar", label: "Revisar petição inicial", prioridade: "media" },
  { key: "protocolar", label: "Protocolar petição inicial", prioridade: "alta" },
];

export function NovoCasoWizard({ open, onOpenChange, onSuccess }: NovoCasoWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<TipoCaso | null>(null);
  const [form, setForm] = useState(BLANK);
  const [etapas, setEtapas] = useState(ETAPAS_DEFAULT);
  const [saving, setSaving] = useState(false);

  const reset = () => { setTipo(null); setForm(BLANK); setEtapas(ETAPAS_DEFAULT); };
  const close = (v: boolean) => { if (!v) reset(); onOpenChange(v); };
  const invalidar = () => {
    for (const key of ["processos", "consultivos", "consultivo_categorias", "tarefas", "prazos", "dashboard-stats", "dashboard-prazos", "dashboard-tarefas"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const salvar = async () => {
    if (!user?.id || !user?.office_id || !tipo) return;
    const userId = user.id;
    const officeId = user.office_id;
    if (!form.titulo.trim()) { toast({ title: "Informe o título do caso", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (tipo === "judicial") {
        // Processo sem número (a protocolar) — numero_processo é NOT NULL, sem CNJ = ''
        const { data: proc, error } = await supabase.from("processos").insert({
          user_id: user.id,
          office_id: user.office_id,
          titulo: form.titulo.trim(),
          numero_processo: "",
          status: "ativo",
          cliente_id: form.clienteId || null,
          // Petição inicial: seu cliente é o polo ativo (autor). Sem isso, a pasta abria com "Autor: Não identificado".
          parte_autora: form.clienteNome.trim() || "",
          requerido: form.parteContraria.trim() || "",
          observacoes: form.observacoes.trim() || "",
          responsavel_id: user.id,
          fonte_sincronizacao: "manual",
          nivel_sigilo: 0,
        }).select("id").single();
        if (error) {
          if ((error as { code?: string }).code === "23505") {
            throw new Error("Este caso parece já ter sido cadastrado. Verifique na lista de Processos antes de criar de novo.");
          }
          throw error;
        }
        // Cadeia de tarefas da inicial: elaborar → revisar (opcional) → protocolar
        const marcadas = ETAPAS_META.filter((m) => etapas[m.key].on);
        if (marcadas.length > 0) {
          const rows = marcadas.map((m) => ({
            user_id: userId,
            office_id: officeId,
            processo_id: (proc as { id: string }).id,
            cliente_id: form.clienteId || null,
            titulo: `${m.label} — ${form.titulo.trim()}`,
            descricao: m.key === "protocolar"
              ? "Após protocolar, preencha o número CNJ no processo para ativar o monitoramento automático de publicações."
              : null,
            data_vencimento: etapas[m.key].data || null,
            prioridade: m.prioridade,
            status: "pendente",
            concluida: false,
          }));
          const { error: tErr } = await supabase.from("tarefas").insert(rows);
          if (tErr) console.warn("Tarefas das etapas não criadas:", tErr.message);
        }
        const nomes = marcadas.map((m) => m.label.split(" ")[0].toLowerCase()).join(" → ");
        toast({ title: "Caso judicial criado", description: `Processo cadastrado sem número${nomes ? ` + etapas: ${nomes}` : ""}. Preencha o CNJ ao protocolar — é ele que liga o robô de publicações.` });
      } else {
        // Administrativo/Preventivo → consultivo na categoria certa
        const catLabel = tipo === "administrativo" ? "Administrativo" : "Preventivo";
        const categoria = await ensureCategoria(
          user.office_id,
          catLabel,
          tipo === "administrativo" ? "indigo" : "emerald",
          tipo === "administrativo" ? "Landmark" : "Shield",
        );
        const partes = [
          form.protocolo.trim() && `Protocolo: ${form.protocolo.trim()}`,
          form.orgao.trim() && `Órgão: ${form.orgao.trim()}`,
          form.observacoes.trim(),
        ].filter(Boolean).join("\n");
        const { error } = await supabase.from("consultivos").insert({
          titulo: form.titulo.trim(),
          descricao: partes || null,
          categoria,
          prioridade: "media",
          status: "pendente",
          tags: [] as string[],
          observacoes: null,
          cliente_id: form.clienteId || null,
          responsavel_id: user.id,
          prazo: form.prazo || null,
          user_id: user.id,
          office_id: user.office_id,
        });
        if (error) throw error;
        toast({ title: `Caso ${tipo === "administrativo" ? "administrativo" : "preventivo"} criado`, description: `Registrado no Consultivo (categoria ${catLabel})${form.prazo ? " com prazo na agenda" : ""}.` });
      }
      invalidar();
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (e: unknown) {
      toast({ title: "Erro ao criar o caso", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const meta = TIPOS.find((t) => t.key === tipo);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent aria-describedby={undefined} className="max-w-md bg-background border border-border p-0 rounded-[2rem] shadow-2xl overflow-hidden max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)] gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
            {meta ? <meta.icon className={`h-5 w-5 ${meta.cor.split(" ")[0]}`} /> : <Scale className="h-5 w-5 text-primary" />}
            {meta ? meta.titulo : "Novo Caso"}
          </DialogTitle>
          {!meta && <p className="text-xs text-muted-foreground mt-1">Escolha o tipo de entrada — o sistema faz os cadastros certos sozinho.</p>}
        </DialogHeader>

        {!tipo ? (
          <div className="p-6 space-y-3 overflow-y-auto">
            {TIPOS.map((t) => (
              <button key={t.key} onClick={() => setTipo(t.key)}
                className={`w-full flex items-start gap-3 p-4 rounded-2xl border text-left transition-all hover:shadow-md ${t.cor}`}>
                <t.icon className="h-5 w-5 shrink-0 mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-black text-foreground">{t.titulo}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{t.desc}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-6 space-y-4 overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título do caso *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="rounded-xl"
                placeholder={tipo === "judicial" ? "Ex: Ação de Cobrança — Cliente X" : tipo === "administrativo" ? "Ex: Requerimento INSS — Cliente X" : "Ex: Revisão contratual — Cliente X"} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</Label>
              <ClientSelect value={form.clienteId} onValueChange={(id, nome) => setForm({ ...form, clienteId: id, clienteNome: nome })} placeholder="Selecionar cliente..." />
            </div>
            {tipo === "judicial" && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Parte contrária</Label>
                <Input value={form.parteContraria} onChange={(e) => setForm({ ...form, parteContraria: e.target.value })} className="rounded-xl" placeholder="Ex: Empresa Y Ltda" />
              </div>
            )}
            {tipo === "administrativo" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Protocolo</Label>
                  <Input value={form.protocolo} onChange={(e) => setForm({ ...form, protocolo: e.target.value })} className="rounded-xl" placeholder="Nº do protocolo" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Órgão</Label>
                  <Input value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} className="rounded-xl" placeholder="Ex: INSS" />
                </div>
              </div>
            )}
            {tipo === "judicial" ? (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Etapas da petição inicial</Label>
                <div className="space-y-2 rounded-xl border border-black/5 dark:border-border bg-muted/20 p-3">
                  {ETAPAS_META.map((m) => (
                    <div key={m.key} className="flex items-center gap-3">
                      <Checkbox
                        id={`etapa-${m.key}`}
                        checked={etapas[m.key].on}
                        onCheckedChange={(v) => setEtapas({ ...etapas, [m.key]: { ...etapas[m.key], on: !!v } })}
                      />
                      <label htmlFor={`etapa-${m.key}`} className="flex-1 text-sm font-semibold cursor-pointer select-none">
                        {m.label.replace(" petição inicial", "")}
                        {m.key === "revisar" && <span className="text-[11px] text-muted-foreground/60 font-normal"> (se for o caso)</span>}
                      </label>
                      <Input
                        type="date"
                        value={etapas[m.key].data}
                        onChange={(e) => setEtapas({ ...etapas, [m.key]: { ...etapas[m.key], data: e.target.value } })}
                        disabled={!etapas[m.key].on}
                        className="rounded-lg h-9 w-36 text-xs disabled:opacity-40"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground/70">Cada etapa marcada vira uma tarefa (com vencimento, se informado). A de protocolar lembra de preencher o CNJ.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prazo</Label>
                <Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} className="rounded-xl" />
                <p className="text-[11px] text-muted-foreground/70">Aparece na agenda e no painel.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} className="rounded-xl resize-none" placeholder="Detalhes do caso..." />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setTipo(null)} className="rounded-xl gap-1.5" disabled={saving}>
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button onClick={salvar} disabled={saving} className="flex-1 rounded-xl font-bold gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {saving ? "Criando…" : "Criar caso"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
