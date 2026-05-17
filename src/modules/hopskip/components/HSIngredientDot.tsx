import { hsTokens } from "../tokens";

type Shape = "circle" | "square" | "triangle" | "half-up" | "quarter";

interface Props {
  color: string;
  size?: number;
  shape?: Shape;
  className?: string;
  title?: string;
}

export default function HSIngredientDot({
  color,
  size = 14,
  shape = "circle",
  className,
  title,
}: Props) {
  const ink = hsTokens.ink;

  if (shape === "square") {
    return (
      <span
        className={className}
        title={title}
        aria-hidden
        style={{
          width: size,
          height: size,
          background: color,
          border: `1px solid ${ink}`,
          borderRadius: 2,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
    );
  }

  if (shape === "triangle") {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 20 20"
        aria-hidden
        style={{ display: "inline-block", flexShrink: 0 }}
      >
        <polygon
          points="10,1 19,19 1,19"
          fill={color}
          stroke={ink}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (shape === "half-up") {
    return (
      <svg
        className={className}
        width={size}
        height={size / 2}
        viewBox="0 0 20 10"
        aria-hidden
        style={{ display: "inline-block", flexShrink: 0 }}
      >
        <path d="M 0 10 A 10 10 0 0 1 20 10 Z" fill={color} stroke={ink} strokeWidth={1.4} />
      </svg>
    );
  }

  if (shape === "quarter") {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 20 20"
        aria-hidden
        style={{ display: "inline-block", flexShrink: 0 }}
      >
        <path d="M 0 20 L 0 0 A 20 20 0 0 1 20 20 Z" fill={color} stroke={ink} strokeWidth={1.4} />
      </svg>
    );
  }

  // circle default
  return (
    <span
      className={className}
      title={title}
      aria-hidden
      style={{
        width: size,
        height: size,
        background: color,
        border: `1px solid ${ink}`,
        borderRadius: 999,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}
