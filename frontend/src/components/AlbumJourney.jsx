import { useEffect, useState } from "react";
import { Map, TrendingUp, HeartPulse } from "lucide-react";

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

const CHEMISTRY_LABEL = {
  joy: "Joy",
  trust: "Trust",
  fear: "Fear",
  surprise: "Surprise",
  sadness: "Sadness",
  disgust: "Disgust",
  anger: "Anger",
  anticipation: "Anticipation",
};

const RESIDUAL_CLASS = {
  inherited: "border-white/15 text-stone-400",
  strengthened: "border-emerald-500/40 text-emerald-300",
  reduced: "border-orange-500/40 text-orange-300",
  introduced: "border-sky-500/40 text-sky-300",
};

function ChemistryPanel({ slot, index, isClimax }) {
  const chem = slot.chemistry;
  if (!chem) return null;
  const values = chem.values || [];
  const bars = values.map((value, i) => ({
    key: Object.keys(CHEMISTRY_LABEL)[i],
    value,
  }));
  const residue = [
    ...chem.inherited.map((k) => ({ type: "inherited", label: k })),
    ...chem.strengthened.map((k) => ({ type: "strengthened", label: k })),
    ...chem.reduced.map((k) => ({ type: "reduced", label: k })),
    ...chem.introduced.map((k) => ({ type: "introduced", label: k })),
  ];

  return (
    <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <HeartPulse className="h-4 w-4 text-[#d4af37]" />
        <p className="text-xs uppercase tracking-wider text-stone-400">
          Emotional chemistry · track {index + 1}
          {isClimax ? " · the album peak" : ""}
        </p>
        <span className="ml-auto text-[10px] text-stone-500">
          activation {chem.activation} · intensity {chem.intensity}% · ZERO distance {chem.zeroDistance}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-x-4 gap-y-1.5 md:grid-cols-8">
        {bars.map(({ key, value }) => (
          <div key={key}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase text-stone-500">{CHEMISTRY_LABEL[key]}</span>
              <span className="text-[9px] text-stone-400">{value}</span>
            </div>
            <div className="mt-0.5 h-1 w-full rounded-full bg-white/5">
              <div
                className="h-1 rounded-full bg-[#d4af37]/70"
                style={{ width: `${Math.max(4, value)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {residue.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {residue.map(({ type, label }) => (
            <span key={`${type}-${label}`} className={cx("rounded border px-1.5 py-0.5 text-[10px]", RESIDUAL_CLASS[type] || RESIDUAL_CLASS.inherited)}>
              {label}
            </span>
          ))}
        </div>
      )}

      {chem.purpose && (
        <p className="mt-2 text-xs italic text-stone-400">{chem.purpose}</p>
      )}
    </div>
  );
}

export default function AlbumJourney({ journey }) {
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    setSelected(0);
  }, [journey]);
  if (!journey || !journey.slots.length) return null;
  const { slots, climaxIndex, trackCount, explanations, peakIntensity, bpmRange, tempo } = journey;
  const maxBar = Math.max(peakIntensity, 10);
  const tMax = Math.max(...tempo);

  return (
    <div className="rounded-lg border border-white/10 bg-[#11100f] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Map className="h-5 w-5 text-[#d4af37]" />
          <div>
            <p className="text-xs uppercase text-stone-400">Album journey</p>
            <p className="text-sm text-stone-300">
              {trackCount} tracks · peak on track {climaxIndex + 1} · BPM{" "}
              {bpmRange[0]}–{bpmRange[1]} · pick a bar for its chemistry
            </p>
          </div>
        </div>
        <TrendingUp className="h-4 w-4 text-stone-500" />
      </div>

      {/* intensity + pulse trajectory */}
      <div className="mt-4 flex items-end gap-1.5">
        {slots.map((slot, i) => {
          const height = Math.max(12, Math.round((slot.intensity / maxBar) * 96));
          const isClimax = i === climaxIndex;
          const isSelected = i === selected;
          return (
            <button
              key={slot.index}
              onClick={() => setSelected(i)}
              className="group flex flex-1 flex-col items-center gap-1"
              title={`${slot.title} — select to inspect`}
            >
              <span className="text-[10px] text-stone-500">{slot.intensity}%</span>
              <div
                className={cx(
                  "w-full rounded-t-sm transition-colors",
                  isClimax
                    ? isSelected ? "bg-[#f1d574]" : "bg-[#d4af37]"
                    : isSelected ? "bg-stone-300" : "bg-stone-600/60 group-hover:bg-stone-500"
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
            </button>
          );
        })}
      </div>

      {/* pulse trajectory */}
      {tempo && tempo.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wider text-stone-500">
            Pulse trajectory:{" "}
            <span className="text-stone-300">
              {tempo.join(" → ")} BPM
            </span>
          </p>
          <div className="mt-1 flex items-end gap-1">
            {tempo.map((bpm, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-stone-600/40"
                style={{ height: `${Math.max(4, Math.round((bpm / tMax) * 28))}px` }}
                title={`${bpm} BPM`}
              />
            ))}
          </div>
        </div>
      )}

      <ChemistryPanel slot={slots[selected]} index={selected} isClimax={selected === climaxIndex} />

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