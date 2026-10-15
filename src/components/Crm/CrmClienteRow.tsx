// Linha de cliente convertido da aba Convertidos do CRM (extraída de pages/Crm.tsx).
import { UserCheck, Phone, Mail, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { formatPhone } from "@/lib/phone";
import { onlyDigits } from "@/lib/document";
import type { ClienteComProcessos } from "@/types/database";

export function CrmClienteRow({ client }: { client: ClienteComProcessos }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between p-5 rounded-[1.5rem] border border-black/5 dark:border-border bg-black/[0.02] dark:bg-white/[0.01] hover:bg-emerald-500/[0.03] transition-all gap-4 group">
      <div className="flex items-center space-x-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center border-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-inner transition-transform group-hover:scale-105">
          <UserCheck className="h-7 w-7" />
        </div>
        <div>
          <div className="font-black text-lg text-foreground group-hover:text-emerald-500 transition-colors">{client.nome}</div>
          <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-40">
            Cliente desde {client.created_at ? format(new Date(client.created_at), "dd MMM yyyy", { locale: ptBR }) : '—'}
          </div>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {client.email && (
            <div className="flex items-center text-xs font-bold text-muted-foreground/60">
              <Mail className="h-3.5 w-3.5 mr-2 text-emerald-500/60" />
              {client.email}
            </div>
          )}
          {client.telefone && (
            <div className="flex items-center text-xs font-bold text-muted-foreground/60 font-mono">
              <Phone className="h-3.5 w-3.5 mr-2 text-emerald-500/60" />
              {formatPhone(client.telefone)}
            </div>
          )}
        </div>
        {client.telefone && (
          <a href={`https://wa.me/55${onlyDigits(client.telefone)}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:scale-110 transition-transform p-1" title="WhatsApp">
            <MessageCircle className="h-4 w-4" />
          </a>
        )}
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest">
          Contratado
        </Badge>
      </div>
    </div>
  );
}
