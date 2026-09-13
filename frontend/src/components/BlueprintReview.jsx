import { Check, MousePointerClick, ShieldCheck } from "lucide-react";

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

const LEVEL_CLASS = {
  pass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  fail: "border-red-500/40 bg-red-500/10 text-red-300",
};

/* Pre-export blueprint review: the whole plan in one place, so nothing ships
 * sight-unseen. Per-track chemistry, roles, purposes, and the pulse trajectory
 * are all shown before the user approves. */
export default function BlueprintReview({ blueprint, journey, matrix, approved = false, approvalSlots = {}, onSelectTrack, onApprove }) {
  if (!blueprint || !journey) return null;
  const bible = blueprint.bible;
  const { album, anchor, climaxPosition } = bible;
  const { slots, tempo } = journey;
  const matrixFails = matrix?.level === "fail";

  const rows = blueprint.slots.map((slot, i) => ({
    slot,
    chem: journey.slots[i]?.chemistry || null,
    explanation: journey.explanations?.[i] || null,
  }));

  return (
    <div className="rounded-lg border border-[#d4af37]/30 bg-[#11100f] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#d4af37]">Blueprint review</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm text-stone-400">
              {album.name} · {album.archetypeName} · climax on track {climaxPosition.slotIndex + 1} (
              {Math.round(climaxPosition.pct)}%)
            </p>
            {matrix && (
              <span className={cx("rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase", LEVEL_CLASS[matrix.level])}>
                matrix {matrix.level} · {matrix.score}
              </span>
            )}
            {approved && (
              <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                <ShieldCheck className="h-3 w-3" /> plan approved
              </span>
            )}
          </div>
        </div>
        {onApprove && (
          <button
            onClick={onApprove}
            disabled={matrixFails || approved}
            title={matrixFails ? "Matrix checks fail — fix the flagged rules first" : approved ? "Plan already approved" : undefined}
            className={
              approved
                ? "inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300"
                : "inline-flex items-center gap-2 rounded-md border border-[#d4af37]/40 bg-[#d4af37] px-3 py-1.5 text-xs font-medium text-black hover:bg-[#e8c14a] disabled:cursor-not-allowed disabled:opacity-40"
            }
          >
            <Check className="h-3.5 w-3.5" />
            {approved ? "Plan approved" : "Approve plan"}
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase text-stone-500">The story</p>
          <p className="mt-1 text-sm text-stone-200">{anchor.tagline}</p>
          <p className="mt-1 text-sm italic text-stone-400">{album.theme || "(no narrative)"}</p>
          <p className="mt-2 text-xs text-stone-500">
            Motif: {anchor.motif}
          </p>
          {Array.isArray(anchor.moodRange) && anchor.moodRange.length > 0 && (
            <p className="mt-1 text-xs text-stone-500">
              Mood range: {anchor.moodRange.join(", ")}
            </p>
          )}
          {Array.isArray(anchor.colors) && anchor.colors.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-stone-500">Palette:</span>
              {anchor.colors.slice(0, 4).map((c, i) => (
                <span key={i} className="rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-0.5 text-[10px] text-[#f1d574]">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-md border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase text-stone-500">Shape of the record</p>
          <ul className="mt-1 space-y-1 text-xs text-stone-300">
            {[
              ["Start", rows[0]?.slot.roleLabel],
              ["Peak", `track ${climaxPosition.slotIndex + 1} — ${rows[climaxPosition.slotIndex]?.slot.roleLabel}`],
              ["End", rows[rows.length - 1]?.slot.roleLabel],
            ].map(([label, value]) => (
              <li key={label} className="flex justify-between">
                <span className="text-stone-500">{label}</span>
                <span>{value}</span>
              </li>
            ))}
            <li className="flex justify-between">
              <span className="text-stone-500">Pulse</span>
              <span>
                {tempo?.[0]} → {tempo?.[tempo.length - 1]} BPM ({journey.tempoBehavior})
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border border-white/10 bg-black/20">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-3 py-2 text-[10px] uppercase text-stone-500">#</th>
              <th className="px-3 py-2 text-[10px] uppercase text-stone-500">Role</th>
              <th className="px-3 py-2 text-[10px] uppercase text-stone-500">Chemistry</th>
              <th className="px-3 py-2 text-[10px] uppercase text-stone-500">BPM</th>
              <th className="px-3 py-2 text-[10px] uppercase text-stone-500">Purpose</th>
              <th className="px-3 py-2 text-[10px] uppercase text-stone-500">Approved</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ slot, chem, explanation }, i) => {
              const dom = chem ? chem.dominant.slice(0, 3).map((d) => d.key).join(", ") : slot.analysis.emotions.slice(0, 3).join(", ");
              return (
                <tr
                  key={i}
                  className={cx(
                    "border-b border-white/5 last:border-0",
                    onSelectTrack ? "cursor-pointer hover:bg-white/5" : ""
                  )}
                  onClick={onSelectTrack ? () => onSelectTrack(i) : undefined}
                >
                  <td className="px-3 py-2 align-top text-xs text-stone-500">{i + 1}</td>
                  <td className="px-3 py-2 align-top">
                    <span className={cx("inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium", ROLE_CLASS[slot.role] || "bg-white/5 text-stone-300 border-white/10")}>
                      {slot.roleLabel}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-stone-300">
                    {dom}
                    {chem ? (
                      <span className="block text-[10px] text-stone-500">
                        act {chem.activation} · dist {chem.zeroDistance}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-stone-400">{slot.bpm}</td>
                  <td className="px-3 py-2 align-top text-xs text-stone-400">
                    {chem?.purpose || explanation?.job || ""}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {approvalSlots?.[i] ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <span className="text-stone-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {onSelectTrack && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-stone-500">
          <MousePointerClick className="h-3.5 w-3.5" />
          Tap a row to jump to that track in the studio and refine it, then return here.
        </p>
      )}
    </div>
  );
}