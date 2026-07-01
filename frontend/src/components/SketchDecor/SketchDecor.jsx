/** Hand-drawn conceptual sketch accents — Japandi aesthetic */

export function SketchUnderline({ className = '' }) {
  return (
    <svg
      className={`sketch-underline ${className}`}
      viewBox="0 0 200 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M2 8C42 2 78 10 118 6C158 2 178 9 198 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SketchCircle({ className = '', size = 80 }) {
  return (
    <svg
      className={`sketch-circle ${className}`}
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden
    >
      <path
        d="M40 6C58 8 72 22 74 40C76 58 62 74 40 76C18 78 4 60 6 38C8 16 22 4 40 6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="3 4"
        opacity="0.35"
      />
    </svg>
  );
}

export function SketchFrame({ className = '' }) {
  return (
    <svg
      className={`sketch-frame ${className}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 8L8 4H92L96 8V92L92 96H8L4 92V8Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity="0.2"
      />
    </svg>
  );
}

export function SketchHeroAccent({ className = '' }) {
  return (
    <svg
      className={`sketch-hero-accent ${className}`}
      viewBox="0 0 320 200"
      fill="none"
      aria-hidden
    >
      <path
        d="M280 30C240 50 200 20 160 40C120 60 80 30 40 50"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.15"
      />
      <path
        d="M300 120C260 140 220 100 180 130C140 160 100 110 60 140"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.12"
      />
      <ellipse
        cx="260"
        cy="60"
        rx="48"
        ry="44"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="4 6"
        opacity="0.1"
      />
    </svg>
  );
}

export function SketchDocument({ className = '', size = 64 }) {
  return (
    <svg
      className={`sketch-document ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 8H40L52 20V56H12V8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M40 8V20H52" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 28H44M20 36H40M20 44H36" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
