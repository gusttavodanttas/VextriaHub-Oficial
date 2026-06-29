// Personalização da cor primária do escritório.
// Guardamos o HEX em offices.settings.primary_color e o HSL no localStorage
// (para aplicar instantaneamente no boot, sem flash).

export const BRAND_LS_KEY = "brand_primary_hsl";

/** "#1e90ff" -> "210 100% 56%" (formato que o Tailwind/shadcn usa em --primary) */
export function hexToHslString(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || "").trim());
  if (!m) return null;
  let r = parseInt(m[1], 16) / 255;
  let g = parseInt(m[2], 16) / 255;
  let b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Aplica (ou remove) a cor primária no <html>. Passe o HSL string ou null para resetar. */
export function applyPrimary(hsl: string | null) {
  const root = document.documentElement;
  if (hsl) root.style.setProperty("--primary", hsl);
  else root.style.removeProperty("--primary");
}
