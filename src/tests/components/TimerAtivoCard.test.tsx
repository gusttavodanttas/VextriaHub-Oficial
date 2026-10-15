// Card do timer ativo (extraído de pages/Timesheet.tsx): estados sem/com timer,
// avisos e botões de ação só com permissão.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
// shared.ts → useTimesheetConfig → client do Supabase (exige env): mock, como nos outros testes de componente.
vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});

import { TimerAtivoCard } from '@/components/Timesheet/TimerAtivoCard';
import type { Timesheet } from '@/services/timesheetService';

const base = { onPause: vi.fn(), onFinalizar: vi.fn(), onNovo: vi.fn(), navigate: vi.fn(), navigateToRef: vi.fn() };
const timer = {
  id: 't1', status: 'ativo', categoria: 'reuniao', tarefa_descricao: 'Reunião com cliente',
  cliente_id: 'c1', clientes: { nome: 'Maria' }, referencia_tipo: null, referencia_id: null, referencia_label: null,
  data_inicio: new Date().toISOString(),
} as unknown as Timesheet;

describe('TimerAtivoCard', () => {
  it('sem timer: convite para iniciar, botão só com permissão', () => {
    const { rerender } = render(<TimerAtivoCard {...base} activeTimer={null} elapsedTime={0} canManageTimesheet={false} />);
    expect(screen.getByText('Nenhum timer ativo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Iniciar Atividade/ })).toBeNull();
    rerender(<TimerAtivoCard {...base} activeTimer={null} elapsedTime={0} canManageTimesheet />);
    fireEvent.click(screen.getByRole('button', { name: /Iniciar Atividade/ }));
    expect(base.onNovo).toHaveBeenCalled();
  });

  it('com timer: descrição, cliente, cronômetro, aviso de 8h e ações', () => {
    render(<TimerAtivoCard {...base} activeTimer={timer} elapsedTime={8 * 3600 + 1} canManageTimesheet />);
    expect(screen.getByText('Reunião com cliente')).toBeInTheDocument();
    expect(screen.getByText('08:00:01')).toBeInTheDocument();
    expect(screen.getByText(/já passa de 8h/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Maria'));
    expect(base.navigate).toHaveBeenCalledWith('/clientes?openId=c1');
    fireEvent.click(screen.getByRole('button', { name: /Pausar/ }));
    expect(base.onPause).toHaveBeenCalledWith('t1');
    fireEvent.click(screen.getByRole('button', { name: /Finalizar/ }));
    expect(base.onFinalizar).toHaveBeenCalledWith('t1');
  });
});
