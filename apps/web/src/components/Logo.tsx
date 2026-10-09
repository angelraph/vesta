import { useId } from "react";

/**
 * The Vesta mark: a roof over a V, with a lit window. `onDark` swaps the
 * window to cream for dark backgrounds; on light ones it's ink.
 */
export function Mark({ size = 40, animated = false, onDark = false }: { size?: number; animated?: boolean; onDark?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={animated ? "mark-alive" : undefined}>
      <defs>
        <linearGradient id={`${id}r`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0e9f86" />
          <stop offset="1" stopColor="#5ad99a" />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#46ecb8" />
          <stop offset="1" stopColor="#0b9785" />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde3a7" />
          <stop offset="1" stopColor="#eec474" />
        </linearGradient>
      </defs>
      <path d="M7 27 32 8.5 57 27" fill="none" stroke={`url(#${id}r)`} strokeWidth="9.5" strokeLinecap="round" strokeLinejoin="round" className="mark-roof" />
      <g fill={onDark ? "#f3ecdf" : "var(--ink)"} className="mark-window">
        <rect x="28.6" y="17.6" width="3.1" height="3.1" rx="0.5" />
        <rect x="32.3" y="17.6" width="3.1" height="3.1" rx="0.5" />
        <rect x="28.6" y="21.3" width="3.1" height="3.1" rx="0.5" />
        <rect x="32.3" y="21.3" width="3.1" height="3.1" rx="0.5" />
      </g>
      <path d="M46.6 32.2h12c1.6 0 2.4 1.8 1.3 3L37.2 58.6c-1.9 1.9-5.2.8-4.8-1.8Z" fill={`url(#${id}g)`} />
      <path
        d="M2.6 35C8.2 31.4 15.4 31.6 20.4 36.6l15 17.8c1.6 2 .6 5.6-2.4 6.1-4.6.7-9.2-1.5-12.2-5L4.6 38.6C3.1 37.1 2 35.9 2.6 35Z"
        fill={`url(#${id}l)`}
      />
    </svg>
  );
}

export function Wordmark({ size = 28, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark size={size * 1.15} onDark={onDark} />
      <span className={`font-extrabold tracking-[-0.03em] ${onDark ? "text-[#f6f1e7]" : "text-ink"}`} style={{ fontSize: size }}>
        Vesta
      </span>
    </span>
  );
}
