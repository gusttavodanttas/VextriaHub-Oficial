import { describe, it, expect } from 'vitest';
import { formatCPF, formatCNPJ, isValidCPF, isValidCNPJ, formatCpfCnpj, isValidCpfCnpj } from '@/lib/document';

// Cobre o validador de CPF/CNPJ VIVO (lib/document, 16 importadores, porteia a cobrança
// Asaas). Antes o teste apontava pra uma cópia quase-morta (utils/formatters, removida).

describe('document — CPF', () => {
  it('formata 11 dígitos no padrão', () => {
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
  });
  it('reformata um já formatado (idempotente)', () => {
    expect(formatCPF('123.456.789-01')).toBe('123.456.789-01');
  });
  it('valida o dígito verificador', () => {
    expect(isValidCPF('52998224725')).toBe(true);
    expect(isValidCPF('11144477735')).toBe(true); // CPF de teste do sandbox Asaas
    expect(isValidCPF('00000000000')).toBe(false); // todos iguais
    expect(isValidCPF('12345678900')).toBe(false); // DV errado
    expect(isValidCPF('123')).toBe(false); // curto
  });
});

describe('document — CNPJ', () => {
  it('formata 14 dígitos no padrão', () => {
    expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81');
  });
  it('valida o dígito verificador', () => {
    expect(isValidCNPJ('11222333000181')).toBe(true);
    expect(isValidCNPJ('11444777000161')).toBe(true);
    expect(isValidCNPJ('00000000000000')).toBe(false); // todos iguais
    expect(isValidCNPJ('12345678000100')).toBe(false); // DV errado
  });
});

describe('document — CPF/CNPJ combinado (usado no cadastro/cobrança)', () => {
  it('formata conforme o tipo de pessoa', () => {
    expect(formatCpfCnpj('12345678901', 'fisica')).toBe('123.456.789-01');
    expect(formatCpfCnpj('11222333000181', 'juridica')).toBe('11.222.333/0001-81');
  });
  it('valida conforme o tipo de pessoa', () => {
    expect(isValidCpfCnpj('52998224725', 'fisica')).toBe(true);
    expect(isValidCpfCnpj('11222333000181', 'juridica')).toBe(true);
    expect(isValidCpfCnpj('12345678900', 'fisica')).toBe(false);
  });
});
