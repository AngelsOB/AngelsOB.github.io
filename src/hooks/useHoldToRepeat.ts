import { useCallback, useEffect, useRef } from "react";

/**
 * Returns pointer-event handlers that fire `callback` immediately on press,
 * then repeat it at an accelerating rate while the pointer is held down.
 *
 * Usage:
 *   const hold = useHoldToRepeat(() => nudge(1));
 *   <button {...hold}>+</button>
 */
export function useHoldToRepeat(
  callback: () => void,
  { initialDelay = 400, minInterval = 50, startInterval = 120 } = {},
) {
  // Always call the latest callback (avoids stale-closure issues where
  // `nudge` captures an old `value` from a previous render).
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeater = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (repeater.current) {
      clearTimeout(repeater.current);
      repeater.current = null;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    stop();
    // Fire once immediately
    callbackRef.current();

    let currentInterval = startInterval;

    const tick = () => {
      callbackRef.current();
      // Accelerate: shrink interval toward minInterval
      currentInterval = Math.max(minInterval, currentInterval * 0.85);
      repeater.current = setTimeout(tick, currentInterval);
    };

    // After the initial delay, start repeating
    timer.current = setTimeout(tick, initialDelay);
  }, [initialDelay, minInterval, startInterval, stop]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      start();
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  } as const;
}
