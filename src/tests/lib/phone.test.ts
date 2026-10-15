// Telefone brasileiro: máscara progressiva e validação com DDD/celular.
import { describe, it, expect } from 'vitest';
import { formatPhone, isValidPhone } from '@/lib/phone';

describe('phone', () => {
  it('formatPhone acompanha a digitação e corta em 11 dígitos', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('6')).toBe('(6');
    expect(formatPhone('61')).toBe('(61');
    expect(formatPhone('6199')).toBe('(61) 99');
    expect(formatPhone('6133334444')).toBe('(61) 3333-4444');
    expect(formatPhone('61999998888')).toBe('(61) 99999-8888');
    expect(formatPhone('+55 (61) 99999-8888 ramal 9')).toBe('(55) 61999-9988');
  });

  it('isValidPhone: vazio é válido; exige 10/11 dígitos, DDD plausível e 9 no celular', () => {
    expect(isValidPhone('')).toBe(true);
    expect(isValidPhone('(61) 3333-4444')).toBe(true);
    expect(isValidPhone('(61) 99999-8888')).toBe(true);
    expect(isValidPhone('(61) 89999-8888')).toBe(false);
    expect(isValidPhone('(10) 99999-8888')).toBe(false);
    expect(isValidPhone('(61) 9999-888')).toBe(false);
    expect(isValidPhone('123456789012')).toBe(false);
  });
});
