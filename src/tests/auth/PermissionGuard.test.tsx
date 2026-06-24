import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionGuard } from '../../components/Auth/PermissionGuard';
import { usePermissions } from '../../hooks/usePermissions';

// Mock do hook usePermissions
vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: vi.fn(),
}));

describe('PermissionGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestChild = () => <div data-testid="protected-content">Conteúdo Protegido</div>;

  it('should render children if user has the specific permission', () => {
    (usePermissions as ReturnType<typeof vi.fn>).mockReturnValue({
      canViewDashboard: true,
    });

    render(
      <PermissionGuard permission="canViewDashboard">
        <TestChild />
      </PermissionGuard>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should NOT render children if user lacks the specific permission', () => {
    (usePermissions as ReturnType<typeof vi.fn>).mockReturnValue({
      canViewDashboard: false,
    });

    render(
      <PermissionGuard permission="canViewDashboard">
        <TestChild />
      </PermissionGuard>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should display denied message if showDeniedMessage is true and permission is missing', () => {
    (usePermissions as ReturnType<typeof vi.fn>).mockReturnValue({
      canViewDashboard: false,
    });

    render(
      <PermissionGuard 
        permission="canViewDashboard" 
        showDeniedMessage={true} 
        deniedMessage="Acesso bloqueado"
      >
        <TestChild />
      </PermissionGuard>
    );

    expect(screen.getByText('Acesso bloqueado')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should render fallback if provided and permission is missing', () => {
    (usePermissions as ReturnType<typeof vi.fn>).mockReturnValue({
      canViewDashboard: false,
    });

    render(
      <PermissionGuard 
        permission="canViewDashboard" 
        fallback={<div data-testid="fallback-content">Fallback</div>}
      >
        <TestChild />
      </PermissionGuard>
    );

    expect(screen.getByTestId('fallback-content')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});
