// useUserRole: derivados de papel alinhados com FeaturePermissions.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const auth: Record<string, unknown> = {};
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { useUserRole } from '@/hooks/useUserRole';

const base = { user: { role: 'user' }, isSuperAdmin: false, isAdmin: false, isOfficeAdmin: false, isFirstLogin: false, office: { id: 'o1' }, officeUser: null, isLoading: false };

describe('useUserRole', () => {
  beforeEach(() => { Object.assign(auth, base); });

  it('usuário comum: sem gestão, com escritório', () => {
    const r = renderHook(() => useUserRole()).result.current;
    expect(r).toMatchObject({ isNormalUser: true, canManageOffice: false, canManageUsers: false, canViewAdminFeatures: false, hasOffice: true, needsOfficeSetup: false, shouldShowExampleData: true, shouldShowEmptyState: false });
  });

  it('admin global sem office_role ainda gerencia o escritório; super admin tudo', () => {
    Object.assign(auth, { user: { role: 'admin' }, isAdmin: true });
    let r = renderHook(() => useUserRole()).result.current;
    expect(r).toMatchObject({ canManageOffice: true, canManageUsers: true, canInviteUsers: true, canViewAdminFeatures: true, canManageSubscriptions: false, canCreateOffices: false, isNormalUser: false });

    Object.assign(auth, { user: { role: 'super_admin' }, isAdmin: false, isSuperAdmin: true, office: null, isFirstLogin: true });
    r = renderHook(() => useUserRole()).result.current;
    expect(r).toMatchObject({ canManageSubscriptions: true, canViewAllOffices: true, canCreateOffices: true, needsOfficeSetup: false, shouldShowExampleData: true, shouldShowEmptyState: false });
  });

  it('admin de escritório gerencia; primeiro login sem escritório pede setup e estado vazio', () => {
    Object.assign(auth, { isOfficeAdmin: true });
    expect(renderHook(() => useUserRole()).result.current).toMatchObject({ canManageOffice: true, isNormalUser: false, canManageSubscriptions: false });
    Object.assign(auth, { isOfficeAdmin: false, office: null, isFirstLogin: true });
    expect(renderHook(() => useUserRole()).result.current).toMatchObject({ needsOfficeSetup: true, hasOffice: false, shouldShowEmptyState: true, shouldShowExampleData: false });
  });
});
