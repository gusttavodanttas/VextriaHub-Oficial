// Testes de fluxo do cadastro de cliente.
// Travam: validação de CPF/CNPJ (agora via schema zod) e o prefill do nome
// vindo da busca (bug: "o cliente não puxa o nome que digitei").
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}));

// Evita supabase: lista de origens vem do hook de settings
vi.mock('@/hooks/useOfficeSettingList', () => ({
  useOfficeSettingList: vi.fn(() => ({ items: ['Indicação', 'Site'] })),
}));

import { NovoClienteDialog } from '@/components/Clientes/NovoClienteDialog';

function renderDialog(props: Partial<React.ComponentProps<typeof NovoClienteDialog>> = {}) {
  const onSave = vi.fn().mockResolvedValue(true);
  const onOpenChange = vi.fn();
  const utils = render(
    <NovoClienteDialog open onOpenChange={onOpenChange} onSave={onSave} {...props} />
  );
  return { onSave, onOpenChange, ...utils };
}

describe('NovoClienteDialog — validação e prefill', () => {
  beforeEach(() => mockToast.mockClear());

  it('pré-preenche o nome vindo da busca (initialName)', () => {
    renderDialog({ initialName: 'Daniel Guirra Angelo' });
    expect(screen.getByPlaceholderText('Nome do cliente')).toHaveValue('Daniel Guirra Angelo');
  });

  it('bloqueia CPF inválido com a mensagem certa e NÃO salva', async () => {
    const { onSave } = renderDialog();

    fireEvent.change(screen.getByPlaceholderText('Nome do cliente'), { target: { value: 'Maria da Silva' } });
    fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), { target: { value: '111.111.111-11' } });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar Cliente/i }));

    expect(await screen.findByText('CPF inválido.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('exige o CPF quando vazio', async () => {
    const { onSave } = renderDialog();
    fireEvent.change(screen.getByPlaceholderText('Nome do cliente'), { target: { value: 'Maria da Silva' } });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar Cliente/i }));
    expect(await screen.findByText('CPF é obrigatório.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('salva com CPF válido e fecha o dialog', async () => {
    const { onSave, onOpenChange } = renderDialog();

    fireEvent.change(screen.getByPlaceholderText('Nome do cliente'), { target: { value: 'Maria da Silva' } });
    fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), { target: { value: '529.982.247-25' } });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar Cliente/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const cliente = onSave.mock.calls[0][0];
    expect(cliente.name).toBe('Maria da Silva');
    expect(cliente.cpfCnpj).toBe('529.982.247-25');
    expect(cliente.origem).toBe('Não informado'); // default quando não escolhida
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('mantém o modal aberto quando onSave retorna false (ex.: duplicado)', async () => {
    const { onSave, onOpenChange } = renderDialog();
    onSave.mockResolvedValue(false);

    fireEvent.change(screen.getByPlaceholderText('Nome do cliente'), { target: { value: 'Maria da Silva' } });
    fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), { target: { value: '529.982.247-25' } });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar Cliente/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
