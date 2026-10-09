// Boilerplate compartilhado pelos testes de hook desta rodada (Parte 27, item 4).
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};
