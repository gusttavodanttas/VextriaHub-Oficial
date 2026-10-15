// Cor primária do escritório: HEX → HSL do shadcn, aplicação no <html> e páginas
// públicas que voltam pra cor padrão restaurando a personalizada ao sair.
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { hexToHslString, applyPrimary, useDefaultBrandOnPublicPage, BRAND_LS_KEY } from '@/lib/brandColor';

describe('brandColor', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.style.removeProperty('--primary'); });

  it('converte HEX pra "H S% L%" e rejeita formatos inválidos', () => {
    expect(hexToHslString('#1e90ff')).toBe('210 100% 56%');
    expect(hexToHslString(' ff0000 ')).toBe('0 100% 50%');
    expect(hexToHslString('#00ff00')).toBe('120 100% 50%');
    expect(hexToHslString('#808080')).toBe('0 0% 50%');
    expect(hexToHslString('#fff')).toBeNull();
    expect(hexToHslString('')).toBeNull();
    expect(hexToHslString('#gggggg')).toBeNull();
  });

  it('applyPrimary define e remove a variável no <html>', () => {
    applyPrimary('210 100% 56%');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('210 100% 56%');
    applyPrimary(null);
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('');
  });

  it('página pública limpa a cor no mount e restaura a salva ao desmontar', () => {
    localStorage.setItem(BRAND_LS_KEY, '340 80% 40%');
    applyPrimary('340 80% 40%');
    const { unmount } = renderHook(() => useDefaultBrandOnPublicPage());
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('');
    unmount();
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('340 80% 40%');

    localStorage.clear();
    const r2 = renderHook(() => useDefaultBrandOnPublicPage());
    r2.unmount();
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('');
  });
});
