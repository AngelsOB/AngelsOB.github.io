'use client';

import { useEffect, useState } from "react";

type Props = {
  value: number | undefined | null;
  onChange: (next: number) => void;
  suffix: string; // e.g. " g", " %", "°C", " min", " days"
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  suffixClassName?: string; // optional override for position/size
  readOnly?: boolean;
};

export default function InputWithSuffix({
  value,
  onChange,
  suffix,
  step,
  min,
  max,
  placeholder,
  className,
  suffixClassName,
  readOnly,
}: Props) {
  const toText = (v: number | undefined | null): string =>
    Number.isFinite(v as number) ? String(v) : "";
  const [text, setText] = useState<string>(toText(value));

  useEffect(() => {
    setText(toText(value));
  }, [value]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        className="rounded-md border px-3 py-2 pr-6 w-full sm:text-right text-left focus-glow"
        type="number"
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        value={text}
        readOnly={readOnly}
        onChange={(e) => {
          const v = e.currentTarget.value;
          setText(v);
          const n = e.currentTarget.valueAsNumber;
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={(e) => {
          // Normalize on blur: if empty, keep empty display but do not force zero
          // Parent state remains last valid number until a new valid value is entered
          const v = e.currentTarget.value;
          if (v === "") {
            // keep as empty; parent remains unchanged
            return;
          }
          const n = e.currentTarget.valueAsNumber;
          if (Number.isFinite(n)) {
            // ensure text normalized
            setText(String(n));
          }
        }}
      />
      <span
        className={
          `pointer-events-none absolute inset-y-0 z-10 flex items-center text-neutral-500 ` +
          (suffixClassName ?? "right-8 text-xs")
        }
      >
        {suffix}
      </span>
    </div>
  );
}
