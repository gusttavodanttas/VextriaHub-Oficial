// Completar dados pelo tribunal: só campos vazios entram, o usuário escolhe
// quais aplicar, erro do edge mostra a mensagem real e a RLS barrando não diz "completado".
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock, mockSupabase } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', office_id: 'o1' }, profile: { oab: '123', oab_uf: 'SP' } }) }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock('@/lib/monitoring', () => ({ captureError: vi.fn() }));

import { CompletarDadosDialog } from '@/components/Processos/CompletarDadosDialog';

const NUMERO = '0001234-56.2026.8.26.0100';

function montar() {
  const onOpenChange = vi.fn(); const onApplied = vi.fn();
  render(<CompletarDadosDialog open onOpenChange={onOpenChange} processoId="p1" numeroProcesso={NUMERO} onApplied={onApplied} />);
  return { onOpenChange, onApplied };
}

describe('CompletarDadosDialog', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); mockSupabase.functions.invoke.mockReset(); });
  afterEach(() => cleanup());

  it('lista só os campos vazios, aplica os marcados com checagem de linhas', async () => {
    const { onOpenChange, onApplied } = montar();
    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: { vara: '1ª Vara Cível', autor: 'Maria', reu: 'Empresa X', valorCausa: 1500, classe: 'Procedimento Comum' }, error: null });
    enfileirar('processos', { data: { vara: null, parte_autora: 'Já preenchida', requerido: '', valor_causa: 0, classe_judicial: null, tipo_processo: 'Cível', tribunal: null } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar dados/ }));
    await waitFor(() => expect(screen.getByText('Vara')).toBeInTheDocument());
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('fetch-processo', { body: { numeroProcesso: NUMERO, oab: '123', uf: 'SP' } });
    expect(screen.getByText('1ª Vara Cível')).toBeInTheDocument();
    expect(screen.getByText('Réu / Requerido')).toBeInTheDocument();
    expect(screen.getByText('Classe judicial')).toBeInTheDocument();
    expect(screen.getByText('Tribunal')).toBeInTheDocument(); // derivado do número CNJ
    expect(screen.getByText(/R\$\s?1\.500,00/)).toBeInTheDocument();
    expect(screen.queryByText('Parte autora')).not.toBeInTheDocument(); // já preenchida
    expect(screen.queryByText('Tipo de processo')).not.toBeInTheDocument();

    // desmarca o valor da causa
    const checks = screen.getAllByRole('checkbox');
    fireEvent.click(checks[checks.length - 1]);

    enfileirar('processos', { data: [] }); // RLS barrando
    fireEvent.click(screen.getByRole('button', { name: /Aplicar selecionados/ }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao salvar', variant: 'destructive' })));
    expect(onOpenChange).not.toHaveBeenCalled();
    const up = chamadasCom('processos', 'update')[0];
    const payload = up.ops[0][1][0] as Record<string, unknown>;
    expect(payload).toMatchObject({ vara: '1ª Vara Cível', requerido: 'Empresa X', classe_judicial: 'Procedimento Comum' });
    expect(payload).not.toHaveProperty('valor_causa');
    expect(payload).not.toHaveProperty('parte_autora');
    expect(up.ops).toEqual(expect.arrayContaining([['eq', ['id', 'p1']], ['select', ['id']]]));

    enfileirar('processos', { data: [{ id: 'p1' }] });
    fireEvent.click(screen.getByRole('button', { name: /Aplicar selecionados/ }));
    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Dados completados', description: '4 campo(s) preenchido(s).' }));
  });

  it('nada vazio → aviso; erro do edge usa a mensagem real do corpo e explica "não encontrado"', async () => {
    montar();
    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: { vara: 'X' }, error: null });
    enfileirar('processos', { data: { vara: 'Já', tribunal: 'TJSP' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar dados/ }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nada a completar' })));
    expect(screen.getByText(/Nada a completar — os campos já estão preenchidos/)).toBeInTheDocument();

    cleanup(); mockToast.mockClear(); resetSupabaseMock();
    montar();
    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'non-2xx', context: { json: async () => ({ error: 'Processo não encontrado' }) } } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar dados/ }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro na busca', description: expect.stringMatching(/pode levar alguns dias para ser indexado/) })));
    expect(chamadasCom('processos', 'select')).toHaveLength(0);

    mockToast.mockClear();
    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'non-2xx', context: { json: async () => ({ error: 'Limite do plano atingido' }) } } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar dados/ }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro na busca', description: 'Limite do plano atingido' })));
  });
});
