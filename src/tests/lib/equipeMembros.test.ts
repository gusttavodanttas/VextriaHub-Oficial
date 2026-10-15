// Validação de convite (extraída de pages/Equipe.tsx): formato, convite pendente
// duplicado e e-mail que já é membro.
import { describe, it, expect } from 'vitest';
import { validarConvite, nomeDoMembro, type MembroEquipe } from '@/components/Equipe/membros';

const membro = (over: Partial<MembroEquipe> = {}): MembroEquipe =>
  ({ id: 'ou1', user_id: 'u1', role: 'user', profile: { full_name: 'Ana Lima', email: 'ana@x.com' }, ...over }) as MembroEquipe;

describe('validarConvite', () => {
  const convites = [{ status: 'pending' as const, email: 'Pendente@x.com' }, { status: 'accepted' as const, email: 'aceito@x.com' }];
  const membros = [membro()];

  it('recusa formato inválido', () => {
    expect(validarConvite('sem-arroba', convites, membros)?.title).toBe('E-mail inválido');
    expect(validarConvite('a@b', convites, membros)?.title).toBe('E-mail inválido');
  });

  it('recusa convite pendente duplicado (sem diferenciar maiúsculas) e e-mail que já é membro', () => {
    expect(validarConvite('pendente@X.com', convites, membros)?.title).toBe('Convite já existe');
    expect(validarConvite('ANA@x.com', convites, membros)?.title).toBe('Já é membro');
  });

  it('aceita e-mail novo, inclusive o de um convite já aceito', () => {
    expect(validarConvite('novo@x.com', convites, membros)).toBeNull();
    expect(validarConvite('aceito@x.com', convites, membros)).toBeNull();
  });
});

describe('nomeDoMembro', () => {
  it('nome > e-mail > "Membro"', () => {
    expect(nomeDoMembro(membro())).toBe('Ana Lima');
    expect(nomeDoMembro(membro({ profile: { full_name: null, email: 'ana@x.com' } }))).toBe('ana@x.com');
    expect(nomeDoMembro(membro({ profile: null }))).toBe('Membro');
  });
});
