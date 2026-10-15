// Linha de prazo (extraída de pages/Prazos.tsx): badges (prioridade, sem responsável,
// sugestão do robô, possível audiência), teor recolhível, atalhos com gate de permissão.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});

import { PrazoItem } from '@/components/Prazos/PrazoItem';
import type { Prazo } from '@/components/Prazos/shared';

const prazo = (over: Partial<Prazo> = {}): Prazo => ({
  id: 'pz1', titulo: 'Contestação', prioridade: 'alta', status: 'pendente', user_id: 'u1',
  data_fim_prazo: '2099-01-10', responsavel_id: null, publicacao_id: 'pub1', confirmado_em: null,
  numero_processo: '00012345620268260100', ...over,
});
const acoes = () => ({
  onToggleSelect: vi.fn(), onToggleTeor: vi.fn(), onAgendar: vi.fn(), onConcluir: vi.fn(), onReabrir: vi.fn(),
  onAceitar: vi.fn(), onEditar: vi.fn(), onExcluir: vi.fn(), navigate: vi.fn(),
});
const base = { urgency: 'normal' as const, selected: false, membroMap: {}, teorAberto: false, concluindo: false, reabrindo: false, aceitando: false };

describe('PrazoItem', () => {
  it('sugestão do robô sem responsável com teor de audiência: badges e atalhos', () => {
    const a = acoes();
    const teor = 'Fica designada audiência de instrução para o dia 10. '.repeat(5);
    render(<PrazoItem {...base} {...a} prazo={prazo()} canManagePrazos titulo="Contestação" teor={teor} clienteNome="Maria" processo={null} />);
    expect(screen.getByText('Contestação')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('Sem responsável')).toBeInTheDocument();
    expect(screen.getByText('Sugestão do robô')).toBeInTheDocument();
    expect(screen.getByText('Possível audiência')).toBeInTheDocument();
    expect(screen.getByText('Maria')).toBeInTheDocument();
    // teor longo → botão de expandir
    fireEvent.click(screen.getByRole('button', { name: 'Ver teor completo' }));
    expect(a.onToggleTeor).toHaveBeenCalled();
    fireEvent.click(screen.getByTitle('Agendar audiência a partir deste prazo'));
    expect(a.onAgendar).toHaveBeenCalledWith(expect.objectContaining({ id: 'pz1' }), 'audiencia');
    fireEvent.click(screen.getByTitle('Marcar como concluído'));
    expect(a.onConcluir).toHaveBeenCalledWith('pz1');
    // CNJ sem processo cadastrado: texto, não link
    expect(screen.getByTitle('Processo ainda não cadastrado')).toBeInTheDocument();
  });

  it('sem permissão não mostra atalhos; concluído mostra "Reabrir" só com permissão', () => {
    const a = acoes();
    const { rerender } = render(<PrazoItem {...base} {...a} prazo={prazo()} canManagePrazos={false} titulo="Contestação" processo={null} />);
    expect(screen.queryByTitle('Marcar como concluído')).toBeNull();
    rerender(<PrazoItem {...base} {...a} prazo={prazo({ status: 'concluido', concluido_em: '2026-10-01T10:00:00Z', concluido_por: 'u2' })} canManagePrazos
      titulo="Contestação" processo={{ id: 'pr1', clienteId: null, clienteNome: null, numero: '00012345620268260100' }} membroMap={{ u2: 'Ana' }} />);
    expect(screen.getByText(/Concluído por Ana/)).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Reabrir prazo'));
    expect(a.onReabrir).toHaveBeenCalledWith('pz1');
    // processo cadastrado → link para o processo
    fireEvent.click(screen.getByTitle('Abrir processo'));
    expect(a.navigate).toHaveBeenCalledWith('/processos?openId=pr1');
  });
});
