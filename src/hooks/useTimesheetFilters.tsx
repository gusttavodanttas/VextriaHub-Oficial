import { useState, useMemo } from 'react';

/**
 * Filtros (busca/categoria/cliente/faturado) + registros agrupados por dia do Timesheet.
 * Extraído do god-component Timesheet.tsx — comportamento idêntico.
 */
export function useTimesheetFilters(timesheets: any[]) {
  const [fSearch, setFSearch] = useState("");
  const [fCategoria, setFCategoria] = useState("todas");
  const [fCliente, setFCliente] = useState("todos");
  const [fFaturado, setFFaturado] = useState("todos");

  // Registros filtrados + agrupados por dia
  const grouped = useMemo(() => {
    const q = fSearch.toLowerCase();
    const recs = timesheets.filter(t => {
      if (t.status === "ativo") return false;
      const matchSearch = !q || t.tarefa_descricao?.toLowerCase().includes(q) || ((t as any).clientes?.nome || "").toLowerCase().includes(q);
      const matchCat = fCategoria === "todas" || t.categoria === fCategoria;
      const matchCli = fCliente === "todos" || t.cliente_id === fCliente;
      const matchFat = fFaturado === "todos"
        || (fFaturado === "faturado" ? (t as any).faturado === true : (t as any).faturado !== true);
      return matchSearch && matchCat && matchCli && matchFat;
    });
    const acc: Record<string, any[]> = {};
    recs.forEach(t => { const day = new Date(t.data_inicio).toDateString(); (acc[day] ||= []).push(t); });
    return Object.entries(acc).sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());
  }, [timesheets, fSearch, fCategoria, fCliente, fFaturado]);

  return { fSearch, setFSearch, fCategoria, setFCategoria, fCliente, setFCliente, fFaturado, setFFaturado, grouped };
}
