import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Pause, Play, SkipForward } from "lucide-react";
import { useTheaterContext } from "@/lib/theaterContext";
import { toggle, skipNext, hasControls, getLive, sampleEq } from "@/lib/persistAudio";

function trackMeta(theater) {
  return {
    id: theater?.id || null,
    title: theater?.title || "",
    bpm: theater?.bpm,
    artworkUrl: theater?.artworkUrl || null,
    analysis: theater?.analysis || null,
  };
}

export default function NowPlayingBar() {
  const theater = useTheaterContext();
  const { pathname } = useLocation();
  const inStudio = pathname.startsWith("/music") || pathname.startsWith("/dj");
  const [eq, setEq] = useState([0.08, 0.08, 0.08, 0.08, 0.08]);
  const frameRef = useRef(null);

  const meta = trackMeta(theater);
  const visible = Boolean(meta.id || getLive());
  const playing = Boolean(theater?.playing) || (getLive() ? !getLive().paused : false);

  useEffect(() => {
    if (!visible) return;
    let frame;
    const loop = () => {
      setEq(sampleEq());
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [visible, playing]);

  useEffect(() => {
    if (inStudio) return;
    const onKeyDown = (event) => {
      if (event.code !== "Space") return;
      const target = event.target;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inStudio]);

  if (!visible) return null;

  const controlsAvailable = hasControls();
  const bpmLabel = Number.isFinite(Number(meta.bpm)) ? `${Math.round(Number(meta.bpm))} BPM` : null;

  return (
    <footer
      className="ma-motive flex h-14 shrink-0 items-center gap-3 border-t ma-hairline bg-[var(--ma-surface-1)]/70 px-4"
      aria-label="Now playing"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm border ma-hairline bg-[var(--ma-inset)]">
          {meta.artworkUrl ? (
            <img src={meta.artworkUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-[var(--ma-status-emotion)] shadow-[0_0_10px_var(--ma-status-emotion)]" />
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-slate-100">{meta.title || "Paused in studio"}</span>
          <div className="flex items-center gap-2">
            {playing && (
              <div className="flex h-3 items-end gap-px" aria-hidden="true">
                {eq.map((level, index) => (
                  <span
                    key={index}
                    className="w-[3px] rounded-sm bg-[var(--ma-status-emotion)]"
                    style={{ height: `${Math.max(12, Math.round(level * 100))}%`, opacity: 0.85 }}
                  />
                ))}
              </div>
            )}
            {bpmLabel && <span className="text-[0.68rem] uppercase tracking-[0.14em] ma-faint">{bpmLabel}</span>}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => toggle()}
          className="ma-motive ma-motive-press ma-ring-focus inline-flex h-9 w-9 items-center justify-center rounded-sm border ma-hairline-strong text-slate-200 transition-colors hover:bg-white/5"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => skipNext()}
          disabled={!controlsAvailable}
          className="ma-motive ma-motive-press ma-ring-focus inline-flex h-9 w-9 items-center justify-center rounded-sm border ma-hairline-strong text-slate-200 transition-colors hover:bg-white/5 disabled:pointer-events-none disabled:opacity-40"
          aria-label="Skip to next track"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </footer>
  );
}