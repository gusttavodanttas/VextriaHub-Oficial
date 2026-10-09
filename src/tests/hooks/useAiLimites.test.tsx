// Teto de IA por escritório: o upsert/delete do super admin precisa conferir as
// linhas afetadas (RLS barra em silêncio) e o resumo do cabeçalho do widget
// precisa refletir "sem teto", "teto do escritório" e "padrão global".
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';
import { PERMISSAO_NEGADA } from '@/lib/errors';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});

import { limparAiLimite, mesCorrenteUtc, resumoUsoIa, salvarAiLimite, useAiUsoEscritorio } from '@/hooks/useAiLimites';

describe('useAiLimites', () => {
  beforeEach(() => resetSupabaseMock());

  it('salvarAiLimite: RLS barrando (0 linhas) vira erro, com .select no upsert', async () => {
    enfileirar('ai_limites', { data: [] });
    await expect(salvarAiLimite('o1', { limite_chamadas: 100, limite_voz_caracteres: null, observacao: null }))
      .rejects.toThrow(PERMISSAO_NEGADA);
    const up = chamadasCom('ai_limites', 'upsert').at(-1)!;
    expect(up.ops.some(([m]) => m === 'select')).toBe(true);
    const [, args] = up.ops.find(([m]) => m === 'upsert')!;
    expect(args[0]).toEqual({ office_id: 'o1', limite_chamadas: 100, limite_voz_caracteres: null, observacao: null });
  });

  it('salvarAiLimite / limparAiLimite: 1 linha afetada resolve sem erro', async () => {
    enfileirar('ai_limites', { data: [{ office_id: 'o1' }] });
    await expect(salvarAiLimite('o1', { limite_chamadas: 0, limite_voz_caracteres: 0, observacao: 'x' })).resolves.toBeUndefined();
    enfileirar('ai_limites', { data: [{ office_id: 'o1' }] });
    await expect(limparAiLimite('o1')).resolves.toBeUndefined();
    enfileirar('ai_limites', { data: [] });
    await expect(limparAiLimite('o1')).rejects.toThrow(PERMISSAO_NEGADA);
  });

  it('useAiUsoEscritorio: lê o mês corrente de ai_usage e o teto de ai_limites; erro vira `error`', async () => {
    enfileirar('ai_usage', { data: { chamadas: 7, voz_caracteres: 10, tokens_prompt: 100, tokens_resposta: 50 } });
    enfileirar('ai_limites', { data: { limite_chamadas: 300, limite_voz_caracteres: null, observacao: null } });
    const { result } = renderHook(() => useAiUsoEscritorio('o1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.uso.chamadas).toBe(7));
    expect(result.current.limite?.limite_chamadas).toBe(300);
    const sel = chamadasCom('ai_usage', 'select').at(-1)!;
    expect(sel.ops).toContainEqual(['eq', ['mes', mesCorrenteUtc()]]);

    enfileirar('ai_usage', { error: { message: 'boom' } });
    await result.current.refetch();
    await waitFor(() => expect(result.current.error).toBe('boom'));
  });

  it('useAiUsoEscritorio sem escritório não consulta nada', async () => {
    const { result } = renderHook(() => useAiUsoEscritorio(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(chamadasCom('ai_usage', 'select')).toHaveLength(0);
    expect(result.current.uso.chamadas).toBe(0);
  });

  it('resumoUsoIa: padrão global, sem teto e teto do escritório', () => {
    const uso = { chamadas: 12, voz_caracteres: 0, tokens_prompt: 0, tokens_resposta: 0 };
    expect(resumoUsoIa(uso, null)).toBe('12 usos este mês');
    expect(resumoUsoIa({ ...uso, chamadas: 1 }, null)).toBe('1 uso este mês');
    expect(resumoUsoIa(uso, { limite_chamadas: 0, limite_voz_caracteres: null, observacao: null })).toBe('12 usos este mês · sem teto');
    expect(resumoUsoIa(uso, { limite_chamadas: 300, limite_voz_caracteres: null, observacao: null })).toBe('12/300 usos este mês');
  });

  it('mesCorrenteUtc usa o mês UTC, não o local', () => {
    expect(mesCorrenteUtc(new Date('2026-10-31T23:30:00-03:00'))).toBe('2026-11-01');
    expect(mesCorrenteUtc(new Date('2026-10-09T12:00:00Z'))).toBe('2026-10-01');
  });
});
