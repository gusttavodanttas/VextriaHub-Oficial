// Passos do "Novo Processo" extraídos do diálogo: escolha do método e busca por CNJ.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetodoEntrada } from '@/components/Processos/NovoProcesso/MetodoEntrada';
import { BuscaCnj } from '@/components/Processos/NovoProcesso/BuscaCnj';

describe('MetodoEntrada', () => {
  it('devolve o método escolhido', () => {
    const onEscolher = vi.fn();
    render(<MetodoEntrada onEscolher={onEscolher} />);
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar OAB/ }));
    fireEvent.click(screen.getByRole('button', { name: /Buscar por CNJ/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Manual/ }));
    expect(onEscolher.mock.calls.map((c) => c[0])).toEqual(['oab', 'cnj_search', 'form']);
  });
});

describe('BuscaCnj', () => {
  it('aplica a máscara CNJ ao digitar e só habilita a busca com número suficiente', () => {
    const setCnjInput = vi.fn(); const onBuscar = vi.fn();
    const { rerender } = render(<BuscaCnj cnjInput="" setCnjInput={setCnjInput} isLoading={false} onBuscar={onBuscar} />);
    fireEvent.change(screen.getByPlaceholderText('0000000-00.0000.0.00.0000'), { target: { value: '00012345620268260100' } });
    expect(setCnjInput).toHaveBeenCalledWith('0001234-56.2026.8.26.0100');
    expect(screen.getByRole('button', { name: /Buscar e Avançar/ })).toBeDisabled();
    rerender(<BuscaCnj cnjInput="0001234-56.2026.8.26.0100" setCnjInput={setCnjInput} isLoading={false} onBuscar={onBuscar} />);
    fireEvent.click(screen.getByRole('button', { name: /Buscar e Avançar/ }));
    expect(onBuscar).toHaveBeenCalled();
    rerender(<BuscaCnj cnjInput="0001234-56.2026.8.26.0100" setCnjInput={setCnjInput} isLoading onBuscar={onBuscar} />);
    expect(screen.getByRole('button', { name: /Buscando dados/ })).toBeDisabled();
  });
});
