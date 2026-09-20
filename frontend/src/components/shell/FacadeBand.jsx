export default function FacadeBand({ items, className = "" }) {
  const text = Array.isArray(items) && items.length ? items.join("  ·  ") : "THIS MOMENT STUDIO";
  const segment = `${text}  ·  `;
  return (
    <div
      className={`ma-motive-marquee ma-facade-dissolve border-y ma-hairline bg-black/40 py-1.5 ${className}`}
      aria-hidden="true"
      data-testid="facade-band"
    >
      <div className="ma-marquee-track ma-faint font-mono text-[0.625rem] uppercase tracking-[0.22em]">
        <span className="px-3">{segment.repeat(4)}</span>
        <span className="px-3">{segment.repeat(4)}</span>
      </div>
    </div>
  );
}

export function InsertCoinButton({ to = "/music", label = "INSERT COIN · PRESS START" }) {
  return (
    <a
      href={to}
      className="ma-motive ma-motive-press ma-motive-glow ma-ring-focus inline-flex items-center gap-2 rounded-sm border border-[#d4af37]/50 bg-[#d4af37]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#f1d574]"
    >
      <span className="ma-live-dot" aria-hidden="true" />
      {label}
    </a>
  );
}
