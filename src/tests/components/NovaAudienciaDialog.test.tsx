// Testes de fluxo do modal de audiência.
// Travam os bugs que chegaram em produção:
//  - "Editar Audiência" abrindo com TODOS os campos em branco
//  - status legado masculino ("agendado") deixando o select de Status vazio
//  - data inválida abortando o preenchimento do restante do form
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1', office_id: 'office-1' } })),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}));

// Stubs leves: evitam fetch do supabase e Radix pesado dentro do modal
vi.mock('@/components/Clientes/ClientSelect', () => ({
  ClientSelect: ({ value }: any) => <div data-testid="client-select">{value || 'sem-cliente'}</div>,
}));
vi.mock('@/components/Notifications/AvisoDiasSelect', () => ({
  AvisoDiasSelect: () => <div data-testid="aviso-dias" />,
}));

import { NovaAudienciaDialog } from '@/components/Audiencias/NovaAudienciaDialog';

const processos = [{ id: 'p1', label: 'NADIA x UOL · 0707058-18.2026.8.07.0006', cliente_id: 'cli-9' }];

const audienciaConciliacao = {
  id: 'a1',
  titulo: 'Conciliação',
  tipo: 'Conciliação',
  data_audiencia: '2026-08-03T14:00:00',
  local: 'Sala 31 — CEJUSC',
  status: 'agendado', // legado MASCULINO de propósito
  observacoes: 'Levar documentos',
  cliente_id: null,   // sem cliente → deve derivar do processo
  processo_id: 'p1',
} as any;

function renderDialog(audiencia: any) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const utils = render(
    <NovaAudienciaDialog
      open
      onOpenChange={() => {}}
      tipos={['Conciliação', 'Instrução']}
      membros={[]}
      processos={processos}
      existentes={[]}
      audiencia={audiencia}
      onSubmit={onSubmit}
    />
  );
  return { onSubmit, ...utils };
}

describe('NovaAudienciaDialog — edição', () => {
  beforeEach(() => mockToast.mockClear());

  it('abre PREENCHIDO ao editar (título, data, hora, local, observações)', () => {
    renderDialog(audienciaConciliacao);

    expect(screen.getByText('Editar Audiência')).toBeInTheDocument();
    expect(screen.getByLabelText(/Título/i)).toHaveValue('Conciliação');
    expect(screen.getByLabelText(/Data/i)).toHaveValue('2026-08-03');
    expect(screen.getByLabelText(/Horário/i)).toHaveValue('14:00');
    expect(screen.getByLabelText(/Local/i)).toHaveValue('Sala 31 — CEJUSC');
    expect(screen.getByLabelText(/Observações/i)).toHaveValue('Levar documentos');
  });

  it('deriva o cliente do processo vinculado quando a audiência não tem cliente', () => {
    renderDialog(audienciaConciliacao);
    expect(screen.getByTestId('client-select')).toHaveTextContent('cli-9');
  });

  it('normaliza status legado masculino e SALVA no feminino', () => {
    const { onSubmit } = renderDialog(audienciaConciliacao);

    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [input, id] = onSubmit.mock.calls[0];
    expect(id).toBe('a1');
    expect(input.status).toBe('agendada'); // nunca devolve "agendado"
    expect(input.titulo).toBe('Conciliação');
    expect(input.processo_id).toBe('p1');
  });

  it('data inválida NÃO derruba o preenchimento do resto (bug do form em branco)', () => {
    renderDialog({ ...audienciaConciliacao, data_audiencia: 'data-podre' });

    // O título continua preenchido — antes a exceção do format() zerava tudo
    expect(screen.getByLabelText(/Título/i)).toHaveValue('Conciliação');
    expect(screen.getByLabelText(/Data/i)).toHaveValue('');
  });

  it('modo criação abre limpo como "Nova Audiência"', () => {
    renderDialog(null);
    expect(screen.getByText('Nova Audiência')).toBeInTheDocument();
    expect(screen.getByLabelText(/Título/i)).toHaveValue('');
  });

  it('guard do zod bloqueia submit sem TIPO (campo fora do required nativo)', () => {
    const { onSubmit } = renderDialog(null);

    fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: 'Instrução' } });
    fireEvent.change(screen.getByLabelText(/Data/i), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText(/Horário/i), { target: { value: '10:00' } });
    // tipo fica vazio de propósito — só o schema pega isso
    fireEvent.click(screen.getByRole('button', { name: /Criar Audiência/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });
});
