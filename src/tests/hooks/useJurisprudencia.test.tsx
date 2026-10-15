// useJurisprudencia: busca via RPC, documento + mesmo processo + status próprio,
// conferência individual (URL oficial obrigatória), pins, histórico e alertas.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock, mockSupabase } from '../helpers/supabaseMock';
import { wrapper } from './_setup';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } | null };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { useJurisSearch, useJurisDoc, useJurisReviews, useJurisPins, useJurisSearches, useNormaAlertas } from '@/hooks/useJurisprudencia';
import type { JurisDoc } from '@/lib/juris';

const doc = { doc_id: 'd1', official_url: 'https://stj.jus.br/x/', title: 'T' } as unknown as JurisDoc;

describe('useJurisSearch', () => {
  beforeEach(() => { resetSupabaseMock(); mockSupabase.rpc.mockReset(); });

  it('chama juris_search com os filtros normalizados; sem termo nem filtro não busca', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: [doc], error: null });
    const { result } = renderHook(() => useJurisSearch('dano moral', { source: 'STJ', onlyVerified: true, limit: 5 }), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(mockSupabase.rpc).toHaveBeenCalledWith('juris_search', {
      p_q: 'dano moral', p_source: 'STJ', p_tipo: null, p_organ: null, p_from: null, p_to: null, p_only_verified: true, p_limit: 5, p_offset: 0,
    });
    const { result: r2 } = renderHook(() => useJurisSearch('  ', {}), { wrapper });
    expect(r2.current.fetchStatus).toBe('idle');
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
  });
});

describe('useJurisDoc', () => {
  beforeEach(() => { resetSupabaseMock(); mockSupabase.rpc.mockReset(); });

  it('traz o documento, os do mesmo processo e o status do próprio usuário', async () => {
    enfileirar('juris_documents', { data: doc });
    mockSupabase.rpc.mockResolvedValueOnce({ data: [{ doc_id: 'd2' }], error: null });
    enfileirar('juris_user_reviews', { data: { status: 'VERIFIED' } });
    const { result } = renderHook(() => useJurisDoc('d1'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data).toEqual({ doc, mesmoProcesso: [{ doc_id: 'd2' }], myStatus: 'VERIFIED' });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('juris_same_process', { p_doc_id: 'd1' });
    expect(chamadasCom('juris_user_reviews', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['doc_id', 'd1']], ['maybeSingle', []]]));
  });

  it('sem conferência → myStatus null; erro no documento propaga', async () => {
    enfileirar('juris_documents', { data: null });
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });
    enfileirar('juris_user_reviews', { data: null });
    const { result } = renderHook(() => useJurisDoc('d9'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ doc: null, mesmoProcesso: [], myStatus: null });

    enfileirar('juris_documents', { error: { message: 'boom' } });
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });
    const { result: r2 } = renderHook(() => useJurisDoc('d8'), { wrapper });
    await waitFor(() => expect(r2.current.isError).toBe(true));
  });
});

describe('useJurisReviews', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('conferir exige a URL oficial exata (ignora barra final/espaços) e grava VERIFIED', async () => {
    const { result } = renderHook(() => useJurisReviews(), { wrapper });
    await act(async () => { await result.current.conferir.mutateAsync({ doc, urlInformada: 'https://outra.url' }).catch(() => undefined); });
    expect(chamadasCom('juris_user_reviews', 'upsert')).toHaveLength(0);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível conferir' }));

    enfileirar('juris_user_reviews', { data: null });
    await act(async () => { await result.current.conferir.mutateAsync({ doc, urlInformada: '  https://stj.jus.br/x ', nota: 'ok' }); });
    const up = chamadasCom('juris_user_reviews', 'upsert')[0];
    expect(up.ops[0][1][0]).toEqual({ user_id: 'u1', doc_id: 'd1', status: 'VERIFIED', official_url_informada: 'https://stj.jus.br/x', nota: 'ok' });
    expect(up.ops[0][1][1]).toEqual({ onConflict: 'user_id,doc_id' });
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Conferido' }));
  });

  it('bloquear grava BLOCKED com motivo; desfazer apaga só a própria conferência; sem sessão falha', async () => {
    const { result } = renderHook(() => useJurisReviews(), { wrapper });
    enfileirar('juris_user_reviews', { data: null });
    await act(async () => { await result.current.bloquear.mutateAsync({ doc, motivo: 'revogado' }); });
    expect(chamadasCom('juris_user_reviews', 'upsert')[0].ops[0][1][0]).toMatchObject({ status: 'BLOCKED', nota: 'revogado', official_url_informada: doc.official_url });

    enfileirar('juris_user_reviews', { data: null });
    await act(async () => { await result.current.desfazer.mutateAsync('d1'); });
    expect(chamadasCom('juris_user_reviews', 'delete')[0].ops).toEqual(expect.arrayContaining([['eq', ['doc_id', 'd1']], ['eq', ['user_id', 'u1']]]));
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Conferência desfeita' }));

    auth.user = null;
    const { result: r2 } = renderHook(() => useJurisReviews(), { wrapper });
    await act(async () => { await r2.current.desfazer.mutateAsync('d1').catch(() => undefined); });
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Erro', description: 'Sessão expirada.' }));
  });
});

describe('useJurisPins', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('lista os pins do alvo, fixa com upsert e remove por id', async () => {
    enfileirar('juris_user_pins', { data: [{ id: 'p1', doc_id: 'd1', juris_documents: doc }] });
    const { result } = renderHook(() => useJurisPins('processo', 'pr1'), { wrapper });
    await waitFor(() => expect(result.current.pins).toHaveLength(1));
    expect(chamadasCom('juris_user_pins', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['alvo_tipo', 'processo']], ['eq', ['alvo_id', 'pr1']]]));

    enfileirar('juris_user_pins', { data: null });
    await act(async () => { await result.current.fixar.mutateAsync({ docId: 'd2' }); });
    expect(chamadasCom('juris_user_pins', 'upsert')[0].ops[0][1]).toEqual([
      { user_id: 'u1', doc_id: 'd2', alvo_tipo: 'processo', alvo_id: 'pr1', nota: null }, { onConflict: 'user_id,doc_id,alvo_tipo,alvo_id' },
    ]);
    expect(mockToast).toHaveBeenLastCalledWith({ title: 'Fixado' });

    enfileirar('juris_user_pins', { data: null });
    await act(async () => { await result.current.remover.mutateAsync('p1'); });
    expect(chamadasCom('juris_user_pins', 'delete')[0].ops).toEqual(expect.arrayContaining([['eq', ['id', 'p1']]]));

    resetSupabaseMock();
    renderHook(() => useJurisPins('publicacao', null), { wrapper });
    expect(chamadasCom('juris_user_pins', 'select')).toHaveLength(0);
  });
});

describe('useJurisSearches', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('registrar não repete a última pesquisa idêntica; salvar e remover', async () => {
    enfileirar('juris_user_searches', { data: [{ id: 's1', query: 'dano', filtros: { source: 'STJ' }, salva: false }] });
    const { result } = renderHook(() => useJurisSearches(), { wrapper });
    await waitFor(() => expect(result.current.itens).toHaveLength(1));
    expect(chamadasCom('juris_user_searches', 'select')[0].ops).toEqual(expect.arrayContaining([['limit', [40]]]));

    await act(async () => { await result.current.registrar.mutateAsync({ query: ' dano ', filtros: { source: 'STJ' } }); });
    await act(async () => { await result.current.registrar.mutateAsync({ query: '', filtros: {} }); });
    expect(chamadasCom('juris_user_searches', 'insert')).toHaveLength(0);

    enfileirar('juris_user_searches', { data: null });
    await act(async () => { await result.current.registrar.mutateAsync({ query: 'dano', filtros: { source: 'TJSP' } }); });
    expect(chamadasCom('juris_user_searches', 'insert')[0].ops[0][1][0]).toEqual({ user_id: 'u1', query: 'dano', filtros: { source: 'TJSP' }, salva: false });

    enfileirar('juris_user_searches', { data: null });
    await act(async () => { await result.current.salvar.mutateAsync({ id: 's1', nome: '', salva: true }); });
    expect(chamadasCom('juris_user_searches', 'update')[0].ops).toEqual(expect.arrayContaining([['update', [{ nome: null, salva: true }]], ['eq', ['id', 's1']]]));

    enfileirar('juris_user_searches', { data: null });
    await act(async () => { await result.current.remover.mutateAsync('s1'); });
    expect(chamadasCom('juris_user_searches', 'delete')[0].ops).toEqual(expect.arrayContaining([['eq', ['id', 's1']]]));
  });
});

describe('useNormaAlertas', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('sem registro usa os órgãos padrão desligados; salvar faz upsert por usuário', async () => {
    enfileirar('juris_user_norma_alertas', { data: null });
    const { result } = renderHook(() => useNormaAlertas(), { wrapper });
    await waitFor(() => expect(result.current.prefs).toBeTruthy());
    expect(result.current.prefs).toEqual({ ativo: false, orgaos: ['ANS', 'CFO', 'CRO'], termos: [] });

    enfileirar('juris_user_norma_alertas', { data: null });
    await act(async () => { await result.current.salvar.mutateAsync({ ativo: true, orgaos: ['ANS'], termos: ['rol'] }); });
    const up = chamadasCom('juris_user_norma_alertas', 'upsert')[0];
    expect(up.ops[0][1][0]).toMatchObject({ user_id: 'u1', ativo: true, orgaos: ['ANS'], termos: ['rol'] });
    expect(up.ops[0][1][1]).toEqual({ onConflict: 'user_id' });
    expect(mockToast).toHaveBeenLastCalledWith({ title: 'Alertas de normas salvos' });

    enfileirar('juris_user_norma_alertas', { error: { message: 'negado' } });
    await act(async () => { await result.current.salvar.mutateAsync({ ativo: false, orgaos: [], termos: [] }).catch(() => undefined); });
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Não foi possível salvar', description: 'negado' }));
  });
});
