// useOpenItemFromSearch: ?openId= rola/destaca o item, tenta de novo até ~4s
// enquanto a lista carrega e limpa o parâmetro ao tratar ou esgotar.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useOpenItemFromSearch } from '@/hooks/useOpenItemFromSearch';

const wrapperEm = (url: string) => ({ children }: { children: React.ReactNode }) =>
  React.createElement(MemoryRouter, { initialEntries: [url] }, children);

function montar(url: string, ready: boolean, onFound?: (id: string) => boolean | void) {
  return renderHook(({ r }) => { useOpenItemFromSearch('/tarefas', r, onFound); return useLocation(); }, { wrapper: wrapperEm(url), initialProps: { r: ready } });
}

describe('useOpenItemFromSearch', () => {
  beforeEach(() => { vi.useFakeTimers(); document.body.innerHTML = ''; });
  afterEach(() => { vi.useRealTimers(); });

  it('com o elemento na tela: rola, destaca e limpa o parâmetro', () => {
    const el = document.createElement('div'); el.id = 'item-42'; el.scrollIntoView = vi.fn(); document.body.appendChild(el);
    const { result } = montar('/tarefas?openId=42', true);
    expect(result.current.search).toBe('?openId=42');
    act(() => { vi.advanceTimersByTime(250); });
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(el.classList.contains('search-highlight')).toBe(true);
    expect(result.current.pathname).toBe('/tarefas');
    expect(result.current.search).toBe('');
    act(() => { vi.advanceTimersByTime(2400); });
    expect(el.classList.contains('search-highlight')).toBe(false);
  });

  it('callback decide: tenta de novo a cada 300ms até retornar true, sempre com a versão mais recente', () => {
    let tratado = false;
    const onFound = vi.fn((_id: string) => tratado);
    const { result } = montar('/tarefas?openId=7', true, (id) => onFound(id));
    act(() => { vi.advanceTimersByTime(250); });
    expect(onFound).toHaveBeenCalledWith('7');
    expect(result.current.search).toBe('?openId=7');
    act(() => { vi.advanceTimersByTime(600); });
    expect(onFound).toHaveBeenCalledTimes(3);
    tratado = true;
    act(() => { vi.advanceTimersByTime(300); });
    expect(onFound).toHaveBeenCalledTimes(4);
    expect(result.current.search).toBe('');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(onFound).toHaveBeenCalledTimes(4);
  });

  it('não tratado: desiste após 14 tentativas e limpa; só começa quando ready', () => {
    const onFound = vi.fn(() => false);
    const { result, rerender } = montar('/tarefas?openId=1', false, onFound);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onFound).not.toHaveBeenCalled();
    rerender({ r: true });
    act(() => { vi.advanceTimersByTime(250 + 300 * 13); });
    expect(onFound).toHaveBeenCalledTimes(14);
    expect(result.current.search).toBe('');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(onFound).toHaveBeenCalledTimes(14);
  });

  it('sem openId não faz nada', () => {
    const onFound = vi.fn(() => true);
    const { result } = montar('/tarefas?x=1', true, onFound);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onFound).not.toHaveBeenCalled();
    expect(result.current.search).toBe('?x=1');
  });
});
