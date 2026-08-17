'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const DEFAULT_CLASS =
  'flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-[#121214] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200';

export function ThemeToggle({ className }: { className?: string }) {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleDarkMode}
      className={className ?? DEFAULT_CLASS}
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
