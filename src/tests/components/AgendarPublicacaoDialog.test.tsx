// Agendar prazo/tarefa/audiência a partir de uma publicação: validação, vínculo
// ao processo pelos dígitos do número, descarte do prazo de origem com checagem
// de linhas e avisos quando o vínculo não é encontrado.
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

import { AgendarPublicacaoDialog } from '@/components/Processos/AgendarPublicacaoDialog';

type Props = Partial<React.ComponentProps<typeof AgendarPublicacaoDialog>>;
function montar(props: Props = {}) {
  const onOpenChange = vi.fn(); const onSuccess = vi.fn();
  const qc = new QueryClient();
  render(<QueryClientProvider client={qc}><AgendarPublicacaoDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} {...props} /></QueryClientProvider>);
  return { onOpenChange, onSuccess };
}
const preencher = (titulo: string, data: string) => {
  fireEvent.change(screen.getByPlaceholderText(/Ex: Contestação|Ex: Audiência/), { target: { value: titulo } });
  fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: data } });
};

describe('AgendarPublicacaoDialog', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });
  afterEach(() => cleanup());

  it('título obrigatório; prazo grava as duas datas e vincula ao processo pelos dígitos', async () => {
    const { onOpenChange, onSuccess } = montar({ numeroProcesso: '0001234-56.2026.8.26.0100', tituloSugerido: 'Contestação' });
    expect(screen.getByText(/Vinculado à publicação do processo 0001234-56/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Ex: Contestação/), { target: { value: '   ' } });
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: '2026-10-30' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar Prazo' }).closest('form')!); // `required` do HTML não barra espaços; o zod barra
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Campo obrigatório', description: 'Informe o título.' })));
    expect(chamadasCom('prazos', 'insert')).toHaveLength(0);

    preencher('Contestação', '2026-10-30');
    enfileirar('processos', { data: [{ id: 'p9', numero_processo: '00000000000000000000', cliente_id: null }, { id: 'p1', numero_processo: '00012345620268260100', cliente_id: 'c1' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Prazo' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(chamadasCom('prazos', 'insert')[0].ops[0][1][0]).toMatchObject({
      user_id: 'u1', office_id: 'o1', processo_id: 'p1', titulo: 'Contestação', data_vencimento: '2026-10-30', data_fim_prazo: '2026-10-30', prioridade: 'media', status: 'pendente',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockToast).toHaveBeenLastCalledWith({ title: 'Prazo agendado(a)', description: 'Salvo com sucesso.' });
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Salvo, mas sem vínculo ao processo' }));
  });

  it('audiência convertida de um prazo do robô: usa o processo informado, descarta a origem e avisa se a RLS barrar', async () => {
    montar({ defaultTipo: 'audiencia', processoId: 'p1', prazoOrigemId: 'z1', dataSugerida: '2026-11-05', horaSugerida: '14:30', tituloSugerido: 'Audiência detectada', tipoAudienciaSugerido: 'Audiência UNA' });
    enfileirar('processos', { data: { id: 'p1', cliente_id: 'c1' } });
    enfileirar('audiencias', { data: null });
    enfileirar('prazos', { data: [] }); // descarte barrado
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Audiência' }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Criado, mas o prazo de origem continua na agenda', variant: 'destructive' })));
    const aud = chamadasCom('audiencias', 'insert')[0].ops[0][1][0] as Record<string, unknown>;
    expect(aud).toMatchObject({ processo_id: 'p1', cliente_id: 'c1', titulo: 'Audiência detectada', tipo: 'Audiência UNA', status: 'agendada', local: null });
    expect(new Date(aud.data_audiencia as string).getTime()).toBe(new Date('2026-11-05T14:30').getTime());
    expect(chamadasCom('prazos', 'update')[0].ops).toEqual(expect.arrayContaining([['update', [{ deletado: true }]], ['eq', ['id', 'z1']], ['select', ['id']]]));
    expect(chamadasCom('processos', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['id', 'p1']], ['maybeSingle', []]]));
  });

  it('tarefa sem processo correspondente avisa o vínculo ausente; erro do insert vira "Erro ao salvar"', async () => {
    const { onOpenChange } = montar({ defaultTipo: 'tarefa', numeroProcesso: '9999999-99.2026.8.26.0100' });
    preencher('Ligar', '2026-10-15');
    enfileirar('processos', { data: [] });
    enfileirar('tarefas', { data: null });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Tarefa' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(chamadasCom('tarefas', 'insert')[0].ops[0][1][0]).toMatchObject({ processo_id: null, cliente_id: null, titulo: 'Ligar', concluida: false, status: 'pendente' });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Salvo, mas sem vínculo ao processo' }));
    expect(chamadasCom('prazos', 'update')).toHaveLength(0);

    cleanup(); mockToast.mockClear(); resetSupabaseMock();
    const r2 = montar({ defaultTipo: 'tarefa' });
    preencher('Ligar', '2026-10-15');
    enfileirar('tarefas', { error: new Error('negado') }); // PostgrestError é uma Error de verdade no client
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Tarefa' }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao salvar', description: 'negado' })));
    expect(r2.onOpenChange).not.toHaveBeenCalled();
    expect(chamadasCom('processos', 'select')).toHaveLength(0); // sem número nem id não resolve processo
  });
});
