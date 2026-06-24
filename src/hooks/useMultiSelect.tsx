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

  const isAllSelected = items.length > 0 && selectedItems.size === items.length;
  const isNoneSelected = selectedItems.size === 0;
  const selectedCount = selectedItems.size;

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