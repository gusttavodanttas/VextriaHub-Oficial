// Número CNJ: formatação completa, limpeza, ano e máscara progressiva.
import { describe, it, expect } from 'vitest';
import { formatCNJ, cleanCNJ, extractYearFromCNJ, maskCNJ } from '@/utils/formatCNJ';

describe('formatCNJ', () => {
  it('formatCNJ só formata com 20 dígitos; senão devolve como veio', () => {
    expect(formatCNJ('00012345620268260100')).toBe('0001234-56.2026.8.26.0100');
    expect(formatCNJ('0001234-56.2026.8.26.0100')).toBe('0001234-56.2026.8.26.0100');
    expect(formatCNJ('123')).toBe('123');
    expect(formatCNJ(null)).toBe('');
  });

  it('cleanCNJ e extractYearFromCNJ', () => {
    expect(cleanCNJ('0001234-56.2026.8.26.0100')).toBe('00012345620268260100');
    expect(cleanCNJ(undefined)).toBe('');
    expect(extractYearFromCNJ('0001234-56.2026.8.26.0100')).toBe('2026');
    expect(extractYearFromCNJ('123')).toBeNull();
  });

  it('maskCNJ acompanha a digitação em cada grupo', () => {
    expect(maskCNJ('')).toBe('');
    expect(maskCNJ('0001234')).toBe('0001234');
    expect(maskCNJ('000123456')).toBe('0001234-56');
    expect(maskCNJ('0001234562026')).toBe('0001234-56.2026');
    expect(maskCNJ('00012345620268')).toBe('0001234-56.2026.8');
    expect(maskCNJ('0001234562026826')).toBe('0001234-56.2026.8.26');
    expect(maskCNJ('00012345620268260100999')).toBe('0001234-56.2026.8.26.0100');
  });
});
