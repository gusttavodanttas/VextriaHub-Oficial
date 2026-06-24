import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook para gerenciar estado de dados baseado no isFirstLogin
 * Garante que usuários novos sempre vejam dados vazios até escolherem ver exemplos
 * Preserva dados reais uma vez que são criados
 */
export function useDataState<T>(mockData: T[]) {
  const { isFirstLogin, resetFirstLogin, user } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const hasRealData = useRef(false);
  const isInitialized = useRef(false);
  const lastUserId = useRef<string | null>(null);
  
  // Memoiza a chave de storage para evitar recalculos desnecessários
  const storageKey = useMemo(() => {
    if (!user?.id) return null;
    
    // Usa uma identificação mais robusta baseada na estrutura dos dados mockados
    let dataType = 'data';
    if (mockData.length > 0) {
      const firstItem = mockData[0] as any;
      if (firstItem.titulo && firstItem.cliente && firstItem.status) {
        dataType = 'processos';
      } else if (firstItem.nome && firstItem.email) {
        dataType = 'clientes';
      } else if (firstItem.data && firstItem.tipo) {
        dataType = 'atendimentos';
      }
    }
    return `vextria_${dataType}_${user.id}`;
  }, [user?.id, mockData]);

  // Carrega dados do localStorage
  const loadFromStorage = useCallback(() => {
    if (!storageKey) return null;
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsedData = JSON.parse(stored);
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          hasRealData.current = true;
          return parsedData;
        }
      }
    } catch (error) {
      console.warn('Erro ao carregar dados do localStorage:', error);
    }
    return null;
  }, [storageKey]);

  // Salva dados no localStorage
  const saveToStorage = useCallback((dataToSave: T[]) => {
    if (!storageKey) return;
    
    try {
      if (dataToSave.length > 0 && JSON.stringify(dataToSave) !== JSON.stringify(mockData)) {
        localStorage.setItem(storageKey, JSON.stringify(dataToSave));
      }
    } catch (error) {
      console.warn('Erro ao salvar dados no localStorage:', error);
    }
  }, [storageKey, mockData]);

  // Inicialização dos dados - executado apenas uma vez por usuário
  useEffect(() => {
    // Se não há usuário ou já foi inicializado para este usuário, não faz nada
    if (!user?.id || (isInitialized.current && lastUserId.current === user.id)) {
      return;
    }

    // Se mudou de usuário, reseta estado
    if (lastUserId.current !== user.id) {
      isInitialized.current = false;
      hasRealData.current = false;
      lastUserId.current = user.id;
    }

    if (!isInitialized.current) {
      const storedData = loadFromStorage();
      
      if (storedData && storedData.length > 0) {
        // Se há dados salvos, usa eles
        setData(storedData);
        hasRealData.current = true;
        // Se o usuário tem dados reais mas ainda está marcado como firstLogin, corrige isso
        if (isFirstLogin) {
          resetFirstLogin();
        }
      } else {
        // Para demonstração: sempre mostra dados mockados se disponíveis
        // Para novos usuários (isFirstLogin = true), mostra lista vazia apenas se não houver mockData
        const shouldShowMockData = mockData.length > 0;
        const initialData = (isFirstLogin && !shouldShowMockData) ? [] : mockData;
        setData(initialData);
      }
      
      isInitialized.current = true;
    }
  }, [user?.id, loadFromStorage, mockData, isFirstLogin, resetFirstLogin]);

  const updateData = useCallback((newData: T[]) => {
    setData(newData);
    
    // Se dados reais foram adicionados (não vazios e diferentes dos mockados)
    if (newData.length > 0 && JSON.stringify(newData) !== JSON.stringify(mockData)) {
      hasRealData.current = true;
      saveToStorage(newData);
      
      // Reset isFirstLogin quando dados reais são criados
      if (isFirstLogin) {
        resetFirstLogin();
      }
    } else if (newData.length === 0) {
      // Se os dados foram limpos, remove do localStorage
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch (error) {
          console.warn('Erro ao remover dados do localStorage:', error);
        }
      }
      hasRealData.current = false;
    }
  }, [mockData, saveToStorage, isFirstLogin, resetFirstLogin, storageKey]);

  const loadSampleData = useCallback(() => {
    setData(mockData);
    // Dados de exemplo não contam como dados reais
    hasRealData.current = false;
    // Remove dados reais do localStorage quando carrega exemplos
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.warn('Erro ao remover dados do localStorage:', error);
      }
    }
  }, [mockData, storageKey]);

  const clearData = useCallback(() => {
    setData([]);
    hasRealData.current = false;
    // Remove dados do localStorage
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.warn('Erro ao remover dados do localStorage:', error);
      }
    }
  }, [storageKey]);

  return {
    data,
    isNewUser: isFirstLogin && !hasRealData.current,
    loadSampleData,
    clearData,
    updateData
  };
}