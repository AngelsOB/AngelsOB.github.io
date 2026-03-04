'use client';

import { useEffect, useState } from 'react';

interface EditableNumberProps {
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  step?: number;
  format?: (value: number) => string;
  suffix?: string;
  placeholder?: string;
  className?: string;
}

export function EditableNumber({
  value,
  onCommit,
  step = 0.1,
  format,
  suffix,
  placeholder = '—',
  className = '',
}: EditableNumberProps) {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));

  useEffect(() => {
    setDraft(value === undefined ? '' : String(value));
  }, [value]);

  const displayValue =
    value === undefined
      ? placeholder
      : `${format ? format(value) : value}${suffix ?? ''}`;

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      onCommit(undefined);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) {
      setDraft(value === undefined ? '' : String(value));
      return;
    }
    onCommit(parsed);
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm ${className}`}>{displayValue}</span>
      <input
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        step={step}
        className="w-24 px-2 py-1 text-sm border border-[rgb(var(--border))] rounded bg-[rgb(var(--bg))] text-right"
      />
    </div>
  );
}
