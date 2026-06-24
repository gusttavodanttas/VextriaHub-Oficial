import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimesheet } from '@/hooks/useTimesheet';
import { timesheetService } from '@/services/timesheetService';

// Mock do supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
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
  useToast: vi.fn(() => ({
    toast: mockToast,
  })),
}));

// Mock do serviço
vi.mock('@/services/timesheetService', () => ({
  timesheetService: {
    fetchTimesheets: vi.fn(),
    getActiveTimer: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    stopTimer: vi.fn(),
  },
}));

describe('useTimesheet Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve inicializar e carregar dados corretamente', async () => {
    const mockData = [{ id: '1', tarefa_descricao: 'Teste', status: 'finalizado' }];
    vi.mocked(timesheetService.fetchTimesheets).mockResolvedValue(mockData as any);
    vi.mocked(timesheetService.getActiveTimer).mockResolvedValue(null);

    const { result } = renderHook(() => useTimesheet());

    // O useEffect dispara o fetchData
    await act(async () => {
      // Aguarda a promessa do useEffect
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.loading).toBe(false);
  });

  it('deve iniciar um novo timer com sucesso', async () => {
    vi.mocked(timesheetService.getActiveTimer).mockResolvedValue(null);
    const mockNewTimer = { id: '2', tarefa_descricao: 'Nova Tarefa', status: 'ativo' };
    vi.mocked(timesheetService.create).mockResolvedValue(mockNewTimer as any);

    const { result } = renderHook(() => useTimesheet());

    let started;
    await act(async () => {
      started = await result.current.startTimer('Nova Tarefa', 'processo');
    });

    expect(started).toEqual(mockNewTimer);
    expect(result.current.activeTimer).toEqual(mockNewTimer);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Timer iniciado'
    }));
  });

  it('não deve iniciar timer se já houver um ativo', async () => {
    vi.mocked(timesheetService.getActiveTimer).mockResolvedValue({ id: '1', status: 'ativo' } as any);

    const { result } = renderHook(() => useTimesheet());

    let started;
    await act(async () => {
      started = await result.current.startTimer('Tarefa Duplicada', 'reuniao');
    });

    expect(started).toBeNull();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'destructive',
      title: 'Timer já ativo'
    }));
  });

  it('deve calcular estatísticas do dia corretamente', async () => {
    const today = new Date().toDateString();
    const mockData = [
      { id: '1', data_inicio: new Date().toISOString(), status: 'finalizado', duracao_minutos: 30 },
      { id: '2', data_inicio: new Date().toISOString(), status: 'finalizado', duracao_minutos: 45 },
      { id: '3', data_inicio: '2020-01-01', status: 'finalizado', duracao_minutos: 100 }, // Ontem/Outro dia
    ];
    
    vi.mocked(timesheetService.fetchTimesheets).mockResolvedValue(mockData as any);
    
    const { result } = renderHook(() => useTimesheet());
    
    await act(async () => {});

    const stats = result.current.getTodayStats();
    expect(stats.totalMinutos).toBe(75);
    expect(stats.totalRegistros).toBe(2);
  });
});
