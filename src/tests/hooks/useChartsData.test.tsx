// useChartsData: agrega as 10 consultas em séries mensais, status, por membro com
// pontuação configurável; filtro por equipe via .or; erro em qualquer consulta
// vira isError (não "sem dados").
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { useChartsData } from '@/hooks/useChartsData';

const agora = new Date();
const mesKey = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
const nesteMes = `${mesKey}-05T12:00:00`; // local, com "T"
const nesteMesData = `${mesKey}-05`;

function enfileirarTudo(over: Partial<Record<string, unknown>> = {}) {
  const padrao: Record<string, unknown> = {
    processos: { data: [
      { status: 'ativo', tipo_processo: 'Cível', created_at: nesteMes, responsavel_id: 'u1', user_id: 'u1' },
      { status: 'encerrado', tipo_processo: 'Cível', created_at: '2020-01-10T12:00:00', updated_at: nesteMes, data_distribuicao: '2020-01-01', data_encerramento: '2020-01-31', resultado: 'ganho', responsavel_id: null, user_id: 'u2' },
    ] },
    prazos: { data: [
      { responsavel_id: 'u1', status: 'concluido', tipo_prazo: ' Recurso ', created_at: nesteMes, data_fim_prazo: nesteMesData },
      { responsavel_id: 'u1', status: 'pendente', tipo_prazo: '', created_at: nesteMes, data_fim_prazo: '2020-01-01' },
    ] },
    clientes: { data: [
      { tipo_pessoa: 'fisica', status: 'ativo', created_at: nesteMes }, { tipo_pessoa: 'juridica', status: 'convertido', created_at: nesteMes }, { tipo_pessoa: null, status: 'lead', created_at: '2020-01-01T12:00:00' },
    ] },
    atendimentos: { data: [{ created_at: nesteMes, responsavel_id: 'u1' }] },
    financeiro: { data: [{ tipo: 'receita', valor: '100', categoria: 'Honorários', created_at: nesteMes }, { tipo: 'despesa', valor: 40, categoria: null, created_at: nesteMes }] },
    consultivos: { data: [] },
    timesheets: { data: [{ created_at: nesteMes, duracao_minutos: 90, user_id: 'u1' }] },
    offices: { data: { settings: { chart_pontos: { tarefa: 20, prazo: { Recurso: 50 } } } } },
    tarefas: { data: [
      { responsavel_id: 'u2', concluida: true, created_at: nesteMes }, { responsavel_id: null, user_id: 'u2', concluida: false, created_at: nesteMes, data_vencimento: '2020-01-01' },
    ] },
    audiencias: { data: [{ responsavel_id: 'u1', status: 'realizada', tipo: 'Instrução', data_audiencia: nesteMes }] },
    profiles: { data: [{ user_id: 'u1', full_name: 'Ana', email: 'a@x' }, { user_id: 'u2', full_name: null, email: 'b@x' }] },
  };
  for (const [t, r] of Object.entries({ ...padrao, ...over })) enfileirar(t, r as never);
}

describe('useChartsData', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('agrega totais, séries do mês corrente, status, duração, resultado e pontuação por membro', async () => {
    enfileirarTudo();
    const { result } = renderHook(() => useChartsData(6));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const d = result.current;
    expect(d.isError).toBe(false);
    expect(d.isEmpty).toBe(false);
    expect(d.totals).toEqual({ processos: 1, clientes: 2, atendimentos: 1, receita: 100, despesa: 40 });
    expect(d.processosPorMes).toHaveLength(6);
    expect(d.processosPorMes.at(-1)).toMatchObject({ novos: 1, encerrados: 1 });
    expect(d.processosPorMes[0]).toMatchObject({ novos: 0, encerrados: 0 });
    expect(d.statusProcessos.map((s) => [s.name, s.value])).toEqual([['Em andamento', 1], ['Encerrados', 1]]);
    expect(d.clientesPorTipo.map((s) => [s.name, s.value])).toEqual([['Pessoa Física', 2], ['Pessoa Jurídica', 1]]);
    expect(d.financeiroPorMes.at(-1)).toMatchObject({ receita: 100, despesa: 40 });
    expect(d.honorariosPorCategoria).toEqual([{ name: 'Honorários', value: 100, fill: '#6366f1' }]);
    expect(d.timesheetPorMes.at(-1)?.horas).toBe(1.5);
    expect(d.prazosPorMes.at(-1)).toMatchObject({ novos: 2, cumpridos: 1 });
    expect(d.prazosPorStatus.map((s) => [s.name, s.value])).toEqual([['Cumpridos', 1], ['Pendentes', 1]]);
    expect(d.tarefasPorMes.at(-1)).toMatchObject({ criadas: 2, concluidas: 1 });
    expect(d.audienciasPorStatus).toEqual([{ name: 'Realizadas', value: 1, fill: '#6366f1' }]);
    expect(d.duracaoMediaDias).toBe(30);
    expect(d.duracaoPorTipo).toEqual([{ name: 'Cível', dias: 30, qtd: 1 }]);
    expect(d.resultadoProcessos).toEqual([{ name: 'Ganho', value: 1, fill: '#10b981' }]);
    expect(d.tiposPrazo).toEqual(['Recurso']);
    expect(d.tiposAudiencia).toEqual(['Instrução']);
    expect(d.pontosConfig).toEqual({ tarefa: 20, processo: 40, penalidadeAtraso: 5, prazo: { _default: 25, Recurso: 50 }, audiencia: { _default: 15 } });
    // u1: prazo Recurso +50, atraso -5, audiência +15 = 60 | u2: processo encerrado +40, tarefa +20, atraso -5 = 55
    expect(d.porMembro).toEqual([
      expect.objectContaining({ name: 'Ana', processos: 1, prazos: 2, prazosConcluidos: 1, audiencias: 1, audienciasRealizadas: 1, atrasos: 1, pontos: 60 }),
      expect.objectContaining({ name: 'b@x', processos: 1, processosEncerrados: 1, tarefas: 2, tarefasConcluidas: 1, atrasos: 1, pontos: 55 }),
    ]);
    expect(chamadasCom('profiles', 'select')[0].ops).toEqual(expect.arrayContaining([['in', ['user_id', ['u1', 'u2']]]]));
    expect(chamadasCom('processos', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['eq', ['deletado', false]]]));
    expect(chamadasCom('processos', 'select')[0].ops.some(([m]) => m === 'or')).toBe(false);
  });

  it('equipe: restringe por responsável OU dono sem responsável; equipe vazia usa sentinela', async () => {
    enfileirar('office_team_members', { data: [{ user_id: 'u1' }, { user_id: 'u2' }] });
    enfileirarTudo();
    const { result } = renderHook(() => useChartsData(12, 'tm1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.processosPorMes).toHaveLength(12);
    const or = 'responsavel_id.in.(u1,u2),and(responsavel_id.is.null,user_id.in.(u1,u2))';
    for (const t of ['processos', 'prazos', 'atendimentos', 'consultivos']) expect(chamadasCom(t, 'select')[0].ops, t).toEqual(expect.arrayContaining([['or', [or]]]));
    expect(chamadasCom('financeiro', 'select')[0].ops).toEqual(expect.arrayContaining([['in', ['user_id', ['u1', 'u2']]]]));
    expect(chamadasCom('timesheets', 'select')[0].ops).toEqual(expect.arrayContaining([['in', ['user_id', ['u1', 'u2']]], ['eq', ['office_id', 'o1']]]));
    expect(chamadasCom('tarefas', 'select')[0].ops).toEqual(expect.arrayContaining([['in', ['responsavel_id', ['u1', 'u2']]]]));
    expect(chamadasCom('clientes', 'select')[0].ops.some(([m]) => m === 'or' || m === 'in')).toBe(false);

    resetSupabaseMock();
    enfileirar('office_team_members', { data: [] });
    enfileirarTudo();
    const { result: r2 } = renderHook(() => useChartsData(6, 'tm2'));
    await waitFor(() => expect(r2.current.loading).toBe(false));
    expect(chamadasCom('financeiro', 'select')[0].ops).toEqual(expect.arrayContaining([['in', ['user_id', ['00000000-0000-0000-0000-000000000000']]]]));
  });

  it('erro em qualquer consulta (membros, lote 1, lote 2) vira isError com mensagem', async () => {
    enfileirar('office_team_members', { error: { message: 'sem equipe' } });
    const { result } = renderHook(() => useChartsData(6, 'tm1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe('sem equipe');
    expect(chamadasCom('processos', 'select')).toHaveLength(0);

    resetSupabaseMock();
    enfileirarTudo({ financeiro: { error: { message: 'rls' } } });
    const { result: r2 } = renderHook(() => useChartsData(6));
    await waitFor(() => expect(r2.current.isError).toBe(true));
    expect(r2.current.error).toBe('rls');
    expect(r2.current.loading).toBe(false);

    resetSupabaseMock();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    enfileirarTudo({ audiencias: { error: { message: 'aud' } } });
    const { result: r3 } = renderHook(() => useChartsData(6));
    await waitFor(() => expect(r3.current.isError).toBe(true));
    expect(r3.current.error).toBe('aud');
  });

  it('escritório vazio → isEmpty com séries zeradas e config padrão; sem escritório não consulta', async () => {
    enfileirarTudo({ processos: { data: [] }, prazos: { data: [] }, clientes: { data: [] }, atendimentos: { data: [] }, financeiro: { data: [] }, timesheets: { data: [] }, offices: { data: null }, tarefas: { data: [] }, audiencias: { data: [] } });
    const { result } = renderHook(() => useChartsData(6));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.porMembro).toEqual([]);
    expect(result.current.pontosConfig.prazo).toEqual({ _default: 25 });
    expect(chamadasCom('profiles', 'select')).toHaveLength(0);

    resetSupabaseMock();
    auth.user = { id: 'u1', office_id: null };
    const { result: r2 } = renderHook(() => useChartsData(6));
    expect(r2.current.loading).toBe(true);
    expect(chamadasCom('processos', 'select')).toHaveLength(0);
  });
});
