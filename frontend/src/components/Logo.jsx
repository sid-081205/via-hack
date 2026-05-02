/**
 * via wordmark logo
 *
 * Inline SVG so it renders crisp at any size without depending on a PNG file.
 * The "i" is dotless — the paper plane is the tittle, with a dotted trail
 * curving in from behind it.
 */
export default function Logo({ size = 32, variant = "light", showTrail = true }) {
  const inkColor = variant === "dark" ? "var(--paper)" : "var(--ink)";
  const trailColor = variant === "dark" ? "var(--soft-green)" : "var(--accent)";

  const width = size * 2.5;
  const height = size;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 80"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}
      aria-label="via"
    >
      <text
        x="10"
        y="68"
        fontFamily="var(--font-display)"
        fontSize="78"
        fontWeight="500"
        fill={inkColor}
        letterSpacing="-3"
      >
        vıa
      </text>

      {showTrail && (
        <path
          d="M30 18 Q 48 14, 60 8"
          stroke={trailColor}
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="0.1 5"
          opacity="0.85"
        />
      )}

      <g transform="translate(72, 12) rotate(-20) translate(-18, -10)">
        <path
          d="M2 12 L36 2 L24 12 Z"
          fill="var(--plane-top)"
          stroke={inkColor}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M2 12 L24 12 L36 22 Z"
          fill="var(--accent)"
          stroke={inkColor}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M2 12 L24 12"
          stroke={inkColor}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
