/** LandFinder emblem: house outline, location pin, and the land curve beneath. */
export function Emblem({ className = "", color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="21 19 58 58" className={className} aria-hidden>
      <path d="M33 60V44.5c0-1 .5-2 1.3-2.6L48 31.6a3.4 3.4 0 0 1 4 0l13.7 10.3c.8.6 1.3 1.6 1.3 2.6V61" fill="none" stroke={color} strokeWidth="5.2" strokeLinejoin="round" />
      <path d="M50 37.8a7.4 7.4 0 0 0-7.4 7.4c0 5 7.4 13 7.4 13s7.4-8 7.4-13a7.4 7.4 0 0 0-7.4-7.4Zm0 4.6a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z" fill={color} />
      <path d="M24 66.4C33 61 43 58.6 52 58.8c9 .2 17.4 3 23.6 7.4-8-2.4-16-3.8-24.4-3.8-9.2 0-18.4 1.4-27.2 4Z" fill={color} />
    </svg>
  );
}
