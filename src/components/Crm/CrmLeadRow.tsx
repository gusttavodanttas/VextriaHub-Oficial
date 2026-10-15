// Linha de lead da aba Lista do CRM (extraída de pages/Crm.tsx): contato,
// valor estimado, follow-up, WhatsApp, temperatura (editável com permissão) e detalhes.
import { UserCheck, Phone, Mail, MessageCircle, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatPhone } from "@/lib/phone";
import { onlyDigits } from "@/lib/document";
import { formatBRL } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { ClienteComProcessos } from "@/types/database";
import { getStatusColor } from "./CrmUtils";
import { TEMPERATURAS } from "./crmKpis";

interface Props {
  lead: ClienteComProcessos;
  canManageCRM: boolean;
  /** Hoje em yyyy-mm-dd — follow-up nessa data ou antes aparece como atrasado. */
  hojeStr: string;
  onFollowup: (id: string, date: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onDetalhes: (lead: ClienteComProcessos) => void;
}

export function CrmLeadRow({ lead, canManageCRM, hojeStr, onFollowup, onStatusChange, onDetalhes }: Props) {
  const brl = (v: number) => formatBRL(v, { decimals: 0 });
  const fu = lead.proximo_contato;
  const overdue = !!fu && fu <= hojeStr;
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between p-5 rounded-[1.5rem] border border-black/5 dark:border-border bg-black/[0.02] dark:bg-white/[0.01] hover:bg-primary/[0.03] transition-all gap-4 group">
      <div className="flex items-center space-x-4">
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border-2 shadow-inner transition-transform group-hover:scale-105", getStatusColor(lead.status || ''))}>
          <UserCheck className="h-7 w-7" />
        </div>
        <div>
          <div className="font-black text-lg text-foreground group-hover:text-primary transition-colors">{lead.nome}</div>
          <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-40">
            Desde {lead.created_at ? format(new Date(lead.created_at), "dd MMM yyyy", { locale: ptBR }) : '—'}
          </div>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {lead.email && (
            <div className="flex items-center text-xs font-bold text-muted-foreground/60">
              <Mail className="h-3.5 w-3.5 mr-2 text-primary/60" />
              {lead.email}
            </div>
          )}
          {lead.telefone && (
            <div className="flex items-center text-xs font-bold text-muted-foreground/60 font-mono">
              <Phone className="h-3.5 w-3.5 mr-2 text-primary/60" />
              {formatPhone(lead.telefone)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {Number(lead.valor_estimado) > 0 && (
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{brl(Number(lead.valor_estimado))}</span>
          )}
          <input
            type="date"
            value={fu || ""}
            onChange={(e) => onFollowup(lead.id, e.target.value)}
            disabled={!canManageCRM}
            title="Próximo contato (follow-up)"
            className={cn("h-9 rounded-lg border bg-background text-[11px] px-2 font-bold disabled:opacity-60", overdue ? "border-rose-500/50 text-rose-600 dark:text-rose-400" : "border-black/10 dark:border-border text-muted-foreground/70")}
          />
          {lead.telefone && (
            <a href={`https://wa.me/55${onlyDigits(lead.telefone)}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:scale-110 transition-transform p-1" title="WhatsApp">
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
          {!canManageCRM ? (
            <span className={cn("px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border-2 inline-flex items-center", getStatusColor(lead.status || ''))}>
              {lead.status}
            </span>
          ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn("px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border-2 inline-flex items-center gap-1 hover:opacity-80 transition-opacity", getStatusColor(lead.status || ''))} title="Mudar temperatura">
                {lead.status} <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              {TEMPERATURAS.map(t => (
                <DropdownMenuItem key={t.v} onSelect={() => onStatusChange(lead.id, t.v)} className="text-xs font-bold cursor-pointer">
                  {t.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          )}
          <Button variant="ghost" size="sm" className="rounded-xl h-10 px-5 font-black text-xs uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-all" onClick={() => onDetalhes(lead)}>
            Detalhes
          </Button>
        </div>
      </div>
    </div>
  );
}
