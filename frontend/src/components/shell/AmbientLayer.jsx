import { useEffect, useMemo, useState } from "react";
import { useTheaterContext } from "@/lib/theaterContext";
import {
  buildAmbient,
  modeFor,
  intensityFor,
  pickFromAnalysis,
  neutralAmbient,
  energyFromLabel,
  analysisKey,
  readArtworkPalette,
  rgbTriplet,
} from "@/lib/ambient";

const ORB_TEMPLATES = [
  { role: "topLeft", style: { top: "-18%", left: "-14%", width: "54vmax", height: "54vmax" }, base: 0.5, duration: 22 },
  { role: "bottomRight", style: { bottom: "-24%", right: "-12%", width: "50vmax", height: "50vmax" }, base: 0.44, duration: 30 },
  { role: "centerTop", style: { top: "-16%", right: "6%", width: "34vmax", height: "34vmax" }, base: 0.34, duration: 26 },
];

function debugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ambient") === "debug") return true;
  } catch {
    return false;
  }
  return window.__ambientDebug === true;
}

export default function AmbientLayer() {
  const theater = useTheaterContext();
  const [ambient, setAmbient] = useState(() => buildAmbient({}));
  const [reducedMotion, setReducedMotion] = useState(false);
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    const query = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (!query) return;
    const update = () => setReducedMotion(query.matches);
    update();
    if (query.addEventListener) {
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }
    query.addListener(update);
    return () => query.removeListener(update);
  }, []);

  useEffect(() => {
    setDebug(debugEnabled());
    const onKey = (event) => {
      if (event.ctrlKey && event.altKey && (event.key === "d" || event.key === "D")) {
        event.preventDefault();
        setDebug((current) => !current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const playing = Boolean(theater?.playing);
  const scene = Boolean(theater?.albumName);

  const analysis = useMemo(() => {
    const source = theater?.analysis;
    if (!source) return null;
    return {
      status: source.status,
      energy_label: source.energy_label,
      bpm: Number(source.bpm),
      key: source.key,
      beat_confidence: Number(source.beat_confidence),
    };
  }, [theater?.analysis]);
  const artKey = theater?.artworkUrl || "";
  const analysisDep = analysisKey(analysis);
  const sceneDep = theater?.albumName || "";

  useEffect(() => {
    let alive = true;
    setAmbient(buildAmbient({}));

    const mode = modeFor({ playing, scene });
    if (playing) {
      const analysisColors = pickFromAnalysis(analysis);
      const energyT = energyFromLabel(analysis?.energy_label);
      const intensity = intensityFor({
        playing,
        energyT: energyT != null ? energyT : Number.isFinite(Number(analysis?.bpm)) ? 0.5 : null,
        confidence: Number(analysis?.beat_confidence),
      });
      if (artKey) {
        const fallback = buildAmbient({ source: "analysis", colors: analysisColors, intensity, mode });
        setAmbient(fallback);
        readArtworkPalette(artKey).then((palette) => {
          if (!alive) return;
          if (palette && palette.length) {
            setAmbient(buildAmbient({ source: "artwork", colors: palette, intensity, mode, meta: { count: palette.length } }));
          } else {
            setAmbient(buildAmbient({ source: "analysis", colors: analysisColors, intensity, mode }));
          }
        });
      } else {
        setAmbient(buildAmbient({ source: "analysis", colors: analysisColors, intensity, mode }));
      }
    } else if (scene) {
      setAmbient(buildAmbient({ source: "scene", colors: neutralAmbient(), intensity: 0.32, mode }));
    } else {
      setAmbient(buildAmbient({ source: "neutral", colors: neutralAmbient(), intensity: 0, mode }));
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, scene, artKey, analysisDep, sceneDep]);

  useEffect(() => {
    window.__ambientDebug = { ...ambient, reducedMotion };
  }, [ambient, reducedMotion]);

  const { colors, intensity, mode, source } = ambient;
  const tierOpacity = mode === "stage" ? 1 : mode === "wait" ? 0.55 : 0;

  return (
    <div
      className="ma-ambient-layer"
      data-ambient-source={source}
      data-ambient-mode={mode}
      data-ambient-intensity={intensity.toFixed(2)}
      aria-hidden="true"
    >
      {ORB_TEMPLATES.map((orb, index) => (
        <div
          key={orb.role}
          className={`ma-ambient-orb ma-ambient-orb-${orb.role}`}
          style={{
            ...orb.style,
            color: `rgb(${rgbTriplet(colors[index % colors.length])})`,
            opacity: tierOpacity * orb.base * (0.35 + 0.65 * intensity),
            animationDuration: `${orb.duration}s`,
          }}
        />
      ))}
      {debug ? (
        <pre className="ma-ambient-debug" aria-hidden="true">
          ambient 8A
          {"\n"}source: {source}
          {"\n"}mode: {mode}
          {"\n"}intensity: {intensity.toFixed(2)}
          {"\n"}tier: {tierOpacity.toFixed(2)}
          {"\n"}reduced-motion: {reducedMotion ? "on" : "off"}
          {"\n"}colors: {colors.map(rgbTriplet).join(" / ")}
        </pre>
      ) : null}
    </div>
  );
}