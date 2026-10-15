// useTimesheetFilters: exclui o timer ativo, filtra por busca/categoria/cliente/
// faturado e agrupa por dia (mais recente primeiro).
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimesheetFilters } from '@/hooks/useTimesheetFilters';

const ts = [
  { id: '1', status: 'ativo', tarefa_descricao: 'Em andamento', categoria: 'peticao', cliente_id: 'c1', data_inicio: '2026-10-09T10:00:00' },
  { id: '2', status: 'finalizado', tarefa_descricao: 'Petição inicial', categoria: 'peticao', cliente_id: 'c1', faturado: true, data_inicio: '2026-10-09T09:00:00', clientes: { nome: 'Maria' } },
  { id: '3', status: 'finalizado', tarefa_descricao: 'Reunião', categoria: 'atendimento', cliente_id: 'c2', data_inicio: '2026-10-08T09:00:00', clientes: { nome: 'João' } },
  { id: '4', status: 'finalizado', tarefa_descricao: 'Audiência', categoria: 'audiencia', cliente_id: 'c1', faturado: false, data_inicio: '2026-10-08T15:00:00' },
];

describe('useTimesheetFilters', () => {
  it('sem filtros: ignora o ativo e agrupa por dia decrescente', () => {
    const { result } = renderHook(() => useTimesheetFilters(ts));
    const dias = result.current.grouped.map(([, recs]) => recs.map((r) => r.id));
    expect(dias).toEqual([['2'], ['3', '4']]);
  });

  it('busca por descrição ou nome do cliente, categoria, cliente e faturado', () => {
    const { result } = renderHook(() => useTimesheetFilters(ts));
    act(() => { result.current.setFSearch('joão'); });
    expect(result.current.grouped.flatMap(([, r]) => r.map((x) => x.id))).toEqual(['3']);
    act(() => { result.current.setFSearch(''); result.current.setFCategoria('peticao'); });
    expect(result.current.grouped.flatMap(([, r]) => r.map((x) => x.id))).toEqual(['2']);
    act(() => { result.current.setFCategoria('todas'); result.current.setFCliente('c1'); result.current.setFFaturado('nao_faturado'); });
    expect(result.current.grouped.flatMap(([, r]) => r.map((x) => x.id))).toEqual(['4']);
    act(() => { result.current.setFFaturado('faturado'); });
    expect(result.current.grouped.flatMap(([, r]) => r.map((x) => x.id))).toEqual(['2']);
  });
});
