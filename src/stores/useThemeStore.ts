/**
 * Theme Store
 *
 * Manages light/dark mode and color palette with localStorage persistence.
 * Applies 'dark' class and 'palette-*' classes to document.documentElement.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';
export type Palette = 'default' | 'vintage' | 'midnight' | 'forest' | 'copper' | 'ink' | 'sahara';

const PALETTE_CLASSES = ['palette-vintage', 'palette-midnight', 'palette-forest', 'palette-copper', 'palette-ink', 'palette-sahara'] as const;

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  palette: Palette;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setPalette: (palette: Palette) => void;
}

// Get system preference
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Apply theme to document
function applyTheme(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;

  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Apply palette class to document
function applyPalette(palette: Palette) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  PALETTE_CLASSES.forEach(cls => root.classList.remove(cls));
  if (palette !== 'copper') {
    root.classList.add(`palette-${palette}`);
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      resolvedTheme: 'light',
      palette: 'copper',

      setTheme: (theme: Theme) => {
        const resolved = theme === 'system' ? getSystemTheme() : theme;
        applyTheme(resolved);
        set({ theme, resolvedTheme: resolved });
      },

      toggleTheme: () => {
        const current = get().theme;
        const next = current === 'dark' ? 'light' : 'dark';
        get().setTheme(next);
      },

      setPalette: (palette: Palette) => {
        applyPalette(palette);
        set({ palette });
      },
    }),
    {
      name: 'beer-app-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = state.theme === 'system' ? getSystemTheme() : state.theme;
          applyTheme(resolved);
          state.resolvedTheme = resolved;
          applyPalette(state.palette);
        }
      },
    }
  )
);

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const state = useThemeStore.getState();
    if (state.theme === 'system') {
      const resolved = e.matches ? 'dark' : 'light';
      applyTheme(resolved);
      useThemeStore.setState({ resolvedTheme: resolved });
    }
  });
}
