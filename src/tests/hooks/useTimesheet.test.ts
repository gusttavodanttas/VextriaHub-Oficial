import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTimesheet } from '@/hooks/useTimesheet';
import { timesheetService } from '@/services/timesheetService';

// Mock do supabase (usado por marcarFaturado/estornarCobranca)
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock do contexto de Auth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user-id', office_id: 'test-office-id' },
  })),
}));

// Mock do toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}));

// Mock do serviço
vi.mock('@/services/timesheetService', () => ({
  timesheetService: {
    fetchTimesheets: vi.fn(),
    getActiveTimer: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    pauseTimer: vi.fn(),
    resumeTimer: vi.fn(),
    stopTimer: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useTimesheet Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(timesheetService.getActiveTimer).mockResolvedValue(null);
    vi.mocked(timesheetService.fetchTimesheets).mockResolvedValue([]);
  });

  it('deve inicializar e carregar dados corretamente', async () => {
    const mockData = [{ id: '1', tarefa_descricao: 'Teste', status: 'finalizado' }];
    vi.mocked(timesheetService.fetchTimesheets).mockResolvedValue(mockData as any);

    const { result } = renderHook(() => useTimesheet(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(mockData);
  });

  it('deve iniciar um novo timer com sucesso', async () => {
    const mockNewTimer = { id: '2', tarefa_descricao: 'Nova Tarefa', status: 'ativo' };
    vi.mocked(timesheetService.create).mockResolvedValue(mockNewTimer as any);

    const { result } = renderHook(() => useTimesheet(), { wrapper });

    let started;
    await act(async () => { started = await result.current.startTimer('Nova Tarefa', 'processo'); });

    expect(started).toEqual(mockNewTimer);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Timer iniciado' }));
  });

  it('não deve iniciar timer se já houver um ativo', async () => {
    vi.mocked(timesheetService.getActiveTimer).mockResolvedValue({ id: '1', status: 'ativo' } as any);

    const { result } = renderHook(() => useTimesheet(), { wrapper });

    let started;
    await act(async () => { started = await result.current.startTimer('Tarefa Duplicada', 'reuniao'); });

    expect(started).toBeNull();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: 'Timer já ativo' }));
  });

  it('deve calcular estatísticas do dia corretamente', async () => {
    const mockData = [
      { id: '1', data_inicio: new Date().toISOString(), status: 'finalizado', duracao_minutos: 30 },
      { id: '2', data_inicio: new Date().toISOString(), status: 'finalizado', duracao_minutos: 45 },
      { id: '3', data_inicio: '2020-01-01', status: 'finalizado', duracao_minutos: 100 },
    ];
    vi.mocked(timesheetService.fetchTimesheets).mockResolvedValue(mockData as any);

    const { result } = renderHook(() => useTimesheet(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const stats = result.current.getTodayStats();
    expect(stats.totalMinutos).toBe(75);
    expect(stats.totalRegistros).toBe(2);
  });
});
