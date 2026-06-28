'use client';

/**
 * Theme Store
 *
 * Manages light/dark mode and color palette with localStorage persistence.
 * Applies 'dark' class and 'palette-*' classes to document.documentElement.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';
export type Palette = 'default' | 'vintage' | 'midnight' | 'forest' | 'copper' | 'ink' | 'sahara' | 'reactive';

const PALETTE_CLASSES = ['palette-vintage', 'palette-midnight', 'palette-forest', 'palette-copper', 'palette-ink', 'palette-sahara', 'palette-reactive'] as const;

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

// --- Dark mode retirement -------------------------------------------------
// There's no UI to toggle dark mode anymore, so the large `.dark` CSS layer
// (src/index.css, builder/styles/{tokens,overrides}.css) and the palette system
// are kept DORMANT rather than deleted. While retired, every requested theme
// resolves to light, and any stale saved `dark`/`system` preference is reset
// (see the persist `version`/`migrate` below) so returning visitors aren't
// stuck dark with no toggle to escape.
//
// To bring dark mode back: set DARK_MODE_ENABLED = true and re-expose a control
// that calls setTheme(). Nothing else in this file needs to change.
const DARK_MODE_ENABLED = false;

// Resolve a requested theme to the mode actually applied. Light while retired.
function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (!DARK_MODE_ENABLED) return 'light';
  return theme === 'system' ? getSystemTheme() : theme;
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
        const resolved = resolveTheme(theme);
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
      // Bump when changing how persisted theme state is interpreted. v1 retires
      // dark mode: any previously-saved `dark`/`system` is rewritten to light so
      // returning visitors aren't stuck dark with no toggle to escape.
      version: 1,
      migrate: (persisted) => {
        const prev = (persisted ?? {}) as Partial<ThemeState>;
        // persist re-supplies the action functions on merge; restore data only.
        return { ...prev, theme: 'light', resolvedTheme: 'light' } as ThemeState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.theme);
          applyTheme(resolved);
          state.resolvedTheme = resolved;
          applyPalette(state.palette);
        }
      },
    }
  )
);

// Track OS theme changes. Only meaningful once dark mode is re-enabled and the
// user has picked 'system'; resolveTheme keeps this light while retired.
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const state = useThemeStore.getState();
    if (state.theme === 'system') {
      const resolved = resolveTheme('system');
      applyTheme(resolved);
      useThemeStore.setState({ resolvedTheme: resolved });
    }
  });
}
