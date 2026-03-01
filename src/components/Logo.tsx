import { Link } from "react-router-dom";

/**
 * Inline hop cone SVG — geometric, craft-brewery feel.
 * Uses currentColor so it inherits the parent's text/gradient color.
 */
function HopIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 28"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Central leaf / petal shapes — stacked like a hop cone */}
      {/* Bottom pair */}
      <ellipse
        cx="8.5"
        cy="20"
        rx="5"
        ry="3.2"
        transform="rotate(-20 8.5 20)"
        fill="currentColor"
        opacity="0.45"
      />
      <ellipse
        cx="15.5"
        cy="20"
        rx="5"
        ry="3.2"
        transform="rotate(20 15.5 20)"
        fill="currentColor"
        opacity="0.45"
      />
      {/* Middle-lower pair */}
      <ellipse
        cx="7.8"
        cy="15.8"
        rx="4.8"
        ry="3"
        transform="rotate(-15 7.8 15.8)"
        fill="currentColor"
        opacity="0.55"
      />
      <ellipse
        cx="16.2"
        cy="15.8"
        rx="4.8"
        ry="3"
        transform="rotate(15 16.2 15.8)"
        fill="currentColor"
        opacity="0.55"
      />
      {/* Middle pair */}
      <ellipse
        cx="8.5"
        cy="11.8"
        rx="4.5"
        ry="2.8"
        transform="rotate(-10 8.5 11.8)"
        fill="currentColor"
        opacity="0.65"
      />
      <ellipse
        cx="15.5"
        cy="11.8"
        rx="4.5"
        ry="2.8"
        transform="rotate(10 15.5 11.8)"
        fill="currentColor"
        opacity="0.65"
      />
      {/* Upper pair */}
      <ellipse
        cx="9.2"
        cy="8.2"
        rx="4"
        ry="2.5"
        transform="rotate(-8 9.2 8.2)"
        fill="currentColor"
        opacity="0.8"
      />
      <ellipse
        cx="14.8"
        cy="8.2"
        rx="4"
        ry="2.5"
        transform="rotate(8 14.8 8.2)"
        fill="currentColor"
        opacity="0.8"
      />
      {/* Tip */}
      <ellipse
        cx="12"
        cy="4.8"
        rx="3"
        ry="2.2"
        fill="currentColor"
        opacity="0.95"
      />
      {/* Tiny stem */}
      <line
        x1="12"
        y1="23"
        x2="12"
        y2="27"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

export default function Logo({ size = "default" }: { size?: "default" | "sm" }) {
  const iconSize = size === "sm" ? "h-4 w-auto" : "h-5 w-auto";
  const textSize =
    size === "sm"
      ? "text-base font-semibold tracking-tight"
      : "text-lg sm:text-xl font-semibold tracking-tight";

  return (
    <Link to="/" className="group inline-flex items-center gap-1.5">
      <span
        className="transition-transform duration-300 ease-out group-hover:rotate-[-12deg] group-hover:scale-110"
        style={{ color: 'var(--coral-500)' }}
      >
        <HopIcon className={iconSize} />
      </span>
      <span
        className={`${textSize} bg-clip-text text-transparent`}
        style={{ backgroundImage: 'linear-gradient(to right, var(--coral-400), var(--coral-600))' }}
      >
        Beer App
      </span>
    </Link>
  );
}
