// Testes dos helpers puros do módulo de Prazos (extraídos no desmonte).
// Travam a classificação de urgência, os fallbacks de título/teor e a regra
// de "sugestão do robô" — o coração da aba mais crítica do sistema.
import { describe, it, expect } from 'vitest';
import { addDays } from 'date-fns';
import {
  getUrgency, getDaysLabel, getDataPrazo, tituloPrazo, teorPrazo,
  ehSugestaoRobo, pareceAudiencia, sortPrazos,
  type Prazo,
} from '@/components/Prazos/shared';
import { localYmd } from '@/lib/dates';

const base: Prazo = {
  id: 'p1', titulo: 'Contestação', prioridade: 'media', status: 'pendente', user_id: 'u1',
} as Prazo;

const emDias = (n: number) => localYmd(addDays(new Date(), n));

describe('getUrgency — classificação por data fatal', () => {
  it('concluído vence qualquer data', () => {
    expect(getUrgency({ ...base, status: 'concluido', data_fim_prazo: emDias(-10) })).toBe('concluido');
  });
  it('sem data → normal', () => {
    expect(getUrgency(base)).toBe('normal');
  });
  it('ontem → vencido · hoje → hoje · até 3 dias → crítico · depois → normal', () => {
    expect(getUrgency({ ...base, data_fim_prazo: emDias(-1) })).toBe('vencido');
    expect(getUrgency({ ...base, data_fim_prazo: emDias(0) })).toBe('hoje');
    expect(getUrgency({ ...base, data_fim_prazo: emDias(3) })).toBe('critico');
    expect(getUrgency({ ...base, data_fim_prazo: emDias(4) })).toBe('normal');
  });
  it('usa data_vencimento (legado) quando não há data_fim_prazo', () => {
    expect(getUrgency({ ...base, data_vencimento: emDias(0) })).toBe('hoje');
  });
});

describe('getDaysLabel', () => {
  it('rotula vencido/hoje/amanhã/futuro', () => {
    expect(getDaysLabel({ ...base, data_fim_prazo: emDias(-2) })).toBe('Vencido há 2d');
    expect(getDaysLabel({ ...base, data_fim_prazo: emDias(0) })).toBe('Vence hoje');
    expect(getDaysLabel({ ...base, data_fim_prazo: emDias(1) })).toBe('Amanhã');
    expect(getDaysLabel({ ...base, data_fim_prazo: emDias(7) })).toBe('7 dias');
    expect(getDaysLabel({ ...base, status: 'concluido' })).toBe('Concluído');
    expect(getDaysLabel(base)).toBe('—');
  });
});

describe('tituloPrazo / teorPrazo — fallbacks da publicação de origem', () => {
  const pubs = { 'pub-1': { titulo: 'JOSE x RECOVE', conteudo: '<p>Intimação do <b>réu</b></p>' } };

  it('prefere o título próprio', () => {
    expect(tituloPrazo({ ...base, publicacao_id: 'pub-1' }, pubs)).toBe('Contestação');
  });
  it('cai para o título da publicação, depois tipo_prazo, depois genérico', () => {
    expect(tituloPrazo({ ...base, titulo: ' ', publicacao_id: 'pub-1' }, pubs)).toBe('JOSE x RECOVE');
    expect(tituloPrazo({ ...base, titulo: '', tipo_prazo: 'Sentença' })).toBe('Sentença');
    expect(tituloPrazo({ ...base, titulo: '' })).toBe('Prazo processual');
  });
  it('teor usa a descrição própria ou o conteúdo LIMPO da publicação', () => {
    expect(teorPrazo({ ...base, descricao: 'Meu teor' }, pubs)).toBe('Meu teor');
    expect(teorPrazo({ ...base, publicacao_id: 'pub-1' }, pubs)).toBe('Intimação do réu');
    expect(teorPrazo(base, pubs)).toBe('');
  });
});

describe('ehSugestaoRobo / pareceAudiencia — triagem', () => {
  it('sugestão = veio de publicação E ainda não aceita', () => {
    expect(ehSugestaoRobo({ publicacao_id: 'pub-1', confirmado_em: null })).toBe(true);
    expect(ehSugestaoRobo({ publicacao_id: 'pub-1', confirmado_em: '2026-07-09T10:00:00Z' })).toBe(false);
    expect(ehSugestaoRobo({ publicacao_id: null, confirmado_em: null })).toBe(false);
  });
  it('detecta menção a audiência no teor (com e sem acento)', () => {
    expect(pareceAudiencia('Designada AUDIÊNCIA de conciliação')).toBe(true);
    expect(pareceAudiencia('designo audiencia una')).toBe(true);
    expect(pareceAudiencia('Prazo para contestar')).toBe(false);
    expect(pareceAudiencia('')).toBe(false);
  });
});

describe('sortPrazos', () => {
  const a = { ...base, id: 'a', prioridade: 'baixa' as const, data_fim_prazo: emDias(1) };
  const b = { ...base, id: 'b', prioridade: 'alta' as const, data_fim_prazo: emDias(5) };
  const c = { ...base, id: 'c', prioridade: 'alta' as const, data_fim_prazo: emDias(2) };

  it('ordena por prioridade e, dentro dela, por data', () => {
    expect(sortPrazos([a, b, c]).map(p => p.id)).toEqual(['c', 'b', 'a']);
  });
  it('com dateFirst (vencidos), a data manda: mais atrasado primeiro', () => {
    const v1 = { ...base, id: 'v1', prioridade: 'baixa' as const, data_fim_prazo: emDias(-10) };
    const v2 = { ...base, id: 'v2', prioridade: 'alta' as const, data_fim_prazo: emDias(-1) };
    expect(sortPrazos([v2, v1], true).map(p => p.id)).toEqual(['v1', 'v2']);
  });
  it('sem data vai para o fim', () => {
    const s = { ...base, id: 's' };
    expect(sortPrazos([s, c]).map(p => p.id)).toEqual(['c', 's']);
  });
  it('getDataPrazo prefere data_fim_prazo sobre data_vencimento', () => {
    expect(getDataPrazo({ ...base, data_fim_prazo: '2026-08-01', data_vencimento: '2026-07-01' })).toBe('2026-08-01');
    expect(getDataPrazo({ ...base, data_vencimento: '2026-07-01' })).toBe('2026-07-01');
    expect(getDataPrazo(base)).toBeNull();
  });
});
