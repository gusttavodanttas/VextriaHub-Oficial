// Aba Priorização (extraída de pages/Financeiro.tsx): um cartão por grupo configurado
// + "Sem Classificação", soma do saldo em aberto, badges de vencido/parcial.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/components/Auth/PermissionGuard', () => ({ PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import { PriorizacaoTab } from '@/components/Financeiro/PriorizacaoTab';
import { agruparPendentesPorGrupo } from '@/components/Financeiro/calculos';
import type { FinanceiroItem } from '@/components/Financeiro/shared';

const item = (over: Partial<FinanceiroItem>): FinanceiroItem => ({
  id: 'x', tipo: 'despesa', descricao: 'Aluguel', valor: 1000, data_vencimento: '2026-03-10', data_pagamento: null,
  status: 'pendente', categoria: null, cliente_id: null, processo_id: null, user_id: 'u1', office_id: 'o1', deletado: false,
  escopo: 'pj', ...over,
});
const grupos = [{ id: 'g1', label: 'G1 · Essencial' }, { id: 'g2', label: 'G2 · Importante' }];
const acoes = () => ({ onNovaDespesa: vi.fn(), onPrioridadeChange: vi.fn(), onRegistrarPagamento: vi.fn() });

describe('PriorizacaoTab', () => {
  it('vazio: estado vazio com atalho de nova despesa', () => {
    const a = acoes();
    render(<PriorizacaoTab loading={false} pendentesPagar={[]} pendentesPorGrupo={{}} gruposPrioridade={grupos} loadingId={null} {...a} />);
    expect(screen.getByText('Nenhuma despesa pendente para priorizar')).toBeInTheDocument();
  });

  it('um cartão por grupo + sem classificação, com soma do saldo em aberto e badges', () => {
    const pendentes = [
      item({ id: '1', prioridade: 'g1', status: 'vencido', valor: 300 }),
      item({ id: '2', prioridade: 'g1', status: 'parcial', valor: 200, valor_pago: 50, descricao: 'Internet' }),
      item({ id: '3', prioridade: null, valor: 10, descricao: 'Café' }),
    ];
    render(<PriorizacaoTab loading={false} pendentesPagar={pendentes} pendentesPorGrupo={agruparPendentesPorGrupo(pendentes, grupos)}
      gruposPrioridade={grupos} loadingId={null} {...acoes()} />);
    // o rótulo do grupo também aparece no select de cada item — o título do cartão é o <p>
    const titulos = Array.from(document.querySelectorAll('p.text-xs.font-black')).map((p) => p.textContent);
    expect(titulos).toEqual(['G1 · Essencial', 'G2 · Importante', 'Sem Classificação']);
    // G1: 300 + (200 - 50) = 450 em aberto, 2 contas
    expect(screen.getByText(/R\$\s?450,00 · 2 contas/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?10,00 · 1 conta$/)).toBeInTheDocument();
    expect(screen.getByText('Vazio.')).toBeInTheDocument();
    expect(screen.getByText('Vencido')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?50,00 de R\$\s?200,00/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Pagar/ })).toHaveLength(3);
  });

  it('botão Pagar fica desabilitado para o item em processamento', () => {
    const pendentes = [item({ id: '1', prioridade: 'g1' })];
    render(<PriorizacaoTab loading={false} pendentesPagar={pendentes} pendentesPorGrupo={agruparPendentesPorGrupo(pendentes, grupos)}
      gruposPrioridade={grupos} loadingId="1" {...acoes()} />);
    const botoes = screen.getAllByRole('button').filter((b) => b.className.includes('bg-emerald-500'));
    expect(botoes).toHaveLength(1);
    expect(botoes[0]).toBeDisabled();
  });
});
