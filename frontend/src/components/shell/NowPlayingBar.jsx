import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Pause,
  Play,
  Radio,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useTheaterContext } from "@/lib/theaterContext";
import { getState } from "@/lib/reactiveBus";
import {
  toggle,
  skipNext,
  skipPrev,
  seekTo,
  hasControls,
  getLive,
  getTransportState,
  setTransportState,
  getWaveformPeaks,
} from "@/lib/persistAudio";
import MoodBand from "@/components/shell/MoodBand";

function trackMeta(theater) {
  return {
    id: theater?.id || null,
    title: theater?.title || "",
    bpm: theater?.bpm,
    artworkUrl: theater?.artworkUrl || null,
    project: theater?.albumName || "Music Arcade",
    analysis: theater?.analysis || null,
  };
}

function fmtTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function WaveformStrip({ peaks, currentTime, duration, scrubFrac, live, onScrub, onCommit }) {
  const canvasRef = useRef(null);
  const width = 460;
  const height = 44;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const bars = peaks && peaks.length ? peaks : Array.from({ length: 64 }, (_, index) => 0.14 + 0.05 * Math.sin(index * 0.9));
    const count = bars.length;
    const gap = 1;
    const barW = (width - gap * (count - 1)) / count;
    const frac = scrubFrac != null ? scrubFrac : duration > 0 ? currentTime / duration : 0;
    const played = Math.max(0, Math.min(1, frac));

    for (let i = 0; i < count; i += 1) {
      const x = i * (barW + gap);
      const h = Math.max(2, bars[i] * (height - 4));
      const isPlayed = i / count <= played;
      ctx.fillStyle = isPlayed
        ? `rgba(244, 114, 182, ${0.55 + (live ? 0.25 : 0)})`
        : `rgba(148, 163, 184, 0.28)`;
      ctx.fillRect(x, (height - h) / 2, barW, h);
    }

    const markerX = played * (width - 1);
    ctx.fillStyle = "rgba(244, 114, 182, 0.9)";
    ctx.fillRect(markerX, 0, 1.5, height);
    ctx.beginPath();
    ctx.arc(markerX, height / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }, [peaks, currentTime, duration, scrubFrac, live]);

  const handlePointer = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    onScrub(frac);
  };

  return (
    <canvas
      ref={canvasRef}
      data-testid="transport-waveform"
      className="ma-waveform-strip"
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(((scrubFrac != null ? scrubFrac : duration > 0 ? currentTime / duration : 0) || 0) * 100)}
      style={{ width, height }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        handlePointer(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons > 0) handlePointer(event);
      }}
      onPointerUp={(event) => {
        handlePointer(event);
        onCommit();
      }}
    />
  );
}

export default function NowPlayingBar() {
  const theater = useTheaterContext();
  const { pathname } = useLocation();
  const inStudio = pathname.startsWith("/music") || pathname.startsWith("/dj");
  const [expanded, setExpanded] = useState(false);
  const [peaks, setPeaks] = useState(null);
  const [volume, setVolume] = useState(() => (typeof window !== "undefined" && getLive() ? getLive().volume : 1));
  const [transport, setTransport] = useState(() => getTransportState());
  const [scrub, setScrub] = useState(null);

  const meta = trackMeta(theater);
  const visible = Boolean(meta.id || getLive());
  const playing = Boolean(theater?.playing) || (getLive() ? !getLive().paused : false);
  const controlsAvailable = hasControls();
  const liveEl = getLive();

  const srcKey = liveEl ? liveEl.currentSrc || liveEl.src || "" : "";
  const currentTime = theater?.currentTime ?? (liveEl ? liveEl.currentTime || 0 : 0);
  const duration = theater?.duration ?? (liveEl && Number.isFinite(liveEl.duration) ? liveEl.duration : 0);

  useEffect(() => {
    if (!visible || !srcKey) return;
    let alive = true;
    getWaveformPeaks(srcKey).then((peaksResult) => {
      if (alive) setPeaks(peaksResult);
    });
    return () => {
      alive = false;
    };
  }, [srcKey, visible]);

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

  const liveBpm = Number(meta.bpm);
  const bpmLabel = Number.isFinite(liveBpm) && liveBpm > 0 ? `${Math.round(liveBpm)} BPM` : null;
  const spectrum = getState().spectrum || [];
  const eqLevels = spectrum.slice(0, 5);
  const timeLabel = fmtTime(scrub && scrub.frac != null ? scrub.frac * duration : currentTime);
  const durationLabel = fmtTime(duration);

  const toggleTransportMode = (key) => {
    const next = { ...transport, [key]: !transport[key] };
    setTransport(next);
    setTransportState(next);
  };

  const onScrub = (frac) => {
    setScrub({ frac, active: true });
  };
  const onCommit = () => {
    if (scrub && scrub.frac != null) {
      seekTo(scrub.frac, duration);
    }
    setScrub(null);
  };

  const VolumeIcon = volume === 0 ? VolumeX : Volume2;

  const transportRow = (big) => (
    <div className={`ma-transport-controls ${big ? "ma-transport-controls-lg" : ""}`}>
      <button
        type="button"
        onClick={() => toggleTransportMode("shuffle")}
        className={`ma-motive ma-motive-press ma-ring-focus ${transport.shuffle ? "ma-emotion-text" : ""}`}
        aria-label={`Shuffle ${transport.shuffle ? "on" : "off"}`}
        aria-pressed={transport.shuffle}
      >
        <Shuffle className={big ? "h-5 w-5" : "h-4 w-4"} />
      </button>
      <button
        type="button"
        onClick={() => skipPrev()}
        disabled={!controlsAvailable}
        className="ma-motive ma-motive-press ma-ring-focus"
        aria-label="Skip to previous track"
      >
        <SkipBack className={big ? "h-5 w-5" : "h-4 w-4"} />
      </button>
      <button
        type="button"
        onClick={() => toggle()}
        className={`ma-motive ma-motive-press ma-ring-focus ma-transport-play ${big ? "ma-transport-play-lg" : ""}`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className={big ? "h-5 w-5" : "h-4 w-4"} /> : <Play className={big ? "h-5 w-5" : "h-4 w-4"} />}
      </button>
      <button
        type="button"
        onClick={() => skipNext()}
        disabled={!controlsAvailable}
        className="ma-motive ma-motive-press ma-ring-focus"
        aria-label="Skip to next track"
      >
        <SkipForward className={big ? "h-5 w-5" : "h-4 w-4"} />
      </button>
      <button
        type="button"
        onClick={() => toggleTransportMode("repeat")}
        className={`ma-motive ma-motive-press ma-ring-focus ${transport.repeat ? "ma-emotion-text" : ""}`}
        aria-label={`Repeat ${transport.repeat ? "on" : "off"}`}
        aria-pressed={transport.repeat}
      >
        <Repeat className={big ? "h-5 w-5" : "h-4 w-4"} />
      </button>
    </div>
  );

  return (
    <>
      <footer
        className="ma-motive flex h-14 shrink-0 items-center gap-3 border-t ma-hairline bg-[var(--ma-surface-1)]/70 px-4"
        aria-label="Now playing"
      >
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="ma-motive ma-motive-press ma-ring-focus ma-faint hover:text-slate-200"
          aria-label={expanded ? "Collapse transport" : "Expand transport"}
          aria-expanded={expanded}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm border ma-hairline bg-[var(--ma-inset)]">
          {meta.artworkUrl ? (
            <img src={meta.artworkUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Radio className="h-4 w-4 ma-emotion-text" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex min-w-0 max-w-[18rem] flex-col">
            <span className="truncate text-sm font-medium text-slate-100">{meta.title || "Paused in studio"}</span>
            <div className="flex items-center gap-2">
              {playing && (
                <div className="flex h-3 items-end gap-px" aria-hidden="true">
                  {eqLevels.map((level, index) => (
                    <span
                      key={index}
                      className="w-[3px] rounded-sm bg-[var(--ma-status-emotion)]"
                      style={{ height: `${Math.max(8, Math.round((level * 100) ** 0.8 * 90))}%`, opacity: 0.9 }}
                    />
                  ))}
                </div>
              )}
              {bpmLabel && <span className="text-[0.68rem] uppercase tracking-[0.14em] ma-faint">{bpmLabel}</span>}
              <span className="hidden truncate text-[0.68rem] uppercase tracking-[0.14em] ma-faint sm:inline">
                {meta.project}
              </span>
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 flex-col items-center gap-1 md:flex">
            <WaveformStrip
              peaks={peaks}
              currentTime={currentTime}
              duration={duration}
              scrubFrac={scrub ? scrub.frac : null}
              live={playing}
              onScrub={(frac) => setScrub({ frac, active: true })}
              onCommit={onCommit}
            />
            <div className="flex w-full justify-between font-mono text-[0.6rem] ma-faint">
              <span>{timeLabel}</span>
              <span>{durationLabel}</span>
            </div>
          </div>
        </div>

        {transportRow(false)}

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setVolume(volume === 0 ? 1 : 0)}
            className="ma-motive ma-motive-press ma-ring-focus ma-faint hover:text-slate-200"
            aria-label={volume === 0 ? "Unmute" : "Mute"}
          >
            <VolumeIcon className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            aria-label="Volume"
            onChange={(event) => {
              const value = Number(event.target.value);
              setVolume(value);
              if (liveEl) liveEl.volume = value;
            }}
            className="ma-volume-slider hidden w-20 lg:block"
          />
          {playing && (
            <span
              className="ma-live-badge rounded-sm border ma-hairline bg-[var(--ma-status-emotion)]/10 px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-[var(--ma-status-emotion)]"
              data-testid="transport-live"
            >
              <span className="ma-live-dot mr-1 align-middle" aria-hidden="true" />
              Live
            </span>
          )}
        </div>
      </footer>

      {expanded && (
        <div
          className="ma-transport-expanded"
          role="region"
          aria-label="Expanded transport"
          data-testid="transport-expanded"
        >
          <div className="ma-transport-expanded-inner">
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-sm border ma-hairline bg-[var(--ma-inset)]">
                {meta.artworkUrl ? (
                  <img src={meta.artworkUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Radio className="h-8 w-8 ma-emotion-text" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="ma-faint text-[0.625rem] font-semibold uppercase tracking-[0.18em]">
                  Now under the neon
                </div>
                <div className="truncate text-lg font-semibold text-slate-100">{meta.title || "Paused in studio"}</div>
                <div className="mt-0.5 truncate text-xs ma-muted">
                  {meta.project}
                  {bpmLabel ? ` · ${bpmLabel}` : ""}
                </div>
                <MoodBand />
              </div>
            </div>

            <div className="mt-4">
              <WaveformStrip
                peaks={peaks}
                currentTime={currentTime}
                duration={duration}
                scrubFrac={scrub ? scrub.frac : null}
                live={playing}
                onScrub={(frac) => setScrub({ frac, active: true })}
                onCommit={onCommit}
              />
              <div className="mt-1 flex w-full justify-between font-mono text-[0.65rem] ma-faint">
                <span>{timeLabel}</span>
                <span>{durationLabel}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              {transportRow(true)}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setVolume(volume === 0 ? 1 : 0)}
                  className="ma-motive ma-motive-press ma-ring-focus ma-faint hover:text-slate-200"
                  aria-label={volume === 0 ? "Unmute" : "Mute"}
                >
                  <VolumeIcon className="h-5 w-5" />
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  aria-label="Volume"
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setVolume(value);
                    if (liveEl) liveEl.volume = value;
                  }}
                  className="ma-volume-slider w-28"
                />
                {playing && (
                  <span className="ma-live-badge rounded-sm border ma-hairline bg-[var(--ma-status-emotion)]/10 px-2 py-1 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--ma-status-emotion)]">
                    <span className="ma-live-dot mr-1 align-middle" aria-hidden="true" />
                    Live
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}