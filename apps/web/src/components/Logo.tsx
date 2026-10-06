export function Mark({ size = 40, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M32 6 7 26v24a8 8 0 0 0 8 8h34a8 8 0 0 0 8-8V26L32 6Z"
        fill="none"
        stroke="var(--hearth)"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <g className={animated ? "flame" : undefined}>
        <path d="M32 22c5 6 9 10 9 16a9 9 0 0 1-18 0c0-4 2-7 4-9 0 3 1 5 3 6-1-5 0-9 2-13Z" fill="var(--ember)" />
        <path d="M32 36c2 2 3.5 3.5 3.5 5.5a3.5 3.5 0 0 1-7 0c0-1.6 1.2-3.2 3.5-5.5Z" fill="#f8c27d" />
      </g>
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark size={size * 1.2} />
      <span className="font-display font-semibold tracking-tight text-hearth" style={{ fontSize: size }}>
        Vesta
      </span>
    </span>
  );
}
