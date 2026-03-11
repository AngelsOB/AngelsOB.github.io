'use client';

/**
 * Unified Theme Toggle
 *
 * Single dropdown for light/dark mode and color palette selection.
 */

import { useState, useRef, useEffect } from 'react';
import { useThemeStore, type Palette } from '../stores/useThemeStore';

type PaletteOption = {
  id: Palette;
  label: string;
  swatches: [string, string, string]; // [bg, accent, text]
};

const PALETTES: PaletteOption[] = [
  { id: 'default',  label: 'Default',  swatches: ['#FCF9F4', '#FB923C', '#1A1814'] },
  { id: 'vintage',  label: 'Vintage',  swatches: ['#FFF8F0', '#D08C46', '#3B3833'] },
  { id: 'midnight', label: 'Midnight', swatches: ['#F0F3F9', '#3C82F6', '#1E2841'] },
  { id: 'forest',   label: 'Forest',   swatches: ['#F3F7F0', '#378C46', '#23321E'] },
  { id: 'copper',   label: 'Copper',   swatches: ['#FAF5EE', '#BE6E28', '#372616'] },
  { id: 'ink',      label: 'Ink',      swatches: ['#F8F8FA', '#2D2D37', '#121216'] },
  { id: 'sahara',   label: 'Sahara',   swatches: ['#FCF7EE', '#C35F37', '#41301E'] },
  { id: 'reactive', label: 'Reactive', swatches: ['#FCF7F0', '#D2A03C', '#322614'] },
];

export default function ThemeToggle() {
  const { resolvedTheme, palette, setTheme, setPalette } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const currentPalette = PALETTES.find(p => p.id === palette) ?? PALETTES[0];

  return (
    <div className="relative" ref={ref}>
      {/* Trigger — swatch dots + mode indicator */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-black/8 dark:hover:bg-white/8 transition-colors"
        aria-label="Theme settings"
        aria-expanded={open}
      >
        <div className="flex gap-[3px]">
          {currentPalette.swatches.map((color, i) => (
            <div
              key={i}
              className="w-[9px] h-[9px] rounded-full ring-1 ring-black/10 dark:ring-white/15"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        {/* Small chevron */}
        <svg className="w-3 h-3 text-[var(--fg-muted)]" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 max-h-[420px] overflow-y-auto rounded-xl bg-[var(--card)] border border-[rgb(var(--border))] shadow-[var(--shadow-elevated)] p-1.5 z-50">
          {/* Mode section */}
          <div className="px-2.5 pt-1 pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--fg-muted)]">
              Mode
            </span>
          </div>
          <div className="flex gap-1 px-1.5 pb-2">
            <button
              onClick={() => { setTheme('light'); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                resolvedTheme === 'light'
                  ? 'bg-[color-mix(in_oklch,var(--coral-600)_15%,transparent)] text-[var(--coral-600)]'
                  : 'text-[var(--fg-muted)] hover:bg-[color-mix(in_oklch,var(--fg-strong)_8%,transparent)]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
              </svg>
              Light
            </button>
            <button
              onClick={() => { setTheme('dark'); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                resolvedTheme === 'dark'
                  ? 'bg-[color-mix(in_oklch,var(--coral-600)_15%,transparent)] text-[var(--coral-600)]'
                  : 'text-[var(--fg-muted)] hover:bg-[color-mix(in_oklch,var(--fg-strong)_8%,transparent)]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
              Dark
            </button>
          </div>

          {/* Divider */}
          <div className="mx-2 border-t border-[rgb(var(--border))]" />

          {/* Palette section */}
          <div className="px-2.5 pt-2 pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--fg-muted)]">
              Palette
            </span>
          </div>
          {PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => { setPalette(p.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                palette === p.id
                  ? 'bg-[color-mix(in_oklch,var(--coral-600)_12%,transparent)] text-[var(--fg-strong)] font-medium'
                  : 'text-[var(--fg-muted)] hover:bg-[color-mix(in_oklch,var(--fg-strong)_6%,transparent)]'
              }`}
            >
              <div className="flex gap-[3px]">
                {p.swatches.map((color, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
