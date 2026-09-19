import { cn } from "@/lib/utils";

const TONES = {
  ok: "ma-ok-soft",
  warn: "ma-warn-soft",
  err: "ma-err-soft",
  info: "ma-info-soft",
  emotion: "ma-emotion-soft",
  neutral: "ma-neutral-soft",
};

export default function StatusBadge({ tone = "neutral", label, dot = true, className }) {
  return (
    <span
      className={cn(
        "ma-badge",
        tone === "emotion" && "ma-motive ma-motive-glow-emotion",
        TONES[tone] || TONES.neutral,
        className
      )}
    >
      {dot && <span className="ma-badge-dot" aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}