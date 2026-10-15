// Card de membro da Equipe (extraído de pages/Equipe.tsx): identificação, badge
// "Você", atalhos só para quem gerencia (e nunca sobre si mesmo), remoção confirmada.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MembroCard } from '@/components/Equipe/MembroCard';
import type { MembroEquipe } from '@/components/Equipe/membros';

const membro = (over: Partial<MembroEquipe> = {}): MembroEquipe =>
  ({ id: 'ou1', user_id: 'u1', role: 'admin', joined_at: '2026-01-15T00:00:00Z', profile: { full_name: 'Ana Lima', email: 'ana@x.com' }, ...over }) as MembroEquipe;
const acoes = () => ({ onPermissoes: vi.fn(), onFuncao: vi.fn(), onRemover: vi.fn() });

describe('MembroCard', () => {
  it('mostra iniciais, e-mail, data de entrada e função', () => {
    render(<MembroCard membro={membro()} isMe={false} canManage={false} {...acoes()} />);
    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(screen.getByText('ana@x.com')).toBeInTheDocument();
    expect(screen.getByText('Desde 15/01/2026')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.queryByText('Você')).toBeNull();
    expect(screen.queryByRole('button', { name: /Permissões/ })).toBeNull();
  });

  it('o próprio usuário vê "Você" e não tem atalhos mesmo sendo admin', () => {
    render(<MembroCard membro={membro()} isMe canManage {...acoes()} />);
    expect(screen.getByText('Você')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Função/ })).toBeNull();
  });

  it('quem gerencia tem permissões/função e remoção com confirmação', () => {
    const a = acoes();
    render(<MembroCard membro={membro()} isMe={false} canManage {...a} />);
    fireEvent.click(screen.getByRole('button', { name: /Permissões/ }));
    expect(a.onPermissoes).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1' }));
    fireEvent.click(screen.getByRole('button', { name: /Função/ }));
    expect(a.onFuncao).toHaveBeenCalledWith(expect.objectContaining({ id: 'ou1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover Ana Lima' }));
    expect(screen.getByText('Remover Ana Lima?')).toBeInTheDocument();
    expect(a.onRemover).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(a.onRemover).toHaveBeenCalledWith(expect.objectContaining({ id: 'ou1' }));
  });
});
