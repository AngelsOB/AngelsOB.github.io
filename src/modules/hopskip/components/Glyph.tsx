import { hsTokens } from "../tokens";

export type GlyphKind =
  | "hop"
  | "water"
  | "malt"
  | "yeast"
  | "mug"
  | "drop"
  | "square"
  | "triangle"
  | "flame"
  | "scale"
  | "clock";

interface Props {
  kind: GlyphKind;
  size?: number;
  color?: string;
  className?: string;
}

export default function Glyph({
  kind,
  size = 28,
  color = "currentColor",
  className,
}: Props) {
  const ink = hsTokens.ink;
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    "aria-hidden": true as const,
    className,
  };

  switch (kind) {
    case "hop":
      return (
        <svg {...common}>
          <g stroke={ink} strokeWidth={1.6} fill={color}>
            <path d="M16 5c-3 0-5 2-5 4 0 1 1 2 2 2-2 1-3 3-3 5 0 2 2 4 3 4-2 1-2 3-2 5 0 3 2 5 5 5s5-2 5-5c0-2 0-4-2-5 1 0 3-2 3-4 0-2-1-4-3-5 1 0 2-1 2-2 0-2-2-4-5-4z" />
            <line x1="16" y1="26" x2="16" y2="30" />
          </g>
        </svg>
      );
    case "water":
      return (
        <svg {...common}>
          <path
            d="M16 4c-1 3-7 9-7 14a7 7 0 0014 0c0-5-6-11-7-14z"
            fill={color}
            stroke={ink}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </svg>
      );
    case "malt":
      return (
        <svg {...common}>
          <g stroke={ink} strokeWidth={1.6} fill={color} strokeLinejoin="round">
            <ellipse cx="16" cy="16" rx="6" ry="11" />
            <line x1="16" y1="6" x2="16" y2="26" />
          </g>
        </svg>
      );
    case "yeast":
      return (
        <svg {...common}>
          <g stroke={ink} strokeWidth={1.6} fill={color}>
            <circle cx="12" cy="12" r="5" />
            <circle cx="21" cy="18" r="4" />
            <circle cx="14" cy="22" r="3" />
          </g>
        </svg>
      );
    case "mug":
      return (
        <svg {...common}>
          <g stroke={ink} strokeWidth={1.6} fill={color}>
            <rect x="8" y="8" width="14" height="18" rx="1.5" />
            <path d="M22 12h3a3 3 0 010 6h-3" fill="none" />
            <path d="M11 12h8M11 16h8" stroke={ink} opacity="0.4" />
          </g>
        </svg>
      );
    case "drop":
      return (
        <svg {...common}>
          <path
            d="M16 4c-1 3-6 8-6 13a6 6 0 0012 0c0-5-5-10-6-13z"
            fill={color}
            stroke={ink}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </svg>
      );
    case "square":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="20" height="20" fill={color} stroke={ink} strokeWidth={1.6} />
        </svg>
      );
    case "triangle":
      return (
        <svg {...common}>
          <polygon
            points="16,4 28,27 4,27"
            fill={color}
            stroke={ink}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </svg>
      );
    case "flame":
      return (
        <svg {...common}>
          <path
            d="M16 4c0 4-6 6-6 12a6 6 0 0012 0c0-3-2-5-3-7 0 2-2 2-2 0 0-3-1-4-1-5z"
            fill={color}
            stroke={ink}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </svg>
      );
    case "scale":
      return (
        <svg {...common}>
          <g stroke={ink} strokeWidth={1.6} fill="none">
            <line x1="6" y1="10" x2="26" y2="10" />
            <line x1="16" y1="10" x2="16" y2="26" />
            <circle cx="16" cy="26" r="2" fill={color} />
            <polygon points="10,10 6,18 14,18" fill={color} />
            <polygon points="22,10 18,18 26,18" fill={color} />
          </g>
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <g stroke={ink} strokeWidth={1.6}>
            <circle cx="16" cy="16" r="10" fill={color} />
            <line x1="16" y1="16" x2="16" y2="10" />
            <line x1="16" y1="16" x2="21" y2="18" />
          </g>
        </svg>
      );
  }
}
