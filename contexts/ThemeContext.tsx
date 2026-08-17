'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'leadops-theme';

type ThemeContextValue = {
  darkMode: boolean;
  toggleDarkMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const nextDark = stored !== 'light';
    setDarkMode(nextDark);
    applyTheme(nextDark);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
