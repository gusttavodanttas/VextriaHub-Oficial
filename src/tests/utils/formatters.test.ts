import { describe, it, expect } from 'vitest';
import { 
  formatCPF, 
  isValidCPF, 
  formatCurrency,
  capitalizeWords
} from '../../utils/formatters';

describe('formatters - CPF', () => {
  it('should correctly format a valid CPF', () => {
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
  });

  it('should ignore already formatted CPF', () => {
    expect(formatCPF('123.456.789-01')).toBe('123.456.789-01');
  });

  it('should validate correct CPF', () => {
    expect(isValidCPF('00000000000')).toBe(false);
    expect(isValidCPF('52998224725')).toBe(true); // Exemplo de CPF válido mock (apenas matemático)
  });
});

describe('formatters - others', () => {
  it('should correctly format currency', () => {
    const formatted = formatCurrency(1234.5);
    // Removemos possíveis non-breaking spaces que o Intl.NumberFormat adiciona no Node
    expect(formatted.replace(/\s/g, ' ')).toMatch(/R\$\s?1\.234,50/);
  });

  it('should capitalize words correctly', () => {
    expect(capitalizeWords('joão silva')).toBe('João Silva');
    expect(capitalizeWords('maria da silva')).toBe('Maria Da Silva');
  });
});
