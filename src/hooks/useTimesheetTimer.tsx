import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TimesheetCategoria } from '@/types/timesheet';
import type { TimesheetConfig } from '@/hooks/useTimesheetConfig';
import { REFERENCIA_CONFIG, CATEGORIA_TO_REF, type ReferenciaTipo, type ReferenciaItem } from '@/components/Timesheet/shared';

interface TimerDeps {
  activeTimer: any;
  startTimer: (...args: any[]) => Promise<any>;
  config: TimesheetConfig;
  user: { id: string } | null;
  navigate: (path: string) => void;
}

/**
 * Timer ao vivo do Timesheet: form (descrição/categoria/cliente/valor/referência),
 * cronômetro, carga dos itens de referência e iniciar. Extraído do god-component
 * Timesheet.tsx — comportamento idêntico. `clientes` (lista) fica no componente (compartilhado).
 */
export function useTimesheetTimer({ activeTimer, startTimer, config, user, navigate }: TimerDeps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [saving, setSaving] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<TimesheetCategoria | "">("");
  const [clienteId, setClienteId] = useState("");
  const [faturavel, setFaturavel] = useState(true);
  const [valorHora, setValorHora] = useState("");
  const [refTipo, setRefTipo] = useState<ReferenciaTipo | "">("");
  const [refItems, setRefItems] = useState<ReferenciaItem[]>([]);
  const [refLoading, setRefLoading] = useState(false);
  const [refId, setRefId] = useState("");
  const [refLabel, setRefLabel] = useState("");

  // Abre o timer via ?new=1 (link direto).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new")) {
      setDialogOpen(true);
      window.history.replaceState({}, "", "/timesheet");
    }
  }, []);

  // Cronômetro do timer ativo.
  useEffect(() => {
    if (!activeTimer || activeTimer.status !== "ativo") { setElapsedTime(0); return; }
    const tick = () => setElapsedTime(Math.floor((Date.now() - new Date(activeTimer.data_inicio).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  // Itens de referência (timer ao vivo).
  useEffect(() => {
    if (!refTipo || !user) return;
    const cfg = REFERENCIA_CONFIG[refTipo];
    setRefItems([]); setRefId(""); setRefLabel(""); setRefLoading(true);
    const fetchItems = async () => {
      try {
        if (refTipo === "prazo" && clienteId) {
          const { data: processos } = await supabase.from("processos").select("id").eq("cliente_id", clienteId).eq("deletado", false);
          const ids = (processos || []).map((p: any) => p.id);
          if (ids.length === 0) { setRefItems([]); return; }
          const { data } = await supabase.from("prazos").select("id, titulo, data_fim_prazo, data_vencimento")
            .in("processo_id", ids).eq("deletado", false).order("data_fim_prazo", { ascending: true }).limit(50);
          setRefItems((data || []).map((r: any) => { const dt = r.data_fim_prazo || r.data_vencimento; return { id: r.id, label: r.titulo || "Sem título", sublabel: dt ? `Vence ${new Date(dt).toLocaleDateString("pt-BR")}` : undefined }; }));
          return;
        }
        let q = (supabase as any).from(cfg.table)
          .select(`id, ${cfg.labelField}${cfg.dateField ? `, ${cfg.dateField}` : ""}`)
          .eq("user_id", user.id).eq("deletado", false)
          .order(cfg.dateField || "created_at", { ascending: false }).limit(50);
        if (clienteId && cfg.clienteField) q = q.eq(cfg.clienteField, clienteId);
        const { data } = await q;
        setRefItems((data || []).map((r: any) => ({ id: r.id, label: r[cfg.labelField] || "Sem título", sublabel: cfg.dateField ? new Date(r[cfg.dateField]).toLocaleDateString("pt-BR") : undefined })));
      } finally { setRefLoading(false); }
    };
    fetchItems();
  }, [refTipo, clienteId, user]);

  const handleSetCategoria = (cat: TimesheetCategoria) => {
    setCategoria(cat); setRefId(""); setRefLabel(""); setRefItems([]);
    setRefTipo(CATEGORIA_TO_REF[cat] ?? "");
  };

  const resetDialog = () => {
    setDescricao(""); setCategoria(""); setClienteId(""); setFaturavel(true); setValorHora("");
    setRefTipo(""); setRefItems([]); setRefId(""); setRefLabel("");
  };

  const openTimer = () => {
    setValorHora(config.valorPadrao != null ? String(config.valorPadrao) : "");
    setDialogOpen(true);
  };

  const handleStart = async () => {
    if (!descricao || !categoria) return;
    setSaving(true);
    await startTimer(descricao, categoria as TimesheetCategoria, clienteId || undefined, undefined,
      refTipo || undefined, refId || undefined, refLabel || undefined,
      { faturavel, valor_hora: valorHora ? Number(valorHora) : null });
    resetDialog(); setDialogOpen(false); setSaving(false);
  };

  const navigateToRef = (tipo: string, refIdArg?: string | null) => {
    const cfg = REFERENCIA_CONFIG[tipo as ReferenciaTipo];
    if (!cfg) return;
    navigate(refIdArg ? `${cfg.route}?openId=${refIdArg}` : cfg.route);
  };

  return {
    dialogOpen, setDialogOpen, elapsedTime, saving, setSaving,
    descricao, setDescricao, categoria, setCategoria, clienteId, setClienteId,
    faturavel, setFaturavel, valorHora, setValorHora,
    refTipo, setRefTipo, refItems, setRefItems, refLoading, refId, setRefId, refLabel, setRefLabel,
    handleSetCategoria, resetDialog, openTimer, handleStart, navigateToRef,
  };
}
