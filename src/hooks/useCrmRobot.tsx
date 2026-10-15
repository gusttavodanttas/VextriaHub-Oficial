import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { assertRowsAffected, getErrorMessage } from "@/lib/errors";
import { captureError } from "@/lib/monitoring";
import { usePermissions } from "@/hooks/usePermissions";

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
  error: string | null;
  refetch: () => void;
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
  const { toast } = useToast();
  const { canManageCRM } = usePermissions();
  const [lastAtend, setLastAtend] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
    if (!ids.length) { setLastAtend({}); setError(null); setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("atendimentos")
        .select("cliente_id, data_atendimento")
        .in("cliente_id", ids)
        .eq("deletado", false);
      if (cancel) return;
      // Sem o último atendimento de cada lead, TODO lead quente/morno parecia
      // "esfriando" — o robô inflava a lista com o CRM inteiro. Agora vira erro.
      if (fetchError) {
        setLastAtend({});
        setError(getErrorMessage(fetchError, "Não foi possível carregar o histórico de atendimentos dos leads."));
        setLoading(false);
        return;
      }
      setError(null);
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
  }, [idsKey, reloadKey]);

  // Auto follow-up: 1x/dia, agenda próximo contato para leads ativos sem data
  useEffect(() => {
    const officeId = user?.office_id;
    // Só quem gerencia o CRM dispara a escrita automática (antes rodava pra
    // qualquer um que abrisse a tela, inclusive quem só visualiza).
    if (!officeId || ativos.length === 0 || !canManageCRM) return;
    const key = `crm_robot_followup_${officeId}`;
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < 20 * 60 * 60 * 1000) return;
    const semData = ativos.filter((c) => !c.proximo_contato).map((c) => c.id);
    if (semData.length === 0) { localStorage.setItem(key, String(Date.now())); return; }
    (async () => {
      const novaData = toStr(addDays(new Date(), followupDias));
      const { data, error: updError } = await supabase
        .from("clientes")
        .update({ proximo_contato: novaData })
        .in("id", semData)
        .eq("office_id", officeId)
        .select("id");
      // Só marca o guard do dia se gravou de verdade (erro ou 0 linhas por RLS →
      // tenta de novo depois). Falha vai pro Sentry: é automática, sem ação do usuário.
      if (updError || !data?.length) {
        if (updError) captureError(updError, { context: "useCrmRobot.autoFollowup", officeId });
        return;
      }
      localStorage.setItem(key, String(Date.now()));
      refresh?.();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, user?.office_id, canManageCRM]);

  const contatosHoje = useMemo(
    () => ativos
      .filter((c) => c.proximo_contato && c.proximo_contato <= hoje)
      .sort((a, b) => (a.proximo_contato || "").localeCompare(b.proximo_contato || "")),
    [ativos, hoje]
  );

  const esfriando = useMemo(
    () => (loading || error) ? [] : ativos
      .filter((c) => ["quente", "morno"].includes((c.status || "").toLowerCase()))
      .filter((c) => (c.created_at || "").slice(0, 10) <= cutoffEsfriando) // não pega lead recém-criado
      .filter((c) => { const la = lastAtend[c.id]; return !la || la < cutoffEsfriando; })
      .sort((a, b) => (Number(b.valor_estimado) || 0) - (Number(a.valor_estimado) || 0)),
    [ativos, lastAtend, cutoffEsfriando, loading, error]
  );

  const marcarContatado = async (id: string) => {
    if (!user?.office_id || !canManageCRM) return;
    const novaData = toStr(addDays(new Date(), followupDias));
    try {
      const { data, error } = await supabase
        .from("clientes")
        .update({ proximo_contato: novaData })
        .eq("id", id)
        .eq("office_id", user.office_id)
        .select("id");
      assertRowsAffected(data, error, 1);
      refresh?.();
    } catch (e) {
      toast({ title: "Não foi possível marcar como contatado", description: getErrorMessage(e), variant: "destructive" });
    }
  };

  return { contatosHoje, esfriando, loading, error, refetch: () => setReloadKey((k) => k + 1), marcarContatado };
}
