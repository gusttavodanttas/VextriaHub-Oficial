// Converte o HTML bruto de uma publicação/diário oficial em texto legível.
// Usado no teor das publicações e dos prazos capturados pelo robô.
export const deepCleanHTML = (html: string): string => {
  if (!html) return "";
  let tmp = html;
  tmp = tmp.replace(/<br\s*\/?>/gi, "\n");
  tmp = tmp.replace(/<\/p>|<\/div>|<\/tr>/gi, "\n");
  tmp = tmp.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");
  tmp = tmp.replace(/<[^>]*>/g, "");
  const entities: Record<string, string> = {
    '&nbsp;': ' ', '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&ordm;': 'º', '&ordf;': 'ª', '&agrave;': 'à', '&aacute;': 'á',
    '&acirc;': 'â', '&atilde;': 'ã', '&eacute;': 'é', '&ecirc;': 'ê',
    '&iacute;': 'í', '&oacute;': 'ó', '&ocirc;': 'ô', '&otilde;': 'õ',
    '&uacute;': 'ú', '&ccedil;': 'ç'
  };
  Object.entries(entities).forEach(([key, val]) => {
    tmp = tmp.replace(new RegExp(key, 'gi'), val);
  });
  return tmp.split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
