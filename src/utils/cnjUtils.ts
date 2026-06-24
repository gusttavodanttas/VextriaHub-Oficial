/**
 * Utilitários para validação e formatação de números CNJ
 * Padrão CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
 * N = número sequencial
 * D = dígitos verificadores
 * A = ano do ajuizamento
 * J = segmento do poder judiciário
 * T = tribunal do respectivo segmento
 * R = região geográfica
 * O = origem
 */

/**
 * Remove todos os caracteres não numéricos de uma string
 */
export function removeNonNumeric(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formata um número CNJ no padrão NNNNNNN-DD.AAAA.J.TR.OOOO
 */
export function formatCNJ(value: string): string {
  const numbers = removeNonNumeric(value);
  
  if (numbers.length === 0) return '';
  if (numbers.length <= 7) return numbers;
  if (numbers.length <= 9) return `${numbers.slice(0, 7)}-${numbers.slice(7)}`;
  if (numbers.length <= 13) return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9)}`;
  if (numbers.length <= 14) return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9, 13)}.${numbers.slice(13)}`;
  if (numbers.length <= 16) return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9, 13)}.${numbers.slice(13, 14)}.${numbers.slice(14)}`;
  
  return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9, 13)}.${numbers.slice(13, 14)}.${numbers.slice(14, 16)}.${numbers.slice(16, 20)}`;
}

/**
 * Calcula os dígitos verificadores do CNJ
 */
function calculateCNJDigits(sequencial: string, ano: string, segmento: string, tribunal: string, origem: string): string {
  const numbers = sequencial + ano + segmento + tribunal + origem;
  const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5, 6, 7, 8, 9];
  
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    sum += parseInt(numbers[i]) * weights[i];
  }
  
  const remainder = sum % 97;
  const digit = 98 - remainder;
  
  return digit.toString().padStart(2, '0');
}

/**
 * Valida se um número CNJ está no formato correto
 */
export function isValidCNJFormat(cnj: string): boolean {
  const cnjPattern = /^\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}$/;
  return cnjPattern.test(cnj);
}

/**
 * Valida se um número CNJ é válido (formato + dígitos verificadores)
 */
export function isValidCNJ(cnj: string): boolean {
  if (!isValidCNJFormat(cnj)) {
    return false;
  }
  
  const numbers = removeNonNumeric(cnj);
  
  if (numbers.length !== 20) {
    return false;
  }
  
  const sequencial = numbers.slice(0, 7);
  const digitosInformados = numbers.slice(7, 9);
  const ano = numbers.slice(9, 13);
  const segmento = numbers.slice(13, 14);
  const tribunal = numbers.slice(14, 16);
  const origem = numbers.slice(16, 20);
  
  const digitosCalculados = calculateCNJDigits(sequencial, ano, segmento, tribunal, origem);
  
  return digitosInformados === digitosCalculados;
}

/**
 * Valida se um número de processo está no formato CNJ ou formato livre
 */
export function validateProcessNumber(numero: string): { isValid: boolean; type: 'cnj' | 'livre'; message?: string } {
  if (!numero || numero.trim() === '') {
    return { isValid: false, type: 'livre', message: 'Número do processo é obrigatório' };
  }
  
  const numeroLimpo = numero.trim();
  
  // Verifica se parece com formato CNJ
  if (numeroLimpo.includes('-') && numeroLimpo.includes('.')) {
    if (isValidCNJFormat(numeroLimpo)) {
      if (isValidCNJ(numeroLimpo)) {
        return { isValid: true, type: 'cnj' };
      } else {
        return { isValid: false, type: 'cnj', message: 'Número CNJ inválido - dígitos verificadores incorretos' };
      }
    } else {
      return { isValid: false, type: 'cnj', message: 'Formato CNJ inválido. Use: NNNNNNN-DD.AAAA.J.TR.OOOO' };
    }
  }
  
  // Formato livre - aceita qualquer coisa não vazia
  return { isValid: true, type: 'livre' };
}

/**
 * Segmentos do Poder Judiciário
 */
export const SEGMENTOS_CNJ = {
  '1': 'Supremo Tribunal Federal',
  '2': 'Conselho Nacional de Justiça',
  '3': 'Superior Tribunal de Justiça',
  '4': 'Justiça Federal',
  '5': 'Justiça do Trabalho',
  '6': 'Justiça Eleitoral',
  '7': 'Justiça Militar da União',
  '8': 'Justiça dos Estados e do Distrito Federal e Territórios',
  '9': 'Justiça Militar Estadual'
};

/**
 * Extrai informações de um número CNJ válido
 */
export function extractCNJInfo(cnj: string): {
  sequencial: string;
  digitos: string;
  ano: string;
  segmento: string;
  segmentoNome: string;
  tribunal: string;
  origem: string;
} | null {
  if (!isValidCNJ(cnj)) {
    return null;
  }
  
  const numbers = removeNonNumeric(cnj);
  const segmento = numbers.slice(13, 14);
  
  return {
    sequencial: numbers.slice(0, 7),
    digitos: numbers.slice(7, 9),
    ano: numbers.slice(9, 13),
    segmento,
    segmentoNome: SEGMENTOS_CNJ[segmento as keyof typeof SEGMENTOS_CNJ] || 'Segmento desconhecido',
    tribunal: numbers.slice(14, 16),
    origem: numbers.slice(16, 20)
  };
}