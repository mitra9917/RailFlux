/** Original marks in AWS Architecture Icon colors — not copied AWS artwork. */

import type { ReactNode } from 'react';

type MarkProps = { className?: string };

function Tile({
  fill,
  className,
  children,
}: {
  fill: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="6" fill={fill} />
      {children}
    </svg>
  );
}

export function CloudFrontMark({ className }: MarkProps) {
  return (
    <Tile fill="#8C4FFF" className={className}>
      <circle cx="16" cy="16" r="7.5" fill="none" stroke="#fff" strokeWidth="1.6" />
      <ellipse cx="16" cy="16" rx="3.2" ry="7.5" fill="none" stroke="#fff" strokeWidth="1.4" />
      <path d="M9 16h14M10.4 12h11.2M10.4 20h11.2" stroke="#fff" strokeWidth="1.3" />
    </Tile>
  );
}

export function AlbMark({ className }: MarkProps) {
  return (
    <Tile fill="#8C4FFF" className={className}>
      <circle cx="16" cy="8.5" r="2.2" fill="#fff" />
      <circle cx="8.5" cy="23" r="2.2" fill="#fff" />
      <circle cx="16" cy="23" r="2.2" fill="#fff" />
      <circle cx="23.5" cy="23" r="2.2" fill="#fff" />
      <path d="M16 10.7v5.2M16 16H8.5v4.5M16 16h7.5v4.5" stroke="#fff" strokeWidth="1.5" />
    </Tile>
  );
}

export function EcsMark({ className }: MarkProps) {
  return (
    <Tile fill="#FF9900" className={className}>
      <rect x="7" y="10" width="10" height="8" rx="1.2" fill="none" stroke="#fff" strokeWidth="1.5" />
      <rect x="15" y="14" width="10" height="8" rx="1.2" fill="none" stroke="#fff" strokeWidth="1.5" />
    </Tile>
  );
}

export function ElastiCacheMark({ className }: MarkProps) {
  return (
    <Tile fill="#C925D1" className={className}>
      <ellipse cx="16" cy="11" rx="7" ry="3" fill="none" stroke="#fff" strokeWidth="1.5" />
      <path d="M9 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" fill="none" stroke="#fff" strokeWidth="1.5" />
      <path d="M16 9.5l1.4 2.6 2.9.3-2.2 2 0.6 2.8L16 15.8l-2.7 1.4.6-2.8-2.2-2 2.9-.3z" fill="#fff" />
    </Tile>
  );
}

export function RdsMark({ className }: MarkProps) {
  return (
    <Tile fill="#3B48CC" className={className}>
      <ellipse cx="16" cy="10" rx="7" ry="3.1" fill="none" stroke="#fff" strokeWidth="1.6" />
      <path d="M9 10v8.5c0 1.7 3.1 3.1 7 3.1s7-1.4 7-3.1V10" fill="none" stroke="#fff" strokeWidth="1.6" />
      <path d="M9 14.2c0 1.7 3.1 3.1 7 3.1s7-1.4 7-3.1" fill="none" stroke="#fff" strokeWidth="1.4" />
    </Tile>
  );
}

export function SqsMark({ className }: MarkProps) {
  return (
    <Tile fill="#E7157B" className={className}>
      <path d="M8 11h10l3-2.2v14.4L18 21H8z" fill="none" stroke="#fff" strokeWidth="1.5" />
      <path d="M11 15h5M11 18h5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </Tile>
  );
}

export function S3Mark({ className }: MarkProps) {
  return (
    <Tile fill="#3F8624" className={className}>
      <path
        d="M8 12.5 16 8.5l8 4v7l-8 4-8-4z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 12.5 16 16.5 24 12.5" fill="none" stroke="#fff" strokeWidth="1.4" />
    </Tile>
  );
}

export function WafMark({ className }: MarkProps) {
  return (
    <Tile fill="#DD344C" className={className}>
      <path
        d="M16 7.5 24 11v6.2c0 4.2-3.4 6.6-8 8.3-4.6-1.7-8-4.1-8-8.3V11z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Tile>
  );
}
