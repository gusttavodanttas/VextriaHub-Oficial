// Sigla do tribunal a partir dos segmentos J.TR do número CNJ.
import { describe, it, expect } from 'vitest';
import { tribunalFromCNJ } from '@/utils/tribunalCNJ';

const cnj = (j: string, tr: string) => `0001234-56.2026.${j}.${tr}.0100`;

describe('tribunalFromCNJ', () => {
  it('cobre todos os ramos da justiça', () => {
    expect(tribunalFromCNJ(cnj('1', '00'))).toBe('STF');
    expect(tribunalFromCNJ(cnj('3', '00'))).toBe('STJ');
    expect(tribunalFromCNJ(cnj('4', '01'))).toBe('TRF1');
    expect(tribunalFromCNJ(cnj('5', '00'))).toBe('TST');
    expect(tribunalFromCNJ(cnj('5', '10'))).toBe('TRT10');
    expect(tribunalFromCNJ(cnj('6', '00'))).toBe('TSE');
    expect(tribunalFromCNJ(cnj('6', '26'))).toBe('TRE-SP');
    expect(tribunalFromCNJ(cnj('6', '99'))).toBe('TRE-99');
    expect(tribunalFromCNJ(cnj('7', '00'))).toBe('STM');
    expect(tribunalFromCNJ(cnj('8', '07'))).toBe('TJDFT');
    expect(tribunalFromCNJ(cnj('8', '26'))).toBe('TJSP');
    expect(tribunalFromCNJ(cnj('8', '99'))).toBe('TJ');
    expect(tribunalFromCNJ(cnj('9', '13'))).toBe('TJM-MG');
    expect(tribunalFromCNJ(cnj('9', '99'))).toBe('TJM');
    expect(tribunalFromCNJ(cnj('2', '00'))).toBe('');
  });

  it('número curto ou vazio devolve vazio', () => {
    expect(tribunalFromCNJ('')).toBe('');
    expect(tribunalFromCNJ(undefined)).toBe('');
    expect(tribunalFromCNJ('0001234-56.2026')).toBe('');
  });
});
