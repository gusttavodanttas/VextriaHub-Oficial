// Aviso de atendimentos aguardando baixa (extraído de pages/Atendimentos.tsx):
// contagem, até 5 itens, ações e botão em processamento.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/Auth/PermissionGuard', () => ({ PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import { PendentesBaixa } from '@/components/Atendimentos/PendentesBaixa';
import type { Atendimento } from '@/components/Atendimentos/shared';

const at = (i: number): Atendimento => ({
  id: `a${i}`, tipo_atendimento: 'reuniao', data_atendimento: `2026-10-0${i}T10:00:00`, status: 'agendado',
  office_id: 'o1', user_id: 'u1', deletado: false, clientes: { nome: `Cliente ${i}` },
}) as Atendimento;

describe('PendentesBaixa', () => {
  it('nada a dar baixa: não renderiza', () => {
    const { container } = render(<PendentesBaixa pendentes={[]} extras={[]} loadingId={null} onRealizado={vi.fn()} onCancelado={vi.fn()} onRemarcar={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra a contagem, só os 5 primeiros e o "+ N mais"; ações chamam os callbacks', () => {
    const onRealizado = vi.fn(); const onCancelado = vi.fn(); const onRemarcar = vi.fn();
    render(<PendentesBaixa pendentes={[1, 2, 3, 4, 5, 6, 7].map(at)} extras={[]} loadingId="a2"
      onRealizado={onRealizado} onCancelado={onCancelado} onRemarcar={onRemarcar} />);
    expect(screen.getByText('7 atendimentos aguardando baixa')).toBeInTheDocument();
    expect(screen.getByText(/Cliente 5/)).toBeInTheDocument();
    expect(screen.queryByText(/Cliente 6/)).toBeNull();
    expect(screen.getByText('+ 2 mais')).toBeInTheDocument();
    expect(screen.getByText('01/10/2026 às 10:00')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Realizado/ })[0]);
    expect(onRealizado).toHaveBeenCalledWith('a1');
    fireEvent.click(screen.getAllByRole('button', { name: /Cancelar/ })[0]);
    expect(onCancelado).toHaveBeenCalledWith('a1');
    fireEvent.click(screen.getAllByRole('button', { name: /Remarcar/ })[0]);
    expect(onRemarcar).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
    // item em processamento: Realizado vira spinner (só 4 botões com o texto) e Cancelar fica desabilitado
    expect(screen.getAllByRole('button', { name: /Realizado/ })).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: /Cancelar/ })[1]).toBeDisabled();
  });
});
