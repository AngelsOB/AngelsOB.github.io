'use client';

/**
 * AnimatedNumberInput — Drop-in <input type="number"> replacement with
 * a subtle scale pulse micro-interaction when the value changes via steppers.
 *
 * Wraps the input in a thin inline-flex span so `transform: scale()` applies
 * to the text visually (scaling a bare <input> has inconsistent results).
 */

import { useRef, useEffect, useState, type InputHTMLAttributes } from 'react';

interface AnimatedNumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function AnimatedNumberInput({
  value,
  onChange,
  className = '',
  ...inputProps
}: AnimatedNumberInputProps) {
  const [changed, setChanged] = useState(false);
  const prevRef = useRef(value);
  const isFirst = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      prevRef.current = value;
      return;
    }

    const prev = prevRef.current;
    prevRef.current = value;
    if (String(prev) === String(value)) return;

    // Snap to scaled-up state immediately, only shrink back
    // after the value has been stable for a beat
    if (timerRef.current) clearTimeout(timerRef.current);
    setChanged(true);
    timerRef.current = setTimeout(() => setChanged(false), 400);
  }, [value]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <span className={`ani-stepper-wrap${changed ? ' is-changed' : ''}`}>
      <input
        {...inputProps}
        type="number"
        value={value}
        onChange={onChange}
        className={className}
      />
    </span>
  );
}
