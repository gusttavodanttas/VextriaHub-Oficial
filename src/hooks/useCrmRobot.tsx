import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Defaults (sobrescritos pelas configurações do escritório)
const FOLLOWUP_DIAS_PADRAO = 3;   // ao auto-agendar, próximo contato em +N dias
const ESFRIANDO_DIAS_PADRAO = 7;  // lead quente/morno sem atendimento há X dias = esfriando

const STATUS_ATIVOS = ["lead", "quente", "morno", "frio"];
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toStr = (d: Date) => d.toISOString().slice(0, 10);

export interface CrmRoboResult {
  contatosHoje: any[];
  esfriando: any[];
  loading: boolean;
  marcarContatado: (id: string) => Promise<void>;
}

/**
 * Robô do CRM (regras): identifica leads a contatar hoje (follow-up vencido) e
 * leads "esfriando" (quente/morno sem atendimento há X dias). Faz auto follow-up
 * (1x/dia) nos leads ativos sem data de próximo contato.
 */
export function useCrmRobot(
  clientes: any[],
  refresh?: () => void,
  opts?: { followupDias?: number; esfriandoDias?: number }
): CrmRoboResult {
  const { user } = useAuth();
  const [lastAtend, setLastAtend] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const followupDias = opts?.followupDias ?? FOLLOWUP_DIAS_PADRAO;
  const esfriandoDias = opts?.esfriandoDias ?? ESFRIANDO_DIAS_PADRAO;
  const hoje = toStr(new Date());
  const cutoffEsfriando = toStr(addDays(new Date(), -esfriandoDias));

  const ativos = useMemo(
    () => clientes.filter((c) => STATUS_ATIVOS.includes((c.status || "").toLowerCase())),
    [clientes]
  );
  const idsKey = useMemo(() => ativos.map((c) => c.id).sort().join(","), [ativos]);

  // Carrega o último atendimento de cada lead ativo
  useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (!ids.length) { setLastAtend({}); setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("atendimentos")
        .select("cliente_id, data_atendimento")
        .in("cliente_id", ids)
        .eq("deletado", false);
      if (cancel) return;
      const map: Record<string, string> = {};
      (data || []).forEach((a: any) => {
        if (a.cliente_id && a.data_atendimento) {
          if (!map[a.cliente_id] || a.data_atendimento > map[a.cliente_id]) map[a.cliente_id] = a.data_atendimento;
        }
      });
      setLastAtend(map);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [idsKey]);

  // Auto follow-up: 1x/dia, agenda próximo contato para leads ativos sem data
  useEffect(() => {
    const officeId = user?.office_id;
    if (!officeId || ativos.length === 0) return;
    const key = `crm_robot_followup_${officeId}`;
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < 20 * 60 * 60 * 1000) return;
    const semData = ativos.filter((c) => !c.proximo_contato).map((c) => c.id);
    if (semData.length === 0) { localStorage.setItem(key, String(Date.now())); return; }
    (async () => {
      const novaData = toStr(addDays(new Date(), followupDias));
      const { error } = await supabase
        .from("clientes")
        .update({ proximo_contato: novaData } as any)
        .in("id", semData)
        .eq("office_id", officeId);
      if (!error) {
        localStorage.setItem(key, String(Date.now()));
        refresh?.();
      }
      // se a coluna ainda não existir, não marca o guard (tenta de novo depois)
    })();
  }, [idsKey, user?.office_id]);

  const contatosHoje = useMemo(
    () => ativos
      .filter((c) => c.proximo_contato && c.proximo_contato <= hoje)
      .sort((a, b) => (a.proximo_contato || "").localeCompare(b.proximo_contato || "")),
    [ativos, hoje]
  );

  const esfriando = useMemo(
    () => ativos
      .filter((c) => ["quente", "morno"].includes((c.status || "").toLowerCase()))
      .filter((c) => (c.created_at || "").slice(0, 10) <= cutoffEsfriando) // não pega lead recém-criado
      .filter((c) => { const la = lastAtend[c.id]; return !la || la < cutoffEsfriando; })
      .sort((a, b) => (Number(b.valor_estimado) || 0) - (Number(a.valor_estimado) || 0)),
    [ativos, lastAtend, cutoffEsfriando]
  );

  const marcarContatado = async (id: string) => {
    if (!user?.office_id) return;
    const novaData = toStr(addDays(new Date(), followupDias));
    await supabase.from("clientes").update({ proximo_contato: novaData } as any).eq("id", id).eq("office_id", user.office_id);
    refresh?.();
  };

  return { contatosHoje, esfriando, loading, marcarContatado };
}
