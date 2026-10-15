// Linha de lead do CRM (extraída de pages/Crm.tsx): contato, valor estimado,
// follow-up atrasado, WhatsApp, temperatura editável só com permissão.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrmLeadRow } from '@/components/Crm/CrmLeadRow';
import { calcularKpisCrm } from '@/components/Crm/crmKpis';
import type { ClienteComProcessos } from '@/types/database';

const lead = (over: Partial<ClienteComProcessos> = {}): ClienteComProcessos => ({
  id: 'c1', nome: 'Maria Souza', email: 'maria@x.com', telefone: '11999998888', status: 'quente', valor_estimado: 15000,
  proximo_contato: '2026-01-01', created_at: '2026-03-10T00:00:00Z', office_id: 'o1', ...over,
}) as ClienteComProcessos;
const acoes = () => ({ onFollowup: vi.fn(), onStatusChange: vi.fn(), onDetalhes: vi.fn() });

describe('CrmLeadRow', () => {
  it('mostra contato, valor, follow-up atrasado e link do WhatsApp; detalhes chama o callback', () => {
    const a = acoes();
    render(<CrmLeadRow lead={lead()} canManageCRM hojeStr="2026-10-15" {...a} />);
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('maria@x.com')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?15\.000/)).toBeInTheDocument();
    const fu = screen.getByTitle('Próximo contato (follow-up)') as HTMLInputElement;
    expect(fu.value).toBe('2026-01-01');
    expect(fu.className).toContain('border-rose-500/50');
    expect(screen.getByTitle('WhatsApp')).toHaveAttribute('href', 'https://wa.me/5511999998888');
    expect(screen.getByTitle('Mudar temperatura')).toBeInTheDocument();
    fireEvent.change(fu, { target: { value: '2026-12-01' } });
    expect(a.onFollowup).toHaveBeenCalledWith('c1', '2026-12-01');
    fireEvent.click(screen.getByRole('button', { name: 'Detalhes' }));
    expect(a.onDetalhes).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
  });

  it('sem permissão: temperatura vira badge estática e o follow-up fica desabilitado', () => {
    render(<CrmLeadRow lead={lead({ proximo_contato: null, valor_estimado: null })} canManageCRM={false} hojeStr="2026-10-15" {...acoes()} />);
    expect(screen.queryByTitle('Mudar temperatura')).toBeNull();
    expect(screen.getByText('quente')).toBeInTheDocument();
    expect(screen.getByTitle('Próximo contato (follow-up)')).toBeDisabled();
    expect(screen.queryByText(/R\$/)).toBeNull();
  });
});

describe('calcularKpisCrm', () => {
  it('taxa de conversão e valor ganho usam o resumo do servidor; pipeline soma os leads', () => {
    const leads = [lead({ id: '1', status: 'quente', valor_estimado: 100 }), lead({ id: '2', status: 'frio', valor_estimado: 50 }), lead({ id: '3', status: 'lead', valor_estimado: null })];
    const convertidos = [lead({ id: '4', status: 'convertido', valor_estimado: 999 })];
    const k = calcularKpisCrm(leads, convertidos, { total: 7, valorGanho: 5000 });
    expect(k).toMatchObject({ hotLeadsCount: 1, conversionRate: 70, pipelineValue: 150, valorGanho: 5000, totalConvertidos: 7 });
    // sem resumo: cai na página carregada
    expect(calcularKpisCrm(leads, convertidos, null)).toMatchObject({ conversionRate: 25, valorGanho: 999, totalConvertidos: 1 });
    expect(calcularKpisCrm([], [], null).conversionRate).toBe(0);
  });
});
