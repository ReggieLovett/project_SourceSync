import { useId } from "react";

/**
 * The Source Sync mark: a crimson seal with two brush strokes carved out of it,
 * set like an equals sign. The answer and its source, in sync. A carved frame with
 * one chipped corner, and strokes of unequal weight, make it read as a stamped seal.
 * Same artwork as app/icon.svg (the favicon).
 */
export default function SyncSeal({ size = 40 }: { size?: number }) {
  const filter = `${useId()}-ink`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        {/* A slight displacement roughens the edges like ink pressed into paper. */}
        <filter id={filter} x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="11" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${filter})`}>
        <rect x="5" y="5" width="54" height="54" rx="2.5" fill="#b0281e" />
        <path d="M54.5 45V9.5h-45v45h39" fill="none" stroke="#f4f2ed" strokeWidth="1.8" />
        <path
          fill="#f4f2ed"
          d="M15 25.6C15 23.4 17.2 22.3 19.6 22.4L44.5 21.2C46.6 21.1 47.6 21.6 47.2 22.4C46.8 23.1 45.2 23.6 43.4 23.9L20.4 27.2C17.2 27.7 15 27.3 15 25.6Z"
        />
        <path
          fill="#f4f2ed"
          d="M14.2 39.4C14.6 37.2 17 36.6 20 36.7L46.5 36.3C49.4 36.2 51 37.1 50.4 38.9C50 40.1 49.1 40.6 48.3 41.6C47.9 42.2 47.1 42.4 46.5 41.9L45.4 41L20.2 42.6C16.6 42.8 13.9 41.7 14.2 39.4Z"
        />
      </g>
    </svg>
  );
}
