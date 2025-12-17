
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';

export type ThemeId = 
  | 'system' | 'light' | 'dark' | 'rose' | 'matcha' | 'latte' 
  | 'sky' | 'sunrise' | 'lavender' | 'terracotta' | 'alabaster' | 'espresso' | 'midnight'
  | string; // Allow custom strings

const THEME_STORAGE_KEY = 'cogniflow-themeId';
const CUSTOM_THEMES_STORAGE_KEY = 'cogniflow-custom-themes';

interface ColorPalette {
  background: string;
  surface: string;
  primary: string;
  text: string;
  onPrimary?: string; // Optional, usually calculated or static
}

export interface Theme {
  id: ThemeId;
  name: string;
  isDark: boolean;
  metaColor: string;
  metaColorDark?: string; // Only for system
  palette: ColorPalette;
  paletteDark?: ColorPalette; // Only for system
  isCustom?: boolean;
}

export const themes: readonly Theme[] = [
  { id: 'system', name: 'System', isDark: false, metaColor: '#f9fafb', metaColorDark: '#111827', palette: { background: '249 250 251', surface: '255 255 255', primary: '37 99 235', text: '17 24 39' }, paletteDark: { background: '17 24 39', surface: '31 41 55', primary: '37 99 235', text: '243 244 246' } },
  { id: 'light', name: 'Light', isDark: false, metaColor: '#f9fafb', palette: { background: '249 250 251', surface: '255 255 255', primary: '37 99 235', text: '17 24 39' } },
  { id: 'rose', name: 'Rose', isDark: false, metaColor: '#fff1f2', palette: { background: '255 241 242', surface: '254 226 226', primary: '225 29 72', text: '136 25 55' } },
  { id: 'matcha', name: 'Matcha', isDark: false, metaColor: '#f0fdf4', palette: { background: '240 253 244', surface: '220 252 231', primary: '22 163 74', text: '21 94 53' } },
  { id: 'latte', name: 'Latte', isDark: false, metaColor: '#fffbeb', palette: { background: '255 251 235', surface: '254 243 199', primary: '217 119 6', text: '113 63 18' } },
  { id: 'sky', name: 'Sky', isDark: false, metaColor: '#f0f9ff', palette: { background: '240 249 255', surface: '224 242 254', primary: '14 165 233', text: '7 89 133' } },
  { id: 'sunrise', name: 'Sunrise', isDark: false, metaColor: '#fffbeb', palette: { background: '255 251 235', surface: '254 243 199', primary: '249 115 22', text: '124 45 18' } },
  { id: 'lavender', name: 'Lavender', isDark: false, metaColor: '#f5f3ff', palette: { background: '245 243 255', surface: '237 233 254', primary: '124 58 237', text: '76 29 149' } },
  { id: 'terracotta', name: 'Terracotta', isDark: false, metaColor: '#faf3e8', palette: { background: '250 243 232', surface: '245 233 218', primary: '226 114 91', text: '93 64 55' } },
  { id: 'alabaster', name: 'Alabaster', isDark: false, metaColor: '#fcfcfc', palette: { background: '252 252 252', surface: '255 255 255', primary: '96 165 250', text: '50 50 50' } },
  { id: 'dark', name: 'Dark', isDark: true, metaColor: '#111827', palette: { background: '17 24 39', surface: '31 41 55', primary: '37 99 235', text: '243 244 246' } },
  { id: 'espresso', name: 'Espresso', isDark: true, metaColor: '#211713', palette: { background: '33 23 19', surface: '58 45 39', primary: '196 154 108', text: '224 213 208' } },
  { id: 'midnight', name: 'Midnight', isDark: true, metaColor: '#0c0d11', palette: { background: '12 13 17', surface: '26 27 38', primary: '133 137 230', text: '200 201 215' } }
];


interface ThemeContextType {
  themeId: ThemeId;
  setThemeById: (id: ThemeId) => void;
  currentTheme: Theme;
  customThemes: Theme[];
  addCustomTheme: (theme: Theme) => void;
  deleteCustomTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const applyTheme = (themeId: ThemeId, customThemes: Theme[] = []) => {
  let theme = themes.find(t => t.id === themeId);
  
  // If not a built-in theme, check custom themes
  if (!theme) {
    theme = customThemes.find(t => t.id === themeId);
  }
  
  // Default to system if still not found
  if (!theme) theme = themes[0]; 

  const root = window.document.documentElement;
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  let isDark;
  let metaColor;

  // Determine dark mode status and theme class
  if (theme.id === 'system') {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    metaColor = isDark ? theme.metaColorDark! : theme.metaColor;
  } else {
    isDark = theme.isDark;
    metaColor = theme.metaColor;
  }

  // Clean up all possible theme classes first
  themes.forEach(t => {
    if (t.id !== 'system') root.classList.remove(`theme-${t.id}`);
  });
  // Also remove custom themes (they might reuse IDs or just not have a class if dynamically applied)
  customThemes.forEach(t => root.classList.remove(`theme-${t.id}`));
  
  // Also remove old bugged classes just in case
  root.classList.remove('theme-dark', 'theme-light');

  root.classList.toggle('dark', isDark);

  if (themeColorMeta && metaColor) {
    themeColorMeta.setAttribute('content', metaColor);
  }

  // For custom themes, we need to set CSS variables directly on the root element
  if (theme.isCustom) {
      // Clear specific built-in theme classes to avoid conflict
      root.classList.add(`theme-${theme.id}`); // Mostly for tracking, styles applied below
      
      const p = theme.palette;
      root.style.setProperty('--color-background', p.background);
      root.style.setProperty('--color-surface', p.surface);
      root.style.setProperty('--color-primary', p.primary);
      root.style.setProperty('--color-text', p.text);
      // Derive hover/border/muted slightly if not explicitly provided (simplified for custom themes)
      // For a robust implementation we might want to generate these or let user pick.
      // For now, we reuse primary for hover or just let it cascade if we didn't set it?
      // No, we must set them or they fall back to :root defaults which might look weird.
      root.style.setProperty('--color-primary-hover', p.primary); // Simplified
      root.style.setProperty('--color-text-muted', p.text); // Simplified, rely on opacity in Tailwind if possible, or just same color
      root.style.setProperty('--color-border', p.surface); // Simplified
      if (p.onPrimary) {
          root.style.setProperty('--color-on-primary', p.onPrimary);
      } else {
          root.style.setProperty('--color-on-primary', '255 255 255');
      }
  } else {
      // For built-in themes, remove inline styles so CSS classes take over
      root.style.removeProperty('--color-background');
      root.style.removeProperty('--color-surface');
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-text');
      root.style.removeProperty('--color-primary-hover');
      root.style.removeProperty('--color-text-muted');
      root.style.removeProperty('--color-border');
      root.style.removeProperty('--color-on-primary');

      if (theme.id !== 'system') {
        root.classList.add(`theme-${theme.id}`);
      }
  }
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load custom themes first
  const [customThemes, setCustomThemes] = useState<Theme[]>(() => {
      try {
          const saved = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
          return saved ? JSON.parse(saved) : [];
      } catch (e) {
          return [];
      }
  });

  const [themeId, setThemeId] = useState<ThemeId>(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
      return themes.some(t => t.id === savedTheme) || customThemes.some(t => t.id === savedTheme) ? savedTheme : 'system';
    } catch (e) {
      console.error("Could not access localStorage. Defaulting to 'system'.", e);
      return 'system';
    }
  });

  // Persist custom themes whenever they change
  useEffect(() => {
      localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(customThemes));
  }, [customThemes]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch (e) {
       console.error("Could not set theme in localStorage.", e);
    }
    applyTheme(themeId, customThemes);
  }, [themeId, customThemes]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      let currentThemeId: ThemeId = 'system';
       try {
        currentThemeId = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeId) || 'system';
      } catch (e) { /* silent fail */ }

      if (currentThemeId === 'system') {
        applyTheme('system', customThemes);
      }
    };
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [customThemes]);

  const setThemeById = useCallback((id: ThemeId) => {
    setThemeId(id);
  }, []);

  const addCustomTheme = useCallback((theme: Theme) => {
      setCustomThemes(prev => [...prev, theme]);
      setThemeId(theme.id); // Auto-select new theme
  }, []);

  const deleteCustomTheme = useCallback((id: string) => {
      setCustomThemes(prev => prev.filter(t => t.id !== id));
      if (themeId === id) {
          setThemeId('system');
      }
  }, [themeId]);

  const currentTheme = themes.find(t => t.id === themeId) || customThemes.find(t => t.id === themeId) || themes[0];

  return (
    <ThemeContext.Provider value={{ themeId, setThemeById, currentTheme, customThemes, addCustomTheme, deleteCustomTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
