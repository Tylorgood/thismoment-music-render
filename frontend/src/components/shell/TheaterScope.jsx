import { useEffect, useRef, useState } from "react";
import { subscribe, getState, clamp01 } from "@/lib/reactiveBus";
import { pickEmotionColor, lerpRgb } from "@/lib/ambient";

const TAU = Math.PI * 2;

function rgba([r, g, b], a) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

function barColor(mood, alpha) {
  return rgba(pickEmotionColor(mood), alpha);
}

function drawScope(ctx, width, height, dpr, state) {
  ctx.clearRect(0, 0, width, height);
  const spectrum = state.spectrum || [];
  const energy = state.energy;
  const mood = state.mood;

  const stripH = Math.round(height * 0.28);
  const count = Math.min(spectrum.length, 26);
  const gap = 1.5;
  const barW = Math.max(1, (width - gap * (count - 1)) / count);
  for (let i = 0; i < count; i += 1) {
    const v = spectrum[i] || 0;
    const h = Math.max(2, Math.pow(v, 0.72) * (stripH - 4)) * (0.55 + energy * 0.45);
    const bassBoost = i < 5 ? state.transient * 0.5 : 0;
    const x = i * (barW + gap);
    const alpha = 0.35 + energy * 0.4 + bassBoost;
    ctx.fillStyle = barColor(mood, clamp01(alpha));
    ctx.fillRect(x, stripH - h, barW, h);
  }

  const dialY = stripH + (height - stripH) * 0.5;
  const cx = width / 2;
  const baseR = Math.min(width, height - stripH) * 0.34;
  const r = baseR * (0.92 + energy * 0.22) * (0.94 + state.bass * 0.12);
  const zero = state.zeroDistance;

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, dialY, r + 8, 0, TAU);
  ctx.stroke();

  const color = pickEmotionColor(mood);
  const spikes = 22;
  for (let i = 0; i < spikes; i += 1) {
    const t = (i / spikes) * TAU;
    const air = state.air * 0.9 + state.high * 0.35;
    const spike = 3 + air * (7 + state.shimmer * 7);
    const distance = r + spike;
    const fromX = cx + Math.cos(t) * r;
    const fromY = dialY + Math.sin(t) * r;
    const toX = cx + Math.cos(t) * distance;
    const toY = dialY + Math.sin(t) * distance;
    const flicker = 0.22 + state.shimmer * 0.4 + (i % 4 === 0 ? state.transient * 0.3 : 0);
    ctx.strokeStyle = rgba(color, clamp01(flicker));
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
  }

  const sweep = state.bpmPhase * TAU - Math.PI / 2;
  const pulseLen = 4 + state.bass * (r * 0.16) + state.transient * (r * 0.12);
  const sweeps = [
    [r - pulseLen, r, 0.28 + energy * 0.35],
    [r - pulseLen - 5, r - 2, 0.12 + state.transient * 0.2],
  ];
  for (const [r0, r1, a] of sweeps) {
    ctx.strokeStyle = rgba(color, clamp01(a));
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx, dialY, r1, sweep - 0.32, sweep + 0.32);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, dialY, r0, sweep - 0.18, sweep + 0.18);
    ctx.stroke();
  }

  const asym = 1 - zero;
  const mirrored = pickEmotionColor(mood + 0.08);
  for (let i = 0; i < spikes; i += 1) {
    const base = (i / spikes) * TAU;
    const t = base + Math.PI;
    const offset = r * asym * 0.06;
    const distance = r + offset;
    ctx.strokeStyle = rgba(mirrored, clamp01(0.1 + zero * 0.28));
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(t) * r, dialY + Math.sin(t) * r);
    ctx.lineTo(cx + Math.cos(t) * distance, dialY + Math.sin(t) * distance);
    ctx.stroke();
  }

  ctx.fillStyle = rgba(lerpRgb(color, [255, 255, 255], 0.12), 0.5 + state.transient * 0.5);
  ctx.beginPath();
  ctx.arc(cx, dialY, 3 + state.bass * 2, 0, TAU);
  ctx.fill();
}

export default function TheaterScope() {
  const canvasRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(false);

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const box = canvas.parentElement;
      width = Math.max(120, box ? box.clientWidth : 240);
      height = 208;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const paint = (current) => drawScope(ctx, width, height, dpr, current);

    if (reducedMotion) {
      paint(getState());
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }

    const unsubscribe = subscribe((currentState) => paint(currentState));
    window.addEventListener("resize", resize);
    return () => {
      unsubscribe();
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion]);

  return (
    <div className="ma-theater-scope" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}