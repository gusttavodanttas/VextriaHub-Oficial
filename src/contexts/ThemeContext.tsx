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

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove todas as classes de tema
    root.classList.remove('light', 'dark', 'blue');
    
    let resolvedTheme: 'light' | 'dark' | 'blue';
    
    if (theme === 'auto') {
      // Detecção automática baseada na preferência do sistema
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolvedTheme = systemPrefersDark ? 'blue' : 'light';
    } else {
      resolvedTheme = theme as 'light' | 'dark' | 'blue';
    }
    
    // Aplica o tema
    root.classList.add(resolvedTheme);
    setActualTheme(resolvedTheme);
    
    // Salva no localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Escuta mudanças na preferência do sistema quando em modo auto
  useEffect(() => {
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark', 'blue');
        const resolvedTheme = mediaQuery.matches ? 'blue' : 'light';
        root.classList.add(resolvedTheme);
        setActualTheme(resolvedTheme);
      };
      
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