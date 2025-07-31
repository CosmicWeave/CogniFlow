import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
const THEME_STORAGE_KEY = 'cogniflow-themeMode';

interface ThemeContextType {
  themeMode: ThemeMode;
  cycleThemeMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
        if (['light', 'dark', 'system'].includes(savedTheme)) {
          return savedTheme;
        }
      }
    } catch (e) {
      console.error("Could not access localStorage to get theme. Defaulting to 'system'.", e);
    }
    return 'system';
  });

  // Effect 1: Apply the theme based on the current themeMode.
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch (e) {
      console.error("Could not access localStorage to set theme.", e);
    }
    const root = window.document.documentElement;
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    
    let isDark;
    if (themeMode === 'light') {
      isDark = false;
    } else if (themeMode === 'dark') {
      isDark = true;
    } else { // 'system'
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    themeColorMeta?.setAttribute('content', isDark ? '#111827' : '#f9fafb');
  }, [themeMode]);

  // Effect 2: Manage the system theme change listener. This effect runs only once.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemChange = (event: MediaQueryListEvent) => {
      // This listener will fire regardless of our state, so we must check
      // if we are supposed to be in 'system' mode before acting.
      let currentMode: ThemeMode = 'system';
      try {
        currentMode = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode) || 'system';
      } catch (e) {
         // Silently fail if localStorage is not available
      }

      if (currentMode === 'system') {
        const root = window.document.documentElement;
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        const isDark = event.matches;
        if (isDark) {
          root.classList.add('dark');
          themeColorMeta?.setAttribute('content', '#111827');
        } else {
          root.classList.remove('dark');
          themeColorMeta?.setAttribute('content', '#f9fafb');
        }
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, []); // Empty dependency array ensures this runs only on mount/unmount.

  const cycleThemeMode = useCallback(() => {
    setThemeMode(prevMode => {
      if (prevMode === 'light') return 'dark';
      if (prevMode === 'dark') return 'system';
      return 'light'; // system -> light
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ themeMode, cycleThemeMode }}>
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
