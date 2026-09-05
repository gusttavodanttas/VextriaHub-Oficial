import { useState } from 'react';
import { TimesheetCategoria } from '@/types/timesheet';
import type { TimesheetConfig } from '@/hooks/useTimesheetConfig';

interface ManualEntryDeps {
  config: TimesheetConfig;
  update: (id: string, payload: any) => Promise<any>;
  addManual: (payload: any) => Promise<any>;
}

// Data em fuso LOCAL — evita o bug do +1 dia que `toISOString()` (UTC) causava em
// lançamentos noturnos: a hora já é lida em local, então a data tem que casar.
const toLocalYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Lançamento manual / edição de timesheet: state do formulário + abrir (novo/editar)
 * + salvar (insert/update). Extraído do god-component Timesheet.tsx (mesmo padrão de
 * useProcessoMovimentacoes) — comportamento idêntico.
 */
export function useTimesheetManualEntry({ config, update, addManual }: ManualEntryDeps) {
  const [manualOpen, setManualOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [mDesc, setMDesc] = useState("");
  const [mCat, setMCat] = useState<TimesheetCategoria | "">("");
  const [mCli, setMCli] = useState("");
  const [mData, setMData] = useState("");
  const [mInicio, setMInicio] = useState("");
  const [mFim, setMFim] = useState("");
  const [mFat, setMFat] = useState(true);
  const [mValor, setMValor] = useState("");
  const [mObs, setMObs] = useState("");
  const [mSaving, setMSaving] = useState(false);

  const openManual = () => {
    setEditTarget(null);
    const now = new Date();
    setMDesc(""); setMCat(""); setMCli(""); setMFat(true); setMObs("");
    setMValor(config.valorPadrao != null ? String(config.valorPadrao) : "");
    setMData(toLocalYmd(now));
    setMInicio("09:00"); setMFim("10:00");
    setManualOpen(true);
  };

  const openEdit = (t: any) => {
    setEditTarget(t);
    const ini = new Date(t.data_inicio);
    const fim = t.data_fim ? new Date(t.data_fim) : new Date(ini.getTime() + (t.duracao_minutos || 0) * 60000);
    setMDesc(t.tarefa_descricao || "");
    setMCat((t.categoria as TimesheetCategoria) || "");
    setMCli(t.cliente_id || "");
    setMData(toLocalYmd(ini));
    setMInicio(ini.toTimeString().slice(0, 5));
    setMFim(fim.toTimeString().slice(0, 5));
    setMFat(t.faturavel !== false);
    setMValor(t.valor_hora != null ? String(t.valor_hora) : "");
    setMObs(t.observacoes || "");
    setManualOpen(true);
  };

  const saveManual = async () => {
    if (!mDesc.trim() || !mCat || !mData || !mInicio || !mFim) return;
    const inicioDate = new Date(`${mData}T${mInicio}:00`);
    let fimDate = new Date(`${mData}T${mFim}:00`);
    // Turno que passa da meia-noite (ex.: 23:00-01:00): início e fim usam a mesma
    // data no formulário, então fim "antes" do início na verdade é no dia seguinte.
    // Antes disto a função só fazia `return` — o diálogo ficava aberto sem
    // explicar por quê, e a hora trabalhada nunca era salva.
    if (fimDate.getTime() <= inicioDate.getTime()) fimDate = new Date(fimDate.getTime() + 24 * 60 * 60000);
    const inicioISO = inicioDate.toISOString();
    const fimISO = fimDate.toISOString();
    const dur = Math.round((fimDate.getTime() - inicioDate.getTime()) / 60000);
    if (dur <= 0) return;
    setMSaving(true);
    const billingFields: any = { faturavel: mFat };
    if (mValor) billingFields.valor_hora = Number(mValor);
    if (editTarget) {
      await update(editTarget.id, {
        tarefa_descricao: mDesc.trim(), categoria: mCat, cliente_id: mCli || null,
        data_inicio: inicioISO, data_fim: fimISO, duracao_minutos: dur,
        observacoes: mObs.trim() || null, ...billingFields,
      });
    } else {
      await addManual({
        tarefa_descricao: mDesc.trim(), categoria: mCat as TimesheetCategoria, cliente_id: mCli || null,
        data_inicio: inicioISO, data_fim: fimISO, duracao_minutos: dur,
        observacoes: mObs.trim() || null, faturavel: mFat, valor_hora: mValor ? Number(mValor) : null,
      });
    }
    setMSaving(false); setManualOpen(false);
  };

  return {
    manualOpen, setManualOpen, editTarget,
    mDesc, setMDesc, mCat, setMCat, mCli, setMCli, mData, setMData,
    mInicio, setMInicio, mFim, setMFim, mFat, setMFat, mValor, setMValor, mObs, setMObs, mSaving,
    openManual, openEdit, saveManual,
  };
}
