import { cn } from "@/lib/utils";

export default function Metric({ label, value, sub, tone = "neutral", className }) {
  const tones = {
    ok: "ma-ok-text",
    warn: "ma-warn-text",
    err: "ma-err-text",
    info: "ma-info-text",
    emotion: "ma-emotion-text",
    neutral: "text-slate-100",
  };
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] ma-faint">{label}</div>
      <div className={cn("mt-1 font-mono text-xl tabular-nums leading-tight", tones[tone])}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs ma-muted">{sub}</div>}
    </div>
  );
}