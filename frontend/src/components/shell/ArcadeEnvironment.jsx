import { useEffect, useRef, useState } from "react";
import { useTheaterContext } from "@/lib/theaterContext";
import { pickEmotionColor, lerpRgb } from "@/lib/ambient";
import { subscribe, setMetadata, getState, clamp01 } from "@/lib/reactiveBus";

const TAU = Math.PI * 2;
const PARTICLES = 44;
const RIBBON_SEGMENTS = 96;
const BAND_SEGMENTS = 128;

function debugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("react") === "debug") return true;
  } catch {
    return false;
  }
  return window.__reactDebug === true;
}

function hueRgb(h, s, l, a) {
  const hue = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return `rgba(${v}, ${v}, ${v}, ${a})`;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  const r = Math.round(channel(hue + 1 / 3) * 255);
  const g = Math.round(channel(hue) * 255);
  const b = Math.round(channel(hue - 1 / 3) * 255);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function noise(x) {
  return (
    Math.sin(x * 1.27 + 0.7) * 0.55 +
    Math.sin(x * 2.71 + 1.7) * 0.28 +
    Math.sin(x * 5.13 + 0.31) * 0.14 +
    Math.sin(x * 9.6 + 2.1) * 0.07
  );
}

function edgeColor(phase, mood, zeroDistance) {
  const spectral = hueRgb(310 - (((phase % 1) + 1) % 1) * 360, 0.72, 0.58, 1);
  const match = spectral.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  const spec = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [180, 120, 250];
  const emotion = pickEmotionColor(mood);
  const dominance = clamp01(1 - zeroDistance) * 0.72;
  const mixed = lerpRgb(spec, emotion, dominance);
  return [mixed[0], mixed[1], mixed[2]];
}

function fillGradient(ctx, x0, y0, x1, y1, phase, mood, zeroDistance, alpha) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  const stops = 12;
  for (let i = 0; i <= stops; i += 1) {
    const t = i / stops;
    const [r, g, b] = edgeColor(phase + t, mood, zeroDistance);
    gradient.addColorStop(t, `rgba(${r}, ${g}, ${b}, ${alpha})`);
  }
  return gradient;
}

function drawCurtain(ctx, length, depth, phase, state, alpha, detail) {
  const segments = detail ? RIBBON_SEGMENTS : BAND_SEGMENTS;
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const x = (i / segments) * length;
    const nx = (i / segments) * (detail ? 6 : 9);
    const wave =
      state.low * 26 * noise(nx * 1.4 + phase * 1.6) +
      state.mid * 13 * noise(nx * 2.6 + phase * 2.4) +
      state.high * 6 * noise(nx * 5.1 + phase * 3.1) +
      state.air * 3.5 * noise(nx * 8.7 + phase * 4.3) +
      state.transient * 22 * noise(nx * 3.3 + phase * 6.1);
    points.push([x, depth + wave]);
  }
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.lineTo(length, depth + 90);
  ctx.lineTo(0, depth + 90);
  ctx.closePath();
  ctx.fillStyle = fillGradient(ctx, 0, 0, length, 0, phase, state.mood, state.zeroDistance, alpha);
  ctx.fill();

  const lineGradient = fillGradient(
    ctx,
    0,
    0,
    length,
    0,
    phase,
    state.mood,
    state.zeroDistance,
    0.5 + state.shimmer * 0.4
  );
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = lineGradient;
  ctx.lineWidth = 1.1 + state.transient * 1.6;
  ctx.stroke();
}

function drawEdge(ctx, width, height, edge, phase, state, energy) {
  const depth = 30 + energy * 150 + state.breathe * 70;
  const alpha = (0.1 + state.penetrate * 0.16) * (0.35 + state.shimmer * 0.5);
  ctx.save();
  if (edge === "top") {
    ctx.translate(0, -6);
  } else if (edge === "bottom") {
    ctx.translate(0, height + 6);
    ctx.rotate(Math.PI);
  } else if (edge === "left") {
    ctx.translate(-6, height);
    ctx.rotate(-Math.PI / 2);
  } else {
    ctx.translate(width + 6, 0);
    ctx.rotate(Math.PI / 2);
  }
  const length = edge === "top" || edge === "bottom" ? width : height;
  drawCurtain(ctx, length, depth, phase + (edge === "left" ? 0.25 : edge === "bottom" ? 0.5 : edge === "right" ? 0.75 : 0), state, alpha, false);
  drawCurtain(ctx, length, depth * 0.55, phase + 0.13 + (edge === "left" ? 0.25 : edge === "bottom" ? 0.5 : edge === "right" ? 0.75 : 0), state, alpha * 0.7, true);
  ctx.restore();
}

function drawTopBand(ctx, width, baseline, phase, state) {
  const segments = BAND_SEGMENTS;
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const x = (i / segments) * width;
    const nx = (i / segments) * 11;
    const wave =
      state.low * 30 * noise(nx * 1.3 + phase * 1.2) +
      state.mid * 15 * noise(nx * 2.9 + phase * 2.6) +
      state.high * 7 * noise(nx * 6.0 + phase * 3.8) +
      state.air * 4 * noise(nx * 11.0 + phase * 5.2) +
      state.transient * 34 * noise(nx * 4.4 + phase * 7.7);
    points.push([x, baseline + wave]);
  }
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.lineTo(width, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fillStyle = fillGradient(ctx, 0, 0, width, 0, phase, state.mood, state.zeroDistance, 0.16 + state.energy * 0.22);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = fillGradient(ctx, 0, 0, width, 0, phase, state.mood, state.zeroDistance, 0.55 + state.shimmer * 0.4);
  ctx.lineWidth = 1.2 + state.transient * 2.2;
  ctx.stroke();
}

function makeParticles(width, height) {
  const list = [];
  for (let i = 0; i < PARTICLES; i += 1) {
    list.push({
      x: Math.random() * width,
      y: Math.random() * height,
      z: 0.2 + Math.random() * 0.8,
      vx: (Math.random() - 0.5) * 6,
      vy: -4 - Math.random() * 8,
      spark: 0,
    });
  }
  return list;
}

function stepParticles(list, width, height, dt, state, phase) {
  for (let i = 0; i < list.length; i += 1) {
    const p = list[i];
    const speed = 0.35 + p.z * 0.9 + state.air * 1.6;
    p.x += p.vx * dt * speed + Math.sin(phase * 1.4 + i) * 4 * dt * (0.4 + state.mid);
    p.y += p.vy * dt * speed;
    p.spark = Math.max(0, p.spark - dt * 1.6);
    if (state.transient > 0.4 && Math.random() < 0.02) p.spark = 1;
    if (p.y < -12) {
      p.y = height + 12;
      p.x = Math.random() * width;
    }
    if (p.x < -12) p.x = width + 12;
    if (p.x > width + 12) p.x = -12;
  }
}

function drawParticles(ctx, list, state) {
  for (let i = 0; i < list.length; i += 1) {
    const p = list[i];
    const glow = 0.05 + state.air * 0.45 * p.z + p.spark * 0.6;
    const radius = 0.6 + p.z * 1.9 + p.spark * 2.4;
    const [r, g, b] = edgeColor(0.62 + p.z * 0.18 + p.spark * 0.05, state.mood, state.zeroDistance);
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 3);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${clamp01(glow)})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 3, 0, TAU);
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}

function sceneMeta(theater) {
  const analysis = theater?.analysis || null;
  const energyLabel = analysis?.energy_label || null;
  const bpm = Number(analysis?.bpm) || 0;
  const zeroDistanceRaw = Number(analysis?.mean_zero_distance ?? analysis?.zero_distance);
  return {
    bpm,
    firstBeat: Number(analysis?.first_beat) || 0,
    energy_label: energyLabel,
    playing: Boolean(theater?.playing),
    zeroDistance: Number.isFinite(zeroDistanceRaw) ? clamp01(zeroDistanceRaw / 100) : null,
    emotionT: null,
  };
}

export default function ArcadeEnvironment() {
  const theater = useTheaterContext();
  const canvasRef = useRef(null);
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
      if (event.ctrlKey && event.altKey && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        window.__reactDebug = !window.__reactDebug;
        setDebug(Boolean(window.__reactDebug));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let phase = 0;

    const resize = () => {
      const nextWidth = window.innerWidth;
      const nextHeight = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.min(nextWidth, 2560);
      height = nextHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${nextWidth}px`;
      canvas.style.height = `${nextHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = makeParticles(width, height);
    };

    resize();

    const render = (state, dt, advance) => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      const baseline = 66 + state.breathe * 26;
      if (!reducedMotion) phase += dt * (0.02 + state.mid * 0.07);
      drawTopBand(ctx, width, baseline, phase, state);
      drawEdge(ctx, width, height, "top", phase, state, state.energy);
      drawEdge(ctx, width, height, "bottom", phase + 0.5, state, state.energy * 0.85);
      drawEdge(ctx, width, height, "left", phase + 0.2, state, state.energy * 0.7);
      drawEdge(ctx, width, height, "right", phase + 0.7, state, state.energy * 0.7);
      if (advance) stepParticles(particles, width, height, dt, state, phase);
      drawParticles(ctx, particles, state);
      ctx.globalCompositeOperation = "source-over";
    };

    if (reducedMotion) {
      render(getState(), 0, false);
      const onResize = () => {
        resize();
        render(getState(), 0, false);
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    let visible = !document.hidden;
    const onVisibility = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    const unsubscribe = subscribe((state, dt) => {
      if (!visible) return;
      render(state, dt, true);
    });

    window.addEventListener("resize", resize);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion]);

  useEffect(() => {
    setMetadata(sceneMeta(theater));
  }, [theater]);

  return (
    <div className="ma-arcade-environment" data-react-live={theater?.playing ? "true" : "false"} aria-hidden="true">
      <canvas ref={canvasRef} className="ma-arcade-env-canvas" />
      {debug ? (
        <pre className="ma-ambient-debug ma-react-debug" aria-hidden="true">
          reactive 8G
          {"\n"}playing: {theater?.playing ? "yes" : "no"}
          {"\n"}reduced-motion: {reducedMotion ? "on" : "off"}
          {"\n"}
          {JSON.stringify(getState())}
        </pre>
      ) : null}
    </div>
  );
}
