import { useState, useCallback } from 'react';

export function useMultiSelect<T extends { id: string | number }>(items: T[]) {
  const [selectedItems, setSelectedItems] = useState<Set<string | number>>(new Set());

  const toggleItem = useCallback((id: string | number) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = items.map(item => item.id);
    setSelectedItems(new Set(allIds));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const isSelected = useCallback((id: string | number) => {
    return selectedItems.has(id);
  }, [selectedItems]);

  // selectedCount/isAllSelected/isNoneSelected precisam refletir a MESMA
  // interseção com `items` que getSelectedItems() usa — senão o badge mostra
  // uma contagem (baseada no histórico bruto de cliques) maior do que a ação
  // em massa realmente processa (ex.: seleciona 3, muda o filtro, 1 item sai
  // da lista — o badge continuava em "3" enquanto a ação só pegava 2).
  const selectedCount = items.reduce((n, item) => n + (selectedItems.has(item.id) ? 1 : 0), 0);
  const isAllSelected = items.length > 0 && selectedCount === items.length;
  const isNoneSelected = selectedCount === 0;

  const getSelectedItems = useCallback(() => {
    return items.filter(item => selectedItems.has(item.id));
  }, [items, selectedItems]);

  return {
    selectedItems,
    toggleItem,
    selectAll,
    clearSelection,
    isSelected,
    isAllSelected,
    isNoneSelected,
    selectedCount,
    getSelectedItems,
  };
}