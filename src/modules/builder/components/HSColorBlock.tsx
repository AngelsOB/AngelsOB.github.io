import { hsTokens } from "../tokens";

type Shape =
  | "circle"
  | "square"
  | "rounded-square"
  | "triangle"
  | "half-circle-up"
  | "half-circle-down"
  | "pill"
  | "arch";

interface Props {
  shape: Shape;
  color: string;
  size?: number;
  rotate?: number;
  className?: string;
}

export default function HSColorBlock({
  shape,
  color,
  size = 64,
  rotate,
  className,
}: Props) {
  const ink = hsTokens.ink;
  const stroke = 2;
  const style = rotate
    ? { transform: `rotate(${rotate}deg)`, display: "inline-block" }
    : { display: "inline-block" as const };

  if (shape === "circle") {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 100 100" style={style} aria-hidden>
        <circle cx="50" cy="50" r="48" fill={color} stroke={ink} strokeWidth={stroke} />
      </svg>
    );
  }
  if (shape === "square") {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 100 100" style={style} aria-hidden>
        <rect x="2" y="2" width="96" height="96" fill={color} stroke={ink} strokeWidth={stroke} />
      </svg>
    );
  }
  if (shape === "rounded-square") {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 100 100" style={style} aria-hidden>
        <rect x="2" y="2" width="96" height="96" rx="14" ry="14" fill={color} stroke={ink} strokeWidth={stroke} />
      </svg>
    );
  }
  if (shape === "triangle") {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 100 100" style={style} aria-hidden>
        <polygon points="50,4 96,96 4,96" fill={color} stroke={ink} strokeWidth={stroke} strokeLinejoin="round" />
      </svg>
    );
  }
  if (shape === "half-circle-up") {
    return (
      <svg className={className} width={size} height={size / 2} viewBox="0 0 100 50" style={style} aria-hidden>
        <path d="M 2 50 A 48 48 0 0 1 98 50 Z" fill={color} stroke={ink} strokeWidth={stroke} />
      </svg>
    );
  }
  if (shape === "half-circle-down") {
    return (
      <svg className={className} width={size} height={size / 2} viewBox="0 0 100 50" style={style} aria-hidden>
        <path d="M 2 0 L 98 0 A 48 48 0 0 1 2 0 Z" fill={color} stroke={ink} strokeWidth={stroke} />
      </svg>
    );
  }
  if (shape === "pill") {
    return (
      <svg className={className} width={size} height={size / 2} viewBox="0 0 100 50" style={style} aria-hidden>
        <rect x="2" y="2" width="96" height="46" rx="23" ry="23" fill={color} stroke={ink} strokeWidth={stroke} />
      </svg>
    );
  }
  // arch
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" style={style} aria-hidden>
      <path
        d="M 2 98 L 2 50 A 48 48 0 0 1 98 50 L 98 98 Z"
        fill={color}
        stroke={ink}
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
    </svg>
  );
}
