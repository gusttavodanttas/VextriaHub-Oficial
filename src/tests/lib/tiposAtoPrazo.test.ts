import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});

import { carregarTiposAto, TIPOS_ATO_DEFAULT } from '@/lib/tiposAtoPrazo';

const linha = (i: number) => ({ id: `t${i}`, value: `v${i}`, label: `Tipo ${i}`, dias_uteis: 5, corridos: false, margem: 1, ordem: i });

describe('carregarTiposAto — escritório novo recebe os padrões do CPC', () => {
  beforeEach(() => resetSupabaseMock());

  it('com tipos cadastrados, devolve os da tabela e não grava nada', async () => {
    enfileirar('tipos_ato_prazo', { data: [linha(0), linha(1)] });
    const r = await carregarTiposAto('o1');
    expect(r.tipos.map(t => t.id)).toEqual(['t0', 't1']);
    expect(r.semeado).toBe(false);
    expect(r.fallback).toBe(false);
    expect(chamadasCom('tipos_ato_prazo', 'insert')).toHaveLength(0);
  });

  it('tabela vazia: grava os 11 padrões e devolve os gravados (com id)', async () => {
    enfileirar('tipos_ato_prazo', { data: [] });
    enfileirar('tipos_ato_prazo', { data: TIPOS_ATO_DEFAULT.map((t, i) => ({ id: `n${i}`, value: t.value, label: t.label, dias_uteis: t.diasUteis, corridos: t.corridos, margem: t.margem, ordem: t.ordem })) });
    const r = await carregarTiposAto('o1');
    expect(r.semeado).toBe(true);
    expect(r.tipos).toHaveLength(TIPOS_ATO_DEFAULT.length);
    expect(r.tipos[0]).toMatchObject({ id: 'n0', value: 'contestacao', diasUteis: 15 });
    const ins = chamadasCom('tipos_ato_prazo', 'insert');
    expect(ins).toHaveLength(1);
    const payload = ins[0].ops.find(([m]) => m === 'insert')![1][0] as Array<{ office_id: string }>;
    expect(payload).toHaveLength(TIPOS_ATO_DEFAULT.length);
    expect(payload.every(p => p.office_id === 'o1')).toBe(true);
  });

  it('semente barrada pela RLS (0 linhas, sem erro): cai para os padrões em memória', async () => {
    enfileirar('tipos_ato_prazo', { data: [] });
    enfileirar('tipos_ato_prazo', { data: [] });
    const r = await carregarTiposAto('o1');
    expect(r.fallback).toBe(true);
    expect(r.semeado).toBe(false);
    expect(r.tipos).toHaveLength(TIPOS_ATO_DEFAULT.length);
    expect(r.tipos[0].value).toBe('contestacao');
  });

  it('erro na leitura é propagado (a tela mostra erro, não lista vazia)', async () => {
    enfileirar('tipos_ato_prazo', { error: { message: 'boom' } });
    await expect(carregarTiposAto('o1')).rejects.toEqual({ message: 'boom' });
  });
});
