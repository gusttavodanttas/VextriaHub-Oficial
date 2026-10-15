// Cartão da grade de publicações (extraído de pages/Publicacoes.tsx): badges de status
// e vínculo, ações condicionadas (Tratar só em nova, Processo só com onRegister e sem vínculo).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/components/Auth/PermissionGuard', () => ({ PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import { PublicationCard } from '@/components/Publications/PublicationCard';
import type { Publication } from '@/hooks/usePublicacoes';

const pub = (over: Partial<Publication> = {}) => ({
  id: 'p1', titulo: 'Intimação para audiência', numero_processo: '00012345620268260100', tribunal: 'TJSP',
  data_publicacao: '2026-10-10', conteudo: 'Fica intimada a parte…', status: 'nova', urgencia: 'alta', processo_id: null,
  ...over,
} as unknown as Publication);
const acoes = () => ({ onOpen: vi.fn(), onToggleSelection: vi.fn(), onUpdateStatus: vi.fn(), onSchedule: vi.fn(), onArchive: vi.fn() });

describe('PublicationCard', () => {
  it('nova, urgente e avulsa: mostra badges e as ações Tratar/Processo', () => {
    const a = acoes(); const onRegister = vi.fn();
    render(<PublicationCard publication={pub()} selected={false} onRegister={onRegister} {...a} />);
    expect(screen.getByText('Nova')).toBeInTheDocument();
    expect(screen.getByText('Urgente')).toBeInTheDocument();
    expect(screen.getByText('Avulsa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tratar/ }));
    expect(a.onUpdateStatus).toHaveBeenCalledWith('p1', 'lida');
    fireEvent.click(screen.getByRole('button', { name: /Processo/ }));
    expect(onRegister).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
    fireEvent.click(screen.getByText('Intimação para audiência'));
    expect(a.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
  });

  it('tratada e vinculada: sem Tratar; sem onRegister não há botão Processo', () => {
    const a = acoes();
    render(<PublicationCard publication={pub({ status: 'lida', processo_id: 'pr1', urgencia: 'media' })} selected {...a} />);
    expect(screen.getByText('Tratada')).toBeInTheDocument();
    expect(screen.getByText('Vinculada')).toBeInTheDocument();
    expect(screen.queryByText('Urgente')).toBeNull();
    expect(screen.queryByRole('button', { name: /Tratar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Processo/ })).toBeNull();
  });
});
