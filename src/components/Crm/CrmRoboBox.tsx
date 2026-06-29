import { useState } from "react";
import { Bot, CalendarClock, Snowflake, MessageCircle, Mail, Copy, Check, Settings2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCrmRobot } from "@/hooks/useCrmRobot";
import { useOfficeSettingValue } from "@/hooks/useOfficeSettingValue";
import { gerarMensagemContato, linkWhatsapp, linkEmail } from "@/lib/crmMessage";
import { useToast } from "@/hooks/use-toast";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

interface Props {
  data: any[];
  refresh?: () => void;
  remetente?: string;
  onOpenLead?: (lead: any) => void;
}

function LeadRow({ lead, motivo, remetente, onContatado, onOpen }: { lead: any; motivo: string; remetente?: string; onContatado?: () => void; onOpen?: () => void }) {
  const { toast } = useToast();
  const msg = gerarMensagemContato(lead, remetente);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(msg); toast({ title: "Mensagem copiada", description: "Cole no WhatsApp ou e-mail." }); }
    catch { toast({ title: "Não foi possível copiar", variant: "destructive" }); }
  };
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-black/5 dark:border-border bg-card hover:border-primary/30 transition-all">
      <div className="min-w-0 flex-1">
        <button onClick={onOpen} className="font-bold text-sm truncate hover:text-primary transition-colors text-left">{lead.nome}</button>
        <p className="text-[11px] text-muted-foreground/70">
          {motivo}
          {Number(lead.valor_estimado) > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-bold"> · {brl(Number(lead.valor_estimado))}</span>}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {lead.telefone && (
          <a href={linkWhatsapp(lead.telefone, msg)} target="_blank" rel="noopener noreferrer" title="WhatsApp com mensagem pronta"
            className="h-8 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 inline-flex items-center gap-1 text-[11px] font-bold transition-colors">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        )}
        {lead.email && (
          <a href={linkEmail(lead.email, msg)} title="E-mail com mensagem pronta"
            className="h-8 w-8 rounded-lg bg-muted/50 text-muted-foreground hover:text-primary inline-flex items-center justify-center transition-colors">
            <Mail className="h-3.5 w-3.5" />
          </a>
        )}
        <button onClick={copiar} title="Copiar mensagem"
          className="h-8 w-8 rounded-lg bg-muted/50 text-muted-foreground hover:text-primary inline-flex items-center justify-center transition-colors">
          <Copy className="h-3.5 w-3.5" />
        </button>
        {onContatado && (
          <button onClick={onContatado} title="Marcar como contatado (reagenda follow-up)"
            className="h-8 px-2.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1 text-[11px] font-bold transition-colors">
            <Check className="h-3.5 w-3.5" /> Contatado
          </button>
        )}
      </div>
    </div>
  );
}

export function CrmRoboBox({ data, refresh, remetente, onOpenLead }: Props) {
  const { value: followupDias, save: saveFollowup } = useOfficeSettingValue<number>("crm_followup_dias", 3);
  const { value: esfriandoDias, save: saveEsfriando } = useOfficeSettingValue<number>("crm_esfriando_dias", 7);
  const { contatosHoje, esfriando, marcarContatado } = useCrmRobot(data, refresh, { followupDias, esfriandoDias });
  const [showConfig, setShowConfig] = useState(false);

  const vazio = contatosHoje.length === 0 && esfriando.length === 0;
  const hojeStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="glass-card rounded-[2rem] border border-primary/20 bg-primary/[0.03] p-5 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><Bot className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-lg leading-tight">Robô do CRM</p>
          <p className="text-xs text-muted-foreground">Quem você precisa contatar — com mensagem pronta para enviar.</p>
        </div>
        <button onClick={() => setShowConfig(s => !s)} title="Configurar prazos"
          className="h-9 w-9 rounded-xl border border-black/5 dark:border-border text-muted-foreground hover:text-primary hover:bg-primary/5 inline-flex items-center justify-center transition-colors">
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      {showConfig && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-black/5 dark:border-border bg-card">
          <label className="space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">Reagendar follow-up em (dias)</span>
            <Input type="number" min={1} max={90} value={followupDias}
              onChange={(e) => saveFollowup(Math.max(1, Number(e.target.value) || 1))} className="h-10 rounded-xl" />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">Esfriando após (dias sem atendimento)</span>
            <Input type="number" min={1} max={180} value={esfriandoDias}
              onChange={(e) => saveEsfriando(Math.max(1, Number(e.target.value) || 1))} className="h-10 rounded-xl" />
          </label>
        </div>
      )}

      {vazio ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">CRM em dia — nenhum contato pendente nem lead esfriando.</p>
        </div>
      ) : (
        <>
          {contatosHoje.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" /> Contatos de hoje ({contatosHoje.length})
              </p>
              <div className="space-y-2">
                {contatosHoje.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} remetente={remetente}
                    motivo={`Follow-up ${lead.proximo_contato < hojeStr ? "atrasado" : "para hoje"}`}
                    onContatado={() => marcarContatado(lead.id)} onOpen={() => onOpenLead?.(lead)} />
                ))}
              </div>
            </div>
          )}

          {esfriando.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-1.5">
                <Snowflake className="h-3.5 w-3.5" /> Leads esfriando ({esfriando.length})
              </p>
              <div className="space-y-2">
                {esfriando.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} remetente={remetente}
                    motivo={`${lead.status} · sem atendimento recente`}
                    onContatado={() => marcarContatado(lead.id)} onOpen={() => onOpenLead?.(lead)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
