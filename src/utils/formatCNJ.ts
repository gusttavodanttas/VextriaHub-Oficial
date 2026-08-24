/**
 * Formata um número de processo para o padrão CNJ (0000000-00.0000.0.00.0000)
 */
export function formatCNJ(numero: string | undefined | null): string {
  if (!numero) return '';
  const d = numero.replace(/\D/g, '');
  
  if (d.length !== 20) return numero;
  
  return `${d.substring(0, 7)}-${d.substring(7, 9)}.${d.substring(9, 13)}.${d.substring(13, 14)}.${d.substring(14, 16)}.${d.substring(16, 20)}`;
}

/**
 * Remove formatação e deixa apenas números
 */
export function cleanCNJ(numero: string | undefined | null): string {
  if (!numero) return '';
  return numero.replace(/\D/g, '');
}

/**
 * Extrai o ano de distribuição do número CNJ (sétimo grupo de dígitos)
 */
export function extractYearFromCNJ(numero: string | undefined | null): string | null {
  const clean = cleanCNJ(numero);
  if (clean.length === 20) {
    return clean.substring(9, 13);
  }
  return null;
}

/**
 * Máscara de digitação: formata o CNJ progressivamente enquanto o usuário digita
 * (0000000-00.0000.0.00.0000). Diferente de formatCNJ, que só formata com os 20 dígitos completos.
 */
export function maskCNJ(value: string): string {
  const d = value.replace(/\D/g, '');
  if (!d) return '';
  if (d.length <= 7) return d;
  if (d.length <= 9) return `${d.slice(0, 7)}-${d.slice(7)}`;
  if (d.length <= 13) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9)}`;
  if (d.length <= 14) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13)}`;
  if (d.length <= 16) return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14)}`;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}
