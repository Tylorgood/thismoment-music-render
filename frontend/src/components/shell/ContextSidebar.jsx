import { useTheaterContext } from "@/lib/theaterContext";
import { energyFromLabel, pickEmotionColor } from "@/lib/ambient";

function LiveRow({ track }) {
  return (
    <div className="ma-live-row">
      <span className="ma-live-dot" aria-hidden="true" />
      <div className="min-w-0">
        <div className="ma-faint text-[0.625rem] font-semibold uppercase tracking-[0.18em]">
          Now playing
        </div>
        <div className="ma-live-glow ma-emotion-text truncate text-sm font-medium">
          {track.title || track.id || "Playing…"}
        </div>
        <div className="mt-0.5 truncate font-mono text-[0.625rem] ma-faint">
          {track.id || ""}
          {track.bpm ? ` · ${track.bpm} BPM` : ""}
        </div>
      </div>
    </div>
  );
}

export default function ContextSidebar() {
  const theater = useTheaterContext();
  const live = Boolean(theater?.playing);
  const energyT = energyFromLabel(theater?.analysis?.energy_label);
  const [railR, railG, railB] = pickEmotionColor(energyT == null ? 0.6 : energyT);
  const railColor = `rgba(${railR}, ${railG}, ${railB}, 0.55)`;
  const liveTitle = theater?.title || theater?.id || "Untitled";
  const marqueeSegment = `NOW SHOWING — ${liveTitle}${theater?.bpm ? ` — ${theater.bpm} BPM` : ""} — `;

  return (
    <aside
      className="ma-scene-rail hidden w-72 shrink-0 border-l ma-hairline bg-[var(--ma-surface-2)]/30 lg:flex lg:flex-col"
      data-live={live ? "true" : "false"}
      style={{ "--ma-rail-color": railColor }}
      aria-label="Theater context"
    >
      <div className="flex items-center justify-between border-b ma-hairline px-4 py-3">
        <span className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] ma-faint">Theater</span>
        <span
          className={`ma-scanline rounded-sm border ma-hairline px-1.5 py-0.5 font-mono text-[0.5625rem] ${
            live ? "ma-scanline-live ma-emotion-text" : "ma-faint"
          }`}
        >
          ZERO
        </span>
      </div>

      {live && (
        <div
          className="ma-motive-marquee border-b ma-hairline bg-[var(--ma-inset)]/60 py-1"
          aria-hidden="true"
          data-testid="theater-marquee"
        >
          <div className="ma-marquee-track ma-emotion-text font-mono text-[0.625rem] uppercase tracking-[0.18em]">
            <span className="px-2">{marqueeSegment.repeat(3)}</span>
            <span className="px-2">{marqueeSegment.repeat(3)}</span>
          </div>
        </div>
      )}

      <div className="ma-theater-bg min-h-0 flex-1 overflow-y-auto p-4">
        {theater?.playing ? (
          <LiveRow track={theater} />
        ) : (
          <div className="rounded-sm border ma-hairline bg-[var(--ma-inset)]/60 p-3">
            <div className="ma-faint text-[0.625rem] font-semibold uppercase tracking-[0.18em]">
              Stage lights ready
            </div>
            <p className="mt-1 text-xs leading-relaxed ma-muted">
              Load a track to light the rail. The neon stays dark until music moves.
            </p>
          </div>
        )}

        {theater?.albumName ? (
          <div className="mt-3 rounded-sm border ma-hairline bg-[var(--ma-inset)]/60 p-3">
            <div className="ma-faint text-[0.625rem] font-semibold uppercase tracking-[0.18em]">
              Scene
            </div>
            <div className="mt-1 truncate text-sm ma-accent-text">{theater.albumName}</div>
            {theater.section && (
              <div className="mt-0.5 truncate text-xs ma-muted">Album preview · {theater.section}</div>
            )}
          </div>
        ) : null}
      </div>

      <div className="border-t ma-hairline px-4 py-3">
        <p className="ma-faint font-mono text-[0.5625rem]">
          dark theater · neon sign
          <span className="ma-live-dot ml-2 align-middle" aria-hidden="true" />
        </p>
      </div>
    </aside>
  );
}