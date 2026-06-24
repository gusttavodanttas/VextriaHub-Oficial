/**
 * Formata uma string para o padrão CNJ: 0000000-00.0000.0.00.0000
 */
export const formatCNJ = (value: string): string => {
  // Remove tudo que não for dígito
  const digits = value.replace(/\D/g, "");
  
  if (!digits) return "";

  let masked = "";
  
  // NNNNNNN-DD.YYYY.J.RR.EEEE
  if (digits.length <= 7) {
    masked = digits;
  } else if (digits.length <= 9) {
    masked = `${digits.slice(0, 7)}-${digits.slice(7)}`;
  } else if (digits.length <= 13) {
    masked = `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9)}`;
  } else if (digits.length <= 14) {
    masked = `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13)}`;
  } else if (digits.length <= 16) {
    masked = `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14)}`;
  } else {
    masked = `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
  }

  return masked;
};

/**
 * Remove formatação CNJ para salvar no banco
 */
export const unformatCNJ = (value: string): string => {
  return value.replace(/\D/g, "").slice(0, 20);
};
