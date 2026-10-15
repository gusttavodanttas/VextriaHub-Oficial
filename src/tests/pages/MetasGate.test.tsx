// Rota /metas: plano sem o módulo mostra o upsell (com CTA só para quem pode
// assinar); plano com o módulo renderiza a página normal.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const real = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...real, useNavigate: () => mockNavigate };
});
vi.mock('@/hooks/usePlanFeatures', () => ({ usePlanFeatures: vi.fn() }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/pages/Metas', () => ({ default: () => <div data-testid="metas-page">Metas reais</div> }));

import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import MetasGate from '@/components/Goals/MetasGate';

const plan = usePlanFeatures as unknown as ReturnType<typeof vi.fn>;
const perms = usePermissions as unknown as ReturnType<typeof vi.fn>;
const auth = useAuth as unknown as ReturnType<typeof vi.fn>;

const renderGate = () => render(<MemoryRouter><MetasGate /></MemoryRouter>);

describe('MetasGate', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    auth.mockReturnValue({ isOfficeAdmin: false });
  });

  it('plano com o módulo renderiza a página de Metas', () => {
    plan.mockReturnValue({ hasGoalsModule: true });
    perms.mockReturnValue({ canViewMetas: true, canManageOffice: true });
    renderGate();
    expect(screen.getByTestId('metas-page')).toBeInTheDocument();
    expect(screen.queryByText(/Módulo Premium/i)).not.toBeInTheDocument();
  });

  it('plano sem o módulo: admin vê o upsell com botão que leva ao Premium', () => {
    plan.mockReturnValue({ hasGoalsModule: false });
    perms.mockReturnValue({ canViewMetas: false, canManageOffice: true });
    renderGate();
    expect(screen.queryByTestId('metas-page')).not.toBeInTheDocument();
    expect(screen.getByText(/Metas faz parte do plano Premium/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver o plano Premium/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/pagamento?plano=premium');
  });

  it('plano sem o módulo: membro comum vê o upsell sem botão, com orientação', () => {
    plan.mockReturnValue({ hasGoalsModule: false });
    perms.mockReturnValue({ canViewMetas: false, canManageOffice: false });
    renderGate();
    expect(screen.queryByRole('button', { name: /Ver o plano Premium/i })).not.toBeInTheDocument();
    expect(screen.getByText(/peça ao administrador do escritório/i)).toBeInTheDocument();
  });
});
