import { useMemo, useState } from "react";
import { Check, CheckCheck, Download, Link2, Play, RotateCcw, Search } from "lucide-react";
import {
  PRODUCTION_STATUSES,
  PRODUCTION_STATUS_LABELS,
  productionSummary,
  nextTransition,
  buildProductionManifest,
} from "@/lib/albumProduction";

const STATUS_CLASS = {
  prompt_ready: "border-white/10 bg-white/5 text-stone-300",
  generated: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  imported: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
  accepted: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

const VERDICT_LABEL = {
  on_target: "on target",
  differs: "differs from target",
};

export default function AlbumProduction({
  blueprint,
  production,
  onChange,
  libraryCache = {},
  onFetchTrack = async () => null,
  onFinish,
  onExport,
}) {
  const slots = blueprint?.slots || [];
  const summary = productionSummary(production, slots.length);
  const manifest = useMemo(
    () => buildProductionManifest(blueprint, production, libraryCache),
    [blueprint, production, libraryCache]
  );
  const [attachSlot, setAttachSlot] = useState(null);
  const [attachQuery, setAttachQuery] = useState("");
  const [attachResults, setAttachResults] = useState([]);
  const [attaching, setAttaching] = useState(false);

  const entries = manifest.map((row, i) => ({ ...row, slotIndex: i, entry: (production?.slots || {})[i] || {} }));

  const runSearch = async () => {
    const q = attachQuery.trim();
    if (!q) return;
    setAttaching(true);
    try {
      const tracks = await onFetchTrack(q);
      setAttachResults(tracks || []);
    } catch {
      setAttachResults([]);
    } finally {
      setAttaching(false);
    }
  };

  const attachToSlot = (slotIndex, track) => {
    onChange((prod, count) => {
      const slotsState = { ...(prod?.slots || {}) };
      slotsState[slotIndex] = {
        ...(slotsState[slotIndex] || {}),
        status: "imported",
        library_track_id: track.id,
        note: `attached ${track.display_title}`,
      };
      return { ...(prod || {}), status: prod?.status || "draft", slots: slotsState };
    });
    setAttachSlot(null);
    setAttachResults([]);
    setAttachQuery("");
  };

  const advance = (row) => {
    const t = nextTransition(row.entry.status);
    if (!t) return;
    if (t.to === "imported") {
      setAttachSlot(row.slotIndex);
      setAttachQuery(row.title);
      return;
    }
    onChange((prod, count) => {
      const slotsState = { ...(prod?.slots || {}) };
      slotsState[row.slotIndex] = { ...(slotsState[row.slotIndex] || {}), status: t.to };
      return { ...(prod || {}), status: prod?.status || "draft", slots: slotsState };
    });
  };

  const setSunoUrl = (row, url) => {
    onChange((prod, count) => {
      const slotsState = { ...(prod?.slots || {}) };
      slotsState[row.slotIndex] = { ...(slotsState[row.slotIndex] || {}), suno_url: url };
      return { ...(prod || {}), status: prod?.status || "draft", slots: slotsState };
    });
  };

  const accept = (row) => {
    onChange((prod, count) => {
      const slotsState = { ...(prod?.slots || {}) };
      slotsState[row.slotIndex] = { ...(slotsState[row.slotIndex] || {}), status: "accepted" };
      return { ...(prod || {}), status: prod?.status || "draft", slots: slotsState };
    });
  };

  const reset = (row) => {
    onChange((prod, count) => {
      const slotsState = { ...(prod?.slots || {}) };
      slotsState[row.slotIndex] = { status: "prompt_ready" };
      return { ...(prod || {}), status: prod?.status || "draft", slots: slotsState };
    });
  };

  const pct = slots.length ? Math.round((summary.done / slots.length) * 100) : 0;

  return (
    <div className="rounded-lg border border-white/10 bg-[#11100f] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Production workflow</h2>
          <p className="mt-1 text-xs text-stone-500">
            Make every track in Suno manually, attach the finished file from your library, compare,
            then accept. Compare never blocks — it informs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {production.status === "finished" ? (
            <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
              Album finished
            </span>
          ) : (
            <span className="rounded-md border border-white/10 bg-black/25 px-2 py-0.5 text-xs text-stone-400">
              {summary.done}/{summary.total} accepted · {pct}%
            </span>
          )}
          <div className="h-2 w-32 overflow-hidden rounded-full bg-black/30">
            <div
              className="h-full rounded-full bg-[#d4af37] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {entries.map((row) => {
          const open = attachSlot === row.slotIndex;
          const canAdvance = nextTransition(row.entry.status) !== null;
          return (
            <div key={row.slotIndex} className="rounded-md border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-stone-400">
                    {row.slot}
                  </span>
                  <span className="truncate text-sm font-medium text-stone-200">{row.title}</span>
                  <span className="text-[10px] text-stone-500">{row.role || ""}</span>
                  {row.target_bpm ? <span className="text-[10px] text-stone-500">{row.target_bpm} BPM target</span> : null}
                </div>
                <div className="flex items-center gap-2">
                  {row.compare.available && (
                    <span
                      className={
                        row.compare.verdict === "on_target"
                          ? "rounded border border-emerald-500/30 bg-emerald-500/5 px-1.5 py-0.5 text-[10px] text-emerald-300"
                          : "rounded border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[10px] text-amber-300"
                      }
                    >
                      {VERDICT_LABEL[row.compare.verdict] || row.compare.verdict}
                      {row.compare.details?.[0]?.delta != null
                        ? ` · bpm ${row.compare.details[0].actual} (${row.compare.details[0].delta > 0 ? "+" : "−"}${row.compare.details[0].delta})`
                        : ""}
                    </span>
                  )}
                  {row.compare.available === false && row.compare.meaning === "no_analysis" && (
                    <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-stone-500">
                      no analysis yet
                    </span>
                  )}
                  <span className={["rounded border px-1.5 py-0.5 text-[10px] font-medium", STATUS_CLASS[row.status]].join(" ")}>
                    {PRODUCTION_STATUS_LABELS[row.status] || row.status}
                  </span>
                </div>
              </div>

              {row.entry.suno_url ? (
                <a
                  href={row.entry.suno_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-[11px] text-sky-300/90 hover:underline"
                >
                  <Link2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{row.entry.suno_url}</span>
                </a>
              ) : null}

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {canAdvance && (
                  <button
                    onClick={() => advance(row)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-stone-200 hover:bg-white/10"
                  >
                    <Play className="h-3 w-3" />
                    {row.status === "prompt_ready" ? "Mark generated in Suno" : "Attach library track"}
                  </button>
                )}
                {row.status === "imported" && (
                  <button
                    onClick={() => accept(row)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20"
                  >
                    <Check className="h-3 w-3" />
                    Accept take
                  </button>
                )}
                {row.status === "accepted" && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                    <CheckCheck className="h-3.5 w-3.5" />
                    Accepted
                  </span>
                )}
                {(row.status === "imported" || row.status === "accepted") && (
                  <button
                    onClick={() => reset(row)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-stone-400 hover:bg-white/5"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
                {row.status === "generated" && (
                  <input
                    value={row.entry.suno_url || ""}
                    onChange={(e) => setSunoUrl(row, e.target.value)}
                    placeholder="Optional Suno song link"
                    className="w-full max-w-xs rounded-md border border-white/10 bg-black/25 px-2 py-1 text-xs text-white outline-none focus:border-[#d4af37] sm:w-64"
                  />
                )}
              </div>

              {open && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      value={attachQuery}
                      onChange={(e) => setAttachQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runSearch()}
                      placeholder="Search library by title or id"
                      className="w-full rounded-md border border-white/10 bg-black/25 px-2 py-1.5 text-xs text-white outline-none focus:border-[#d4af37]"
                    />
                    <button
                      onClick={runSearch}
                      disabled={attaching}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-stone-200 hover:bg-white/10 disabled:opacity-50"
                    >
                      <Search className="h-3 w-3" />
                      Search
                    </button>
                  </div>
                  {attachResults.length > 0 && (
                    <div className="max-h-44 space-y-1 overflow-y-auto">
                      {attachResults.map((track) => (
                        <button
                          key={track.id}
                          onClick={() => attachToSlot(row.slotIndex, track)}
                          className="flex w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-black/25 px-2 py-1.5 text-left hover:border-[#d4af37]/50"
                        >
                          <span className="truncate text-xs text-stone-200">{track.display_title}</span>
                          <span className="shrink-0 text-[10px] text-stone-500">
                            {track.bpm ? `${track.bpm} BPM` : "no BPM"}
                            {track.duration_seconds ? ` · ${Math.round(track.duration_seconds)}s` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {attaching === false && attachResults.length === 0 && attachQuery.trim() && (
                    <p className="text-[11px] text-stone-500">No tracks match — try a different title.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <p className="text-xs text-stone-500">
          {PRODUCTION_STATUSES.map((s, i) => (
            <span key={s} className="mr-3 inline-flex items-center gap-1">
              <span className={["rounded border px-1 py-0.5 text-[10px]", STATUS_CLASS[s]].join(" ")}>
                {summary[s]}
              </span>
              {i < PRODUCTION_STATUSES.length - 1 ? <span className="text-stone-600">→</span> : null}
            </span>
          ))}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-stone-200 hover:bg-white/10"
          >
            <Download className="h-3.5 w-3.5" />
            Export production manifest
          </button>
          <button
            onClick={onFinish}
            disabled={!summary.allAccepted}
            title={summary.allAccepted ? "All tracks accepted — finish the album" : "Accept every track before finishing"}
            className="inline-flex items-center gap-2 rounded-md border border-[#d4af37]/40 bg-[#d4af37] px-3 py-2 text-xs font-medium text-black hover:bg-[#e8c14a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {production.status === "finished" ? "Album finished" : "Finish album"}
          </button>
        </div>
      </div>
    </div>
  );
}