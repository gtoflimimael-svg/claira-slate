export function Logo({ size = 32, animated = true }: { size?: number; animated?: boolean }) {
  return (
    <svg
      data-logo={animated ? "" : undefined}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M62 28C42 28 26 42 26 60C26 78 42 92 62 92"
        fill="none"
        stroke="var(--cs-accent)"
        strokeWidth="12"
        strokeLinecap="round"
      ></path>
      <path
        d="M68 28C88 28 94 38 94 47C94 56 84 60 74 60C64 60 54 64 54 73C54 82 60 92 80 92"
        fill="none"
        stroke="var(--cs-logo-s)"
        strokeWidth="12"
        strokeLinecap="round"
      ></path>
    </svg>
  );
}
