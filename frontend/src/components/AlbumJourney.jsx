import { Map, TrendingUp } from "lucide-react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

const ROLE_CLASS = {
  opener: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  body: "bg-white/5 text-stone-300 border-white/10",
  lift: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  interlude: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  climax: "bg-[#d4af37]/20 text-[#f1d574] border-[#d4af37]/40",
  descent: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  closer: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};

export default function AlbumJourney({ journey }) {
  if (!journey || !journey.slots.length) return null;
  const { slots, climaxIndex, trackCount, explanations, peakIntensity, bpmRange } = journey;
  const maxBar = Math.max(peakIntensity, 10);

  return (
    <div className="rounded-lg border border-white/10 bg-[#11100f] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Map className="h-5 w-5 text-[#d4af37]" />
          <div>
            <p className="text-xs uppercase text-stone-400">Album journey</p>
            <p className="text-sm text-stone-300">
              {trackCount} tracks · peak on track {climaxIndex + 1} · BPM{" "}
              {bpmRange[0]}–{bpmRange[1]}
            </p>
          </div>
        </div>
        <TrendingUp className="h-4 w-4 text-stone-500" />
      </div>

      <div className="mt-4 flex items-end gap-1.5">
        {slots.map((slot, i) => {
          const height = Math.max(12, Math.round((slot.intensity / maxBar) * 96));
          const isClimax = i === climaxIndex;
          return (
            <div
              key={slot.index}
              className="group flex flex-1 flex-col items-center gap-1"
            >
              <span className="text-[10px] text-stone-500">{slot.intensity}%</span>
              <div
                className={cx(
                  "w-full rounded-t-sm transition-colors",
                  isClimax ? "bg-[#d4af37]" : "bg-stone-600/60 group-hover:bg-stone-500"
                )}
                style={{ height: `${height}px` }}
              />
              <span className={cx("rounded border px-1 py-0.5 text-[9px] font-medium", ROLE_CLASS[slot.role] || "bg-white/5 text-stone-300 border-white/10")}>
                {i + 1}
              </span>
              <span className="hidden max-w-24 truncate text-center text-[9px] text-stone-500 group-hover:block">
                {slot.title}
              </span>
              {isClimax && (
                <span className="text-[9px] font-semibold text-[#f1d574]">climax</span>
              )}
            </div>
          );
        })}
      </div>

      <ol className="mt-5 space-y-3 border-t border-white/10 pt-4">
        {explanations.map((explanation, i) => (
          <li key={i} className="grid gap-1 md:grid-cols-[140px_1fr]">
            <div>
              <p className="text-sm font-medium text-[#f1d574]">
                {i + 1}. {slots[i].title}
              </p>
              <span className={cx("mt-0.5 inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium", ROLE_CLASS[slots[i].role] || "bg-white/5 text-stone-300 border-white/10")}>
                {slots[i].roleLabel}
              </span>
            </div>
            <div className="space-y-1 text-xs text-stone-400">
              <p>{explanation.job}</p>
              <p>{explanation.inherits}</p>
              <p>{explanation.changes}</p>
              <p>{explanation.movesNext}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}