'use client';

import { useRef, useLayoutEffect, useState } from 'react';

interface SegmentedToggleOption {
  label: React.ReactNode;
  value: string;
}

interface SegmentedToggleProps {
  options: SegmentedToggleOption[];
  value: string;
  onChange: (value: string) => void;
  size?: 'default' | 'lg';
  className?: string;
}

export function SegmentedToggle({
  options,
  value,
  onChange,
  size,
  className,
}: SegmentedToggleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; right: number } | null>(null);
  const [animated, setAnimated] = useState(false);
  const prevIdx = useRef(-1);
  const [dirClass, setDirClass] = useState('');

  const activeIdx = options.findIndex((o) => o.value === value);

  // Measure pill position to match the active button exactly
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '[data-toggle-btn]',
    );
    const btn = buttons[activeIdx];
    if (!btn) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setPill({
      left: bRect.left - cRect.left,
      right: cRect.right - bRect.right,
    });

    // Track direction for gooey + spring animations
    if (prevIdx.current >= 0 && prevIdx.current !== activeIdx) {
      setDirClass(
        activeIdx > prevIdx.current ? 'is-moving-right' : 'is-moving-left',
      );
    }
    prevIdx.current = activeIdx;
  }, [activeIdx]);

  // Remeasure on resize
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const buttons = container.querySelectorAll<HTMLButtonElement>(
        '[data-toggle-btn]',
      );
      const btn = buttons[activeIdx];
      if (!btn) return;
      const cRect = container.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      setPill({
        left: bRect.left - cRect.left,
        right: cRect.right - bRect.right,
      });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [activeIdx]);

  const cls = [
    'brew-segmented-toggle',
    size === 'lg' && 'brew-segmented-toggle--lg',
    dirClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={containerRef} className={cls} onAnimationEnd={() => setDirClass('')}>
      {pill && (
        <div
          className={`brew-toggle-pill${animated ? '' : ' no-anim'}`}
          style={{ left: pill.left, right: pill.right }}
        />
      )}
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          data-toggle-btn=""
          className={opt.value === value ? 'is-active' : ''}
          onClick={() => {
            if (!animated) setAnimated(true);
            onChange(opt.value);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
