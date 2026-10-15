// Card da integração Notion (Config → Integração).
// Travam: estado "Premium" quando o plano não permite; interruptor Ligado/Desligado
// que avisa quando a RLS barra o UPDATE em silêncio (0 linhas); e que só admin
// vê os botões de conectar/desconectar.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: vi.fn(() => ({ toast: mockToast })) }));
vi.mock('@/lib/monitoring', () => ({ captureError: vi.fn() }));
vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: { ...mockSupabase, functions: { invoke: vi.fn(async () => ({ data: null, error: null })) } } };
});

import { mockSupabase, enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';
import { NotionCard } from '@/components/Integrations/NotionCard';

const base = {
  office_id: 'off-1', permitido: true, ligado: true, status: 'conectado', workspace_name: 'Escritório X',
  last_sync_at: null, last_error: null, pode_gerenciar: true, pendentes: 0,
};

function statusRpc(row: Record<string, unknown> | null) {
  mockSupabase.rpc.mockImplementation((async (fn: string) =>
    fn === 'notion_status' ? { data: row ? [row] : [], error: null } : { data: null, error: null }) as never);
}

describe('NotionCard', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); mockSupabase.rpc.mockReset(); });

  it('mostra o selo Premium e esconde "Conectar" quando o plano não inclui Notion', async () => {
    statusRpc({ ...base, permitido: false, status: 'desconectado', ligado: false });
    render(<NotionCard />);
    expect(await screen.findByText('Premium')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conectar' })).not.toBeInTheDocument();
  });

  it('admin sem conexão vê "Conectar"; usuário comum não', async () => {
    statusRpc({ ...base, status: 'desconectado', ligado: false });
    const { unmount } = render(<NotionCard />);
    expect(await screen.findByRole('button', { name: 'Conectar' })).toBeInTheDocument();
    unmount();

    statusRpc({ ...base, status: 'desconectado', ligado: false, pode_gerenciar: false });
    render(<NotionCard />);
    expect(await screen.findByText(/Só o administrador do escritório/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conectar' })).not.toBeInTheDocument();
  });

  it('desligar barrado pela RLS (0 linhas) avisa erro em vez de sucesso', async () => {
    statusRpc(base);
    enfileirar('office_integrations', { data: [] });
    render(<NotionCard />);
    const sw = await screen.findByRole('switch', { name: /Ligar ou desligar/ });
    fireEvent.click(sw);
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatchObject({ variant: 'destructive' });
    expect(chamadasCom('office_integrations', 'update')).toHaveLength(1);
  });

  it('desligar com sucesso confirma no toast', async () => {
    statusRpc(base);
    enfileirar('office_integrations', { data: [{ id: 'i1' }] });
    render(<NotionCard />);
    fireEvent.click(await screen.findByRole('switch', { name: /Ligar ou desligar/ }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ title: 'Sincronização com o Notion desligada' }));
  });
});
