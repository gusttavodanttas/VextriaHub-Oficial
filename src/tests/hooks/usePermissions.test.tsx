// usePermissions: defaults por papel, restrições do plano e overrides por usuário
// (nunca em super/global admin); sem sessão → nada; e-mail super admin sem
// perfil carregado → tudo.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const auth: Record<string, unknown> = {};
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth, SUPER_ADMIN_EMAILS: ['super@vextria.test'] }));
const plan = { hasFinancialModule: true, hasGoalsModule: true };
vi.mock('@/hooks/usePlanFeatures', () => ({ usePlanFeatures: () => plan }));
const ov = { overrides: {} as Record<string, boolean>, loaded: true };
vi.mock('@/hooks/useUserPermissions', () => ({ useMyPermissionOverrides: () => ov }));

import { usePermissions } from '@/hooks/usePermissions';

const base = { user: { id: 'u1', role: 'user' }, isSuperAdmin: false, isAdmin: false, isOfficeAdmin: false, office: { id: 'o1' }, officeUser: null, isLoading: false, session: { user: { email: 'u@x.com' } } };
const render = () => renderHook(() => usePermissions()).result.current;

describe('usePermissions', () => {
  beforeEach(() => { Object.assign(auth, base); plan.hasFinancialModule = true; plan.hasGoalsModule = true; ov.overrides = {}; ov.loaded = true; });

  it('carregando ou sem usuário → nenhuma permissão', () => {
    Object.assign(auth, { isLoading: true });
    expect(Object.values(render()).every((v) => v === false)).toBe(true);
    Object.assign(auth, { isLoading: false, user: null });
    expect(Object.values(render()).every((v) => v === false)).toBe(true);
  });

  it('sem perfil mas com e-mail de super admin na sessão → acesso total', () => {
    Object.assign(auth, { user: null, session: { user: { email: '  SUPER@vextria.test ' } } });
    expect(Object.values(render()).every((v) => v === true)).toBe(true);
  });

  it('usuário comum: sem excluir/gerenciar, sem escritório/admin; CRM só leitura', () => {
    const p = render();
    expect(p).toMatchObject({ canViewClients: true, canCreateClients: true, canDeleteClients: false, canDeleteProcesses: false, canViewCRM: true, canManageCRM: false, canManageTimesheet: true, canViewOffice: false, canInviteUsers: false, canViewAdmin: false, canManageMetas: false });
  });

  it('office admin gerencia o escritório mas não o sistema; admin global vê admin; super admin tudo', () => {
    Object.assign(auth, { isOfficeAdmin: true });
    expect(render()).toMatchObject({ canDeleteProcesses: true, canManageOffice: true, canInviteUsers: true, canViewAdmin: false, canManageAllOffices: false });
    Object.assign(auth, { isOfficeAdmin: false, isAdmin: true });
    expect(render()).toMatchObject({ canViewAdmin: true, canManageGlobalSettings: false, canManageSubscriptions: false });
    Object.assign(auth, { isAdmin: false, isSuperAdmin: true });
    expect(render()).toMatchObject({ canManageGlobalSettings: true, canManageSubscriptions: true, canManageSystemUsers: true });
  });

  it('plano sem financeiro/metas apaga essas permissões mesmo para admin; CRM fica', () => {
    Object.assign(auth, { isOfficeAdmin: true });
    plan.hasFinancialModule = false; plan.hasGoalsModule = false;
    expect(render()).toMatchObject({ canViewFinanceiro: false, canManageFinanceiro: false, canViewMetas: false, canManageMetas: false, canViewCRM: true, canManageEquipe: true });
  });

  it('overrides por usuário aplicam só chaves conhecidas, depois do plano, e nunca em super/global admin', () => {
    ov.overrides = { canDeleteClients: true, canViewMetas: true, canViewCRM: false, inexistente: true };
    plan.hasGoalsModule = false;
    const p = render();
    expect(p).toMatchObject({ canDeleteClients: true, canViewMetas: true, canViewCRM: false });
    expect('inexistente' in p).toBe(false);

    ov.loaded = false;
    expect(render()).toMatchObject({ canDeleteClients: false, canViewCRM: true });

    ov.loaded = true;
    Object.assign(auth, { isAdmin: true });
    expect(render()).toMatchObject({ canViewCRM: true });
    Object.assign(auth, { isAdmin: false, isSuperAdmin: true });
    expect(render()).toMatchObject({ canViewCRM: true });
  });
});
