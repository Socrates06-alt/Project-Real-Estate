export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--brand)" />
        <path d="M8 15.5 16 9l8 6.5V24h-5.5v-5h-5v5H8z" fill="var(--brand-ink)" />
      </svg>
      <span className="text-[21px] font-semibold tracking-tight">Nilayam</span>
    </span>
  );
}
