import { useState } from "react";
import { Check, CheckCheck, Download, Link2, Play, RotateCcw, Search } from "lucide-react";
import {
  PRODUCTION_STATUSES,
  PRODUCTION_STATUS_LABELS,
  productionSummary,
  nextTransition,
} from "@/lib/albumProduction";
import { PageSection, Toolbar, DataTable, StatusBadge, Metric, InspectorDrawer, EmptyState } from "@/components/layout";

const STATUS_TONE = {
  prompt_ready: "neutral",
  generated: "info",
  imported: "emotion",
  accepted: "ok",
};

const VERDICT_TONE = {
  on_target: "ok",
  differs: "warn",
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
  const [attachSlot, setAttachSlot] = useState(null);
  const [attachQuery, setAttachQuery] = useState("");
  const [attachResults, setAttachResults] = useState([]);
  const [attaching, setAttaching] = useState(false);

  const entries = slots.map((slot, i) => {
    const entry = (production?.slots || {})[i] || {};
    const status = entry.status || "prompt_ready";
    const targetBpm = slot.bpm || null;
    const actualBpm = typeof entry.library_track_id === "string" && libraryCache[entry.library_track_id]?.bpm;
    const verdict =
      status === "accepted" || (status === "imported" && entry.library_track_id)
        ? actualBpm != null && targetBpm != null
          ? Math.abs(actualBpm - targetBpm) / Math.max(1, targetBpm) <= 0.06
            ? "on_target"
            : "differs"
          : "on_target"
        : null;
    return {
      slotIndex: i,
      slot: slot.role === "interlude" || slot.role === "climax" ? `${i + 1} · ${slot.roleLabel}` : String(i + 1),
      title: slot.title,
      role: slot.roleLabel || "",
      targetBpm,
      status,
      sunoUrl: entry.suno_url || "",
      libraryTrack: entry.library_track_id && libraryCache[entry.library_track_id]
        ? libraryCache[entry.library_track_id]
        : null,
      verdict,
      canAdvance: nextTransition(status) !== null,
    };
  });

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

  const patchSlot = (slotIndex, patch) => {
    onChange((prod) => {
      const slotsState = { ...(prod?.slots || {}) };
      slotsState[slotIndex] = { ...(slotsState[slotIndex] || {}), ...patch };
      return { ...(prod || {}), status: prod?.status || "draft", slots: slotsState };
    });
  };

  const advance = (row) => {
    const t = nextTransition(row.status);
    if (!t) return;
    if (t.to === "imported") {
      setAttachSlot(row.slotIndex);
      setAttachQuery(row.title);
      return;
    }
    patchSlot(row.slotIndex, { status: t.to });
  };

  const accept = (row) => patchSlot(row.slotIndex, { status: "accepted" });
  const reset = (row) => patchSlot(row.slotIndex, { status: "prompt_ready" });

  const pct = slots.length ? Math.round((summary.done / slots.length) * 100) : 0;

  const columns = [
    { key: "slot", label: "Slot", width: "4.5rem" },
    {
      key: "title",
      label: "Track",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-100">{row.title}</div>
          <div className="mt-0.5 text-[0.65rem] ma-faint">
            {[row.role, row.targetBpm ? `${row.targetBpm} BPM target` : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge tone={STATUS_TONE[row.status]} label={PRODUCTION_STATUS_LABELS[row.status]} />,
    },
    {
      key: "compare",
      label: "Compare",
      render: (row) =>
        row.status === "prompt_ready" ? (
          <span className="text-xs ma-faint">target set</span>
        ) : row.verdict ? (
          <div>
            <StatusBadge tone={VERDICT_TONE[row.verdict]} label={VERDICT_LABEL[row.verdict]} />
            {row.verdict === "differs" && row.libraryTrack?.bpm && row.targetBpm ? (
              <div className="mt-1 font-mono text-[0.65rem] ma-faint">
                {row.libraryTrack.bpm} vs {row.targetBpm} BPM
              </div>
            ) : null}
          </div>
        ) : (
          <span className="text-xs ma-faint">waiting on analysis</span>
        ),
    },
    {
      key: "source",
      label: "Source",
      render: (row) => (
        <div className="max-w-48">
          {row.libraryTrack ? (
            <div className="flex items-center gap-1.5">
              <CheckCheck className="h-3.5 w-3.5 ma-ok-text" />
              <span className="truncate text-xs text-slate-200">{row.libraryTrack.display_title}</span>
            </div>
          ) : row.sunoUrl ? (
            <a
              href={row.sunoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 truncate text-xs text-sky-300/90 hover:underline"
            >
              <Link2 className="h-3 w-3 shrink-0" />
              <span className="truncate">Suno link</span>
            </a>
          ) : (
            <span className="text-xs ma-faint">—</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (row) => {
        if (row.status === "accepted") {
          return (
            <div className="flex items-center justify-end gap-2">
              <span className="inline-flex items-center gap-1 text-xs ma-ok-text">
                <CheckCheck className="h-3.5 w-3.5" />
                Accepted
              </span>
              <button
                onClick={() => reset(row)}
                title="Reset to prompt ready"
                className="ma-ring-focus rounded-sm border ma-hairline px-2 py-1 text-xs ma-muted hover:bg-white/5 hover:text-slate-200"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>
          );
        }
        if (row.status === "imported") {
          return (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => reset(row)}
                title="Reset to prompt ready"
                className="ma-ring-focus rounded-sm border ma-hairline px-2 py-1 text-xs ma-muted hover:bg-white/5 hover:text-slate-200"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
              <button
                onClick={() => accept(row)}
                className="ma-ring-focus inline-flex items-center gap-1 rounded-sm border border-[var(--ma-status-ok)]/50 bg-[var(--ma-status-ok)]/10 px-2 py-1 text-xs ma-ok-text hover:bg-[var(--ma-status-ok)]/20"
              >
                <Check className="h-3 w-3" />
                Accept take
              </button>
            </div>
          );
        }
        if (row.status === "generated") {
          return (
            <div className="flex items-center justify-end gap-2">
              <input
                value={row.sunoUrl}
                onChange={(event) => patchSlot(row.slotIndex, { suno_url: event.target.value })}
                placeholder="Suno song link…"
                className="w-40 rounded-sm border ma-hairline bg-[var(--ma-inset)] px-2 py-1 text-xs text-slate-100 outline-none focus:border-[var(--ma-accent)]"
              />
              <button
                onClick={() => advance(row)}
                className="ma-ring-focus inline-flex items-center gap-1 rounded-sm border ma-hairline-strong px-2 py-1 text-xs ma-muted hover:bg-white/5 hover:text-slate-200"
              >
                <Play className="h-3 w-3" />
                Attach
              </button>
            </div>
          );
        }
        return (
          <button
            onClick={() => advance(row)}
            className="ma-ring-focus inline-flex items-center gap-1 rounded-sm border ma-hairline-strong px-2 py-1 text-xs text-slate-200 hover:bg-white/5"
          >
            <Play className="h-3 w-3" />
            Mark generated
          </button>
        );
      },
    },
  ];

  const activeAttachTitle =
    entries.find((entry) => entry.slotIndex === attachSlot)?.title || "";

  return (
    <>
      <PageSection
        title="Production workflow"
        description="Make every track in Suno manually, attach the finished file from your library, compare, then accept. Compare never blocks — it informs."
        actions={
          <>
            <button
              onClick={onExport}
              className="ma-ring-focus inline-flex items-center gap-2 rounded-sm border ma-hairline-strong px-2.5 py-1.5 text-xs ma-muted transition-colors hover:bg-white/5 hover:text-slate-200"
            >
              <Download className="h-3.5 w-3.5" />
              Manifest
            </button>
            <button
              onClick={onFinish}
              disabled={!summary.allAccepted}
              title={summary.allAccepted ? "All tracks accepted — finish the album" : "Accept every track before finishing"}
              className="ma-ring-focus inline-flex items-center gap-2 rounded-sm ma-accent-bg px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {production.status === "finished" ? "Album finished" : "Finish album"}
            </button>
          </>
        }
      >
        <Toolbar
          left={
            <div className="flex items-center gap-2">
              <Metric label="Accepted" value={`${summary.done}/${summary.total}`} sub={`${pct}% of tracks`} tone={production.status === "finished" ? "ok" : "neutral"} />
              <span className="mx-2 h-6 w-px ma-hairline" aria-hidden="true" />
              {PRODUCTION_STATUSES.map((status) => (
                <StatusBadge
                  key={status}
                  tone={STATUS_TONE[status]}
                  label={`${PRODUCTION_STATUS_LABELS[status]} ${summary[status]}`}
                />
              ))}
            </div>
          }
        />
        <div className="overflow-x-auto">
          {entries.length ? (
            <DataTable columns={columns} rows={entries} rowKey={(row) => row.slotIndex} emptyText="No slots." />
          ) : (
            <EmptyState title="No tracks" description="Generate an album before running production." />
          )}
        </div>
        <div className="flex items-center gap-3 border-t ma-hairline px-4 py-3">
          <p className="text-xs ma-muted">
            1 Mark generated in Suno → 2 attach the finished file → 3 accept the take. Compare stays informative.
          </p>
          <span className="ml-auto font-mono text-[0.65rem] ma-faint">compare p6ms</span>
        </div>
      </PageSection>

      <InspectorDrawer open={attachSlot !== null} onClose={() => setAttachSlot(null)} title={`Attach library track — ${activeAttachTitle}`}>
        <label className="mb-2 block text-[0.65rem] font-semibold uppercase tracking-[0.16em] ma-faint">
          Search your music library
        </label>
        <div className="flex gap-2">
          <input
            value={attachQuery}
            onChange={(event) => setAttachQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && runSearch()}
            placeholder="Title or id…"
            className="w-full rounded-sm border ma-hairline bg-[var(--ma-inset)] px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-[var(--ma-accent)]"
          />
          <button
            onClick={runSearch}
            disabled={attaching}
            className="ma-ring-focus inline-flex items-center gap-2 rounded-sm border ma-hairline-strong px-3 py-2 text-sm ma-muted hover:bg-white/5 hover:text-slate-200 disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>
        <div className="mt-4 space-y-1.5">
          {attachResults.map((track) => (
            <button
              key={track.id}
              onClick={() => {
                patchSlot(attachSlot, { status: "imported", library_track_id: track.id, note: `attached ${track.display_title}` });
                setAttachSlot(null);
                setAttachResults([]);
                setAttachQuery("");
              }}
              className="ma-ring-focus flex w-full items-center justify-between gap-2 rounded-sm border ma-hairline bg-[var(--ma-inset)] px-3 py-2 text-left hover:border-[var(--ma-line-strong)]"
            >
              <span className="truncate text-sm text-slate-200">{track.display_title}</span>
              <span className="shrink-0 text-[0.65rem] ma-faint">
                {track.bpm ? `${track.bpm} BPM` : "no BPM"}
                {track.duration_seconds ? ` · ${Math.round(track.duration_seconds)}s` : ""}
              </span>
            </button>
          ))}
          {!attaching && attachResults.length === 0 && attachQuery.trim() && (
            <p className="text-xs ma-muted">No tracks match — try a different title.</p>
          )}
        </div>
      </InspectorDrawer>
    </>
  );
}