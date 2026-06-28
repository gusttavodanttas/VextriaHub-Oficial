import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'blue' | 'auto';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'light' | 'dark' | 'blue'; // O tema real aplicado
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme');
    return (stored as Theme) || 'auto';
  });

  const [actualTheme, setActualTheme] = useState<'light' | 'dark' | 'blue'>('blue');

  // Define as classes no <html>. O tema "blue" usa .dark (para ativar os
  // utilitários dark: do Tailwind) + .blue (que sobrescreve as cores p/ navy).
  const applyTheme = (resolved: 'light' | 'dark' | 'blue') => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'blue');
    if (resolved === 'blue') {
      root.classList.add('dark', 'blue');
    } else {
      root.classList.add(resolved);
    }
    setActualTheme(resolved);
  };

  useEffect(() => {
    let resolvedTheme: 'light' | 'dark' | 'blue';

    if (theme === 'auto') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolvedTheme = systemPrefersDark ? 'dark' : 'light';
    } else {
      resolvedTheme = theme as 'light' | 'dark' | 'blue';
    }

    applyTheme(resolvedTheme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Escuta mudanças na preferência do sistema quando em modo auto
  useEffect(() => {
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme(mediaQuery.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, actualTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}