"use client";

import { useEffect, useState } from "react";

interface TypewriterProps {
  text: string;
  /** ms between each character starting its fade-in */
  charInterval?: number;
  /** ms before the animation begins */
  startDelay?: number;
  /** ms each character takes to fade from 0→1 */
  fadeDuration?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function Typewriter({
  text,
  charInterval = 8,
  startDelay = 100,
  fadeDuration = 120,
  className,
  style,
}: TypewriterProps) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setStarted(true), startDelay);
    return () => clearTimeout(timeout);
  }, [startDelay]);

  return (
    <p className={className} style={style} aria-label={text}>
      {text.split("").map((char, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            opacity: started ? 1 : 0,
            transition: `opacity ${fadeDuration}ms ease-in`,
            transitionDelay: started ? `${i * charInterval}ms` : "0ms",
          }}
        >
          {char}
        </span>
      ))}
    </p>
  );
}
