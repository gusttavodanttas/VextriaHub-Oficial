// Follow-up após concluir um atendimento: o desfecho precisa ser gravado de
// verdade antes de fechar/encaminhar (RLS barrando em silêncio não fecha o
// diálogo), próximo contato (CRM) e tarefa vinculada.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', office_id: 'o1' } }) }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
const mutate = vi.fn();
vi.mock('@/hooks/useTarefas', () => ({ useTarefas: () => ({ create: { mutate } }) }));

import { FollowUpDialog } from '@/components/Atendimentos/FollowUpDialog';

const item = { id: 'a1', tipo_atendimento: 'reuniao', data_atendimento: '2026-10-09', observacoes: null, status: 'concluido', cliente_id: 'c1', processo_id: null, responsavel_id: null, resultado: 'inicial', clientes: { nome: 'Maria' } } as never;

function montar(over: Record<string, unknown> = {}) {
  const onClose = vi.fn(); const onAgendarProximo = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><FollowUpDialog item={{ ...(item as object), ...over } as never} onClose={onClose} onAgendarProximo={onAgendarProximo} /></QueryClientProvider>);
  return { onClose, onAgendarProximo };
}

describe('FollowUpDialog', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); mutate.mockReset(); });
  afterEach(() => cleanup());

  it('sem mudar o desfecho, "Salvar e fechar" não toca o banco e fecha; encaminhar vai pro próximo', async () => {
    const { onClose, onAgendarProximo } = montar();
    expect(screen.getByText(/Maria ·/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e fechar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(chamadasCom('atendimentos', 'update')).toHaveLength(0);
    fireEvent.click(screen.getByText('Agendar próximo atendimento'));
    await waitFor(() => expect(onAgendarProximo).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' })));
  });

  it('desfecho alterado: RLS barrando (0 linhas) → toast e o diálogo fica aberto; 1 linha → fecha', async () => {
    const { onClose } = montar();
    fireEvent.change(screen.getByPlaceholderText('O que ficou decidido neste atendimento?'), { target: { value: ' Acordo fechado ' } });
    enfileirar('atendimentos', { data: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e fechar' }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível salvar o desfecho', variant: 'destructive' })));
    expect(onClose).not.toHaveBeenCalled();
    const up = chamadasCom('atendimentos', 'update')[0];
    expect(up.ops).toEqual(expect.arrayContaining([['update', [{ resultado: 'Acordo fechado' }]], ['eq', ['id', 'a1']], ['select', ['id']]]));

    enfileirar('atendimentos', { data: [{ id: 'a1' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e fechar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('próximo contato: grava em clientes com checagem de linhas; sem cliente a opção nem aparece', async () => {
    const { onClose } = montar();
    fireEvent.click(screen.getByText('Definir próximo contato'));
    const data = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(data.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(data, { target: { value: '2026-11-20' } });
    enfileirar('clientes', { data: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao salvar contato' })));
    expect(onClose).not.toHaveBeenCalled();

    enfileirar('clientes', { data: [{ id: 'c1' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockToast).toHaveBeenLastCalledWith({ title: 'Próximo contato definido!' });
    expect(chamadasCom('clientes', 'update')[1].ops).toEqual(expect.arrayContaining([['update', [{ proximo_contato: '2026-11-20' }]], ['eq', ['id', 'c1']], ['select', ['id']]]));

    cleanup();
    montar({ cliente_id: null });
    expect(screen.queryByText('Definir próximo contato')).not.toBeInTheDocument();
  });

  it('tarefa de follow-up: título sugerido com o cliente, vinculada ao atendimento, fecha no sucesso', async () => {
    const { onClose } = montar({ responsavel_id: 'u9' });
    fireEvent.click(screen.getByText('Criar tarefa de follow-up'));
    const titulo = screen.getByPlaceholderText('Título da tarefa') as HTMLInputElement;
    expect(titulo.value).toBe('Follow-up — Maria');
    fireEvent.change(titulo, { target: { value: '  ' } });
    expect(screen.getByRole('button', { name: 'Criar tarefa' })).toBeDisabled();
    fireEvent.change(titulo, { target: { value: 'Ligar pra Maria' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    const [payload, opts] = mutate.mock.calls[0] as [Record<string, unknown>, { onSuccess: () => void; onError: () => void }];
    expect(payload).toMatchObject({ titulo: 'Ligar pra Maria', prioridade: 'media', cliente_id: 'c1', atendimento_id: 'a1', responsavel_id: 'u9' });
    expect(payload.data_vencimento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    opts.onError();
    expect(onClose).not.toHaveBeenCalled();
    opts.onSuccess();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
