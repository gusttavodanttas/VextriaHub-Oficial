// Tipos de ato e feriados do escritório: feriados que não carregaram bloqueiam a
// edição (salvar gravaria a lista vazia por cima), feriado anual vira MM-DD,
// exclusão e restauração com checagem de linhas (RLS).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { GerenciarTiposModal } from '@/components/Prazos/GerenciarTiposModal';

const tipos = [
  { id: 't1', office_id: 'o1', value: 'contestacao', label: 'Contestação', dias_uteis: 15, corridos: false, margem: 3, ordem: 0 },
  { id: 't2', office_id: 'o1', value: 'recurso', label: 'Recurso', dias_uteis: 15, corridos: true, margem: 2, ordem: 1 },
];
const settings = { prazo_feriados: ['12-25', '2026-11-20'], outra_chave: { x: 1 } };

function montar() {
  const onClose = vi.fn();
  render(<GerenciarTiposModal open onClose={onClose} officeId="o1" />);
  return { onClose };
}
const linhaDe = (label: string) => screen.getByText(label).parentElement!.parentElement!;

describe('GerenciarTiposModal', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });
  afterEach(() => cleanup());

  it('carrega tipos e feriados do escritório', async () => {
    enfileirar('tipos_ato_prazo', { data: tipos });
    enfileirar('offices', { data: { settings } });
    montar();
    expect(await screen.findByText('Contestação')).toBeInTheDocument();
    expect(screen.getByText('15d corridos · margem 2d')).toBeInTheDocument();
    expect(screen.getByText('25/12 · todo ano')).toBeInTheDocument();
    expect(screen.getByText('20/11/2026')).toBeInTheDocument();
    expect(chamadasCom('tipos_ato_prazo', 'insert')).toHaveLength(0);
  });

  it('feriados que não carregaram: aviso, botão de adicionar desabilitado e nada é gravado', async () => {
    enfileirar('tipos_ato_prazo', { data: tipos });
    enfileirar('offices', { error: { message: 'rls' } });
    montar();
    expect(await screen.findByText('rls')).toBeInTheDocument();
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: '2026-12-31' } });
    const add = screen.getByRole('button', { name: 'Tentar de novo' }).parentElement!.parentElement!.querySelectorAll('button');
    expect(Array.from(add).some((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    expect(chamadasCom('offices', 'update')).toHaveLength(0);

    enfileirar('offices', { data: { settings } });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('25/12 · todo ano')).toBeInTheDocument();
  });

  it('feriado anual vira MM-DD e é mesclado por cima das outras chaves; RLS no update desfaz', async () => {
    enfileirar('tipos_ato_prazo', { data: tipos });
    enfileirar('offices', { data: { settings } });
    montar();
    await screen.findByText('25/12 · todo ano');
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: '2026-01-25' } });
    fireEvent.click(screen.getByRole('checkbox'));
    enfileirar('offices', { data: { settings } }); // releitura do patch
    enfileirar('offices', { data: [{ id: 'o1' }] }); // update ok
    fireEvent.click(screen.getByRole('checkbox').closest('label')!.parentElement!.querySelector('button.h-8')!);
    expect(await screen.findByText('25/01 · todo ano')).toBeInTheDocument();
    await waitFor(() => expect(chamadasCom('offices', 'update')).toHaveLength(1));
    expect(chamadasCom('offices', 'update')[0].ops[0]).toEqual(['update', [{ settings: { prazo_feriados: ['01-25', '12-25', '2026-11-20'], outra_chave: { x: 1 } } }]]);

    // remover com RLS barrando → volta
    enfileirar('offices', { data: { settings: { ...settings, prazo_feriados: ['01-25', '12-25', '2026-11-20'] } } });
    enfileirar('offices', { data: [] });
    fireEvent.click(within(screen.getByText('20/11/2026')).getByRole('button'));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao salvar feriado' })));
    expect(screen.getByText('20/11/2026')).toBeInTheDocument();
  });

  it('excluir tipo: RLS (0 linhas) → "Erro ao excluir"; editar grava e recarrega', async () => {
    enfileirar('tipos_ato_prazo', { data: tipos });
    enfileirar('offices', { data: { settings } });
    montar();
    await screen.findByText('Recurso');
    enfileirar('tipos_ato_prazo', { data: [] });
    fireEvent.click(within(linhaDe('Recurso')).getAllByRole('button')[1]);
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao excluir' })));
    expect(chamadasCom('tipos_ato_prazo', 'delete')[0].ops).toEqual(expect.arrayContaining([['eq', ['id', 't2']], ['select', ['id']]]));
    expect(screen.getByText('Recurso')).toBeInTheDocument();

    fireEvent.click(within(linhaDe('Recurso')).getAllByRole('button')[0]);
    const nome = screen.getByPlaceholderText('Nome do tipo de ato');
    fireEvent.change(nome, { target: { value: 'Recurso Especial' } });
    enfileirar('tipos_ato_prazo', { data: [{ id: 't2' }] });
    enfileirar('tipos_ato_prazo', { data: [tipos[0], { ...tipos[1], label: 'Recurso Especial' }] });
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    expect(await screen.findByText('Recurso Especial')).toBeInTheDocument();
    expect(chamadasCom('tipos_ato_prazo', 'update')[0].ops).toEqual(expect.arrayContaining([
      ['update', [{ label: 'Recurso Especial', dias_uteis: 15, corridos: true, margem: 2 }]], ['eq', ['id', 't2']], ['select', ['id']],
    ]));
  });

  it('restaurar padrões: delete barrado (menos linhas que os tipos) → erro, sem inserir', async () => {
    enfileirar('tipos_ato_prazo', { data: tipos });
    enfileirar('offices', { data: { settings } });
    montar();
    await screen.findByText('Recurso');
    enfileirar('tipos_ato_prazo', { data: [{ id: 't1' }] }); // apagou só 1 de 2
    enfileirar('tipos_ato_prazo', { data: tipos }); // reload
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar padrões CPC' }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao restaurar padrão' })));
    expect(chamadasCom('tipos_ato_prazo', 'insert')).toHaveLength(0);
    expect(chamadasCom('tipos_ato_prazo', 'delete')[0].ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['select', ['id']]]));
  });
});
