// useMultiSelect: contagem sempre pela interseção com a lista atual.
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultiSelect } from '@/hooks/useMultiSelect';

const itens = (...ids: string[]) => ids.map((id) => ({ id }));

describe('useMultiSelect', () => {
  it('toggle/selectAll/clear e derivados', () => {
    const { result } = renderHook(() => useMultiSelect(itens('a', 'b', 'c')));
    expect(result.current.isNoneSelected).toBe(true);
    act(() => { result.current.toggleItem('a'); });
    act(() => { result.current.toggleItem('b'); });
    expect(result.current.selectedCount).toBe(2);
    expect(result.current.isSelected('a')).toBe(true);
    expect(result.current.isAllSelected).toBe(false);
    act(() => { result.current.toggleItem('a'); });
    expect(result.current.getSelectedItems()).toEqual([{ id: 'b' }]);
    act(() => { result.current.selectAll(); });
    expect(result.current.isAllSelected).toBe(true);
    act(() => { result.current.clearSelection(); });
    expect(result.current.isNoneSelected).toBe(true);
  });

  it('item que sai da lista (filtro) deixa de contar, mesmo tendo sido clicado', () => {
    const { result, rerender } = renderHook(({ items }) => useMultiSelect(items), { initialProps: { items: itens('a', 'b', 'c') } });
    act(() => { result.current.selectAll(); });
    expect(result.current.selectedCount).toBe(3);
    rerender({ items: itens('a', 'b') });
    expect(result.current.selectedCount).toBe(2);
    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.getSelectedItems().map((i) => i.id)).toEqual(['a', 'b']);
    rerender({ items: [] });
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isNoneSelected).toBe(true);
  });
});
