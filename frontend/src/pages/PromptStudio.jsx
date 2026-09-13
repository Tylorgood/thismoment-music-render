import { useMemo, useState } from "react";
import { Copy, Download, RefreshCw, Sparkles, Music2 } from "lucide-react";
import { toast } from "sonner";
import {
  ALBUM_ARCHETYPES,
  ARCHETYPE_NAMES,
  ARCHETYPE_TAGLINES,
  GENRES,
  buildIngestPack,
  synthesizePrompt,
} from "@/lib/promptEngine";

const EMOTION_LABELS = {
  mean_joy: "Joy",
  mean_trust: "Trust",
  mean_fear: "Fear",
  mean_surprise: "Surprise",
  mean_sadness: "Sadness",
  mean_disgust: "Disgust",
  mean_anger: "Anger",
  mean_anticipation: "Anticipation",
  mean_saturation: "Saturation",
  mean_zero_distance: "Otherness",
  mean_complexity: "Complexity",
  mean_energy: "Energy",
  mean_tension: "Tension",
  mean_resolution: "Resolution",
  mean_activation: "Activation",
  climax_track_index_pct: "Climax position",
  emotional_variance_index: "Emotional variance",
  structural_variance: "Structural variance",
  sonic_variance: "Sonic variance",
  continuity_score: "Continuity",
};

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Slider({ label, value, onChange, min = 0, max = 100, step = 5 }) {
  return (
    <label className="block text-xs text-stone-400">
      <div className="flex justify-between">
        <span>{label}</span>
        <span className="text-[#f1d574]">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[#d4af37]"
      />
    </label>
  );
}

function ArchetypePicker({ weights, setWeights }) {
  function setOne(index, value) {
    const clean = ARCHETYPE_NAMES.map((_, i) => (i === index ? value : 0));
    setWeights(clean);
  }
  return (
    <div className="grid gap-2 md:grid-cols-5">
      {ALBUM_ARCHETYPES.map((archetype, index) => {
        const active = weights[index] > 0;
        return (
          <button
            key={archetype.cluster_id}
            onClick={() => setOne(index, active ? 0 : 100)}
            className={cx(
              "rounded-md border p-3 text-left transition-colors",
              active
                ? "border-[#d4af37]/50 bg-[#d4af37]/10"
                : "border-white/10 bg-black/20 hover:border-white/25"
            )}
          >
            <p className="text-sm font-medium text-[#f1d574]">{ARCHETYPE_NAMES[index]}</p>
            <p className="mt-1 text-xs text-stone-400">Cluster {archetype.cluster_id}</p>
            <p className="mt-1 text-xs text-stone-400">
              {archetype.closest_albums
                .slice(0, 2)
                .map((a) => a.title)
                .join(", ")}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function BlendSliders({ weights, setWeights }) {
  function setValue(index, value) {
    setWeights(weights.map((w, i) => (i === index ? value : w)));
  }
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {ARCHETYPE_NAMES.map((name, index) => (
        <div
          key={index}
          className="rounded-md border border-white/10 bg-black/20 p-3"
        >
          <p className="text-center text-sm text-[#f1d574]">{weights[index]}</p>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={weights[index]}
            onChange={(e) => setValue(index, Number(e.target.value))}
            className="mt-2 w-full accent-[#d4af37]"
          />
          <p className="mt-1 text-center text-xs text-stone-400">{name}</p>
        </div>
      ))}
    </div>
  );
}

function ArchiveItem({ title, prompt }) {
  const length = prompt.length;
  return (
    <tr className="border-t border-white/10">
      <td className="min-w-32 py-3 pr-3 align-top text-sm font-medium text-white">
        {title}
      </td>
      <td className="py-3 text-xs leading-relaxed text-stone-300">
        {prompt.slice(0, 180)}
        {length > 180 ? <span className="text-stone-500"> …</span> : null}
      </td>
    </tr>
  );
}

function copyText(text, label) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error("Clipboard unavailable"));
}

export default function PromptStudio() {
  const [name, setName] = useState("Untitled Album");
  const [genre, setGenre] = useState(GENRES[0].id);
  const [theme, setTheme] = useState("");
  const [trackCount, setTrackCount] = useState(10);
  const [activeSlot, setActiveSlot] = useState(0);
  const [blends, setBlends] = useState(
    Array.from({ length: 10 }, (_, i) => {
      const base = Array(5).fill(0);
      base[i % 5] = 100;
      return base;
    })
  );

  const setBlend = (slotIndex, weights) => {
    setBlends((prev) => prev.map((w, i) => (i === slotIndex ? [...weights] : w)));
  };

  const slotResults = useMemo(
    () =>
      blends.map((weights, index) =>
        synthesizePrompt({
          genre,
          weights,
          slot: { index, total: blends.length },
          theme,
        })
      ),
    [blends, genre, theme]
  );

  const active = slotResults[activeSlot];

  const handleTrackCount = (value) => {
    const next = Math.max(1, Math.min(20, Number(value)));
    setTrackCount(next);
    setBlends((prev) => {
      const grown = Array.from({ length: next }, (_, i) => prev[i] || Array(5).fill(0));
      return grown;
    });
    setActiveSlot((prev) => Math.min(prev, next - 1));
  };

  const exportAll = () => {
    const payload = buildIngestPack({
      albumName: name,
      genre,
      theme,
      weightsBySlot: blends,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name.replace(/\s+/g, "-").toLowerCase()}-suno-ingest.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${blends.length} ingest payloads exported`);
  };

  const exportPasteSheet = () => {
    const lines = [];
    slotResults.forEach((result, index) => {
      lines.push(`=== TRACK ${index + 1} · ${result.title} ===`);
      lines.push(`PROMPT: ${result.prompt}`);
      lines.push(`NEGATIVE: ${result.negative_prompt}`);
      lines.push("");
    });
    const text = lines.join("\n");
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Paste sheet copied (one prompt per song)"))
      .catch(() => toast.error("Clipboard unavailable"));
  };

  const spread = Object.entries(active.analysis.profile)
    .filter(([key]) => key !== "climax_track_index_pct" && key !== "emotional_variance_index")
    .map(([key, value]) => ({ key, value, label: EMOTION_LABELS[key] || key }));

  return (
    <main className="min-h-screen bg-[#090807] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#d4af37]">
              This Moment · album prompter
            </p>
            <h1 className="mt-1 text-3xl font-semibold sm:text-5xl">Prompt Studio</h1>
            <p className="mt-2 max-w-2xl text-sm text-stone-400">
              Pick a genre, a variation from the five recovered album archetypes, and a vision
              prompt. The engine synthesizes 9–14 Suno-ready song prompts you can paste directly
              into Suno, then import as an album playlist.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => copyText(active.prompt, "Style prompt")}
              className="inline-flex items-center gap-2 rounded-md border border-[#d4af37]/40 bg-[#d4af37] px-3 py-2 text-sm font-medium text-black hover:bg-[#e8c14a]"
            >
              <Copy className="h-4 w-4" />
              Copy active
            </button>
            <button
              onClick={exportPasteSheet}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-stone-200 hover:bg-white/10"
            >
              <Copy className="h-4 w-4" />
              Copy paste sheet
            </button>
            <button
              onClick={exportAll}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-stone-200 hover:bg-white/10"
            >
              <Download className="h-4 w-4" />
              Export album
            </button>
          </div>
        </header>

        <div className="mt-6 grid gap-5 border border-white/10 bg-[#11100f] p-4 rounded-lg">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs text-stone-400">
              Album name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/25 p-2.5 text-sm text-white outline-none focus:border-[#d4af37]"
              />
            </label>
            <label className="text-xs text-stone-400">
              Thematic narrative (optional)
              <input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="e.g. the last drive of the night through a city going dark"
                className="mt-1 w-full rounded-md border border-white/10 bg-black/25 p-2.5 text-sm text-white outline-none focus:border-[#d4af37]"
              />
            </label>
            <label className="text-xs text-stone-400">
              Track count (9–14 recommended)
              <input
                type="number"
                min={1}
                max={20}
                value={trackCount}
                onChange={(e) => handleTrackCount(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/25 p-2.5 text-sm text-white outline-none focus:border-[#d4af37]"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-stone-400">
              Genre
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/25 p-2.5 text-sm text-white outline-none focus:border-[#d4af37]"
              >
                {GENRES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <p className="rounded-md border border-[#d4af37]/20 bg-[#d4af37]/5 p-2.5 text-xs text-stone-400">
                Instrument voice from library ground truth · BPM{" "}
                {GENRES.find((g) => g.id === genre)?.bpm ?? "auto"}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-stone-400">Archetype pillars</p>
              <div className="mt-2 space-y-2">
                {ALBUM_ARCHETYPES.map((archetype, index) => (
                  <p key={archetype.cluster_id} className="text-sm text-stone-300">
                    <span className="font-semibold text-[#f1d574]">
                      {ARCHETYPE_NAMES[index]}
                    </span>
                    <span className="text-stone-500"> — {ARCHETYPE_TAGLINES[index]}</span>
                  </p>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-stone-400">Reference albums</p>
              <div className="mt-2 space-y-2">
                {ALBUM_ARCHETYPES.map((archetype) => (
                  <p key={archetype.cluster_id} className="text-sm text-stone-400">
                    <span className="text-[#f1d574]">C{archetype.cluster_id}</span>{" "}
                    {archetype.closest_albums
                      .slice(0, 4)
                      .map((a) => `${a.title} · ${a.artist}`)
                      .join("  |  ")}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[420px_1fr]">
          <div className="space-y-5">
            <div className="rounded-lg border border-white/10 bg-[#11100f] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Track slots</h2>
                <span className="text-xs text-stone-400">{blends.length} tracks</span>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {slotResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveSlot(index)}
                    className={cx(
                      "rounded-md border px-2 py-2 text-center text-sm",
                      index === activeSlot
                        ? "border-[#d4af37]/60 bg-[#d4af37]/15 text-[#f1d574]"
                        : "border-white/10 bg-black/20 text-stone-300"
                    )}
                  >
                    <span className="block text-xs">{index + 1}</span>
                    <span className="block truncate text-[10px] text-stone-500">
                      {result.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#11100f] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Slot {activeSlot + 1} blend</h2>
                <span className="text-xs text-stone-400">
                  Dominant: {ARCHETYPE_NAMES[active.dominantCluster]}
                </span>
              </div>
              <div className="mt-3">
                <BlendSliders weights={blends[activeSlot]} setWeights={(w) => setBlend(activeSlot, w)} />
              </div>
              <div className="mt-4">
                <p className="text-xs uppercase text-stone-400">Quick set</p>
                <div className="mt-2">
                  <ArchetypePicker
                    weights={blends[activeSlot]}
                    setWeights={(w) => setBlend(activeSlot, w)}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#11100f] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Blended features</h2>
                <p className="text-xs text-stone-500">weighted centroid</p>
              </div>
              <div className="mt-3 space-y-3">
                {spread.slice(0, 8).map(({ key, value, label }) => (
                  <Slider
                    key={key}
                    label={label}
                    value={Math.round(value)}
                    onChange={() => {}}
                    min={0}
                    max={100}
                    step={1}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-stone-500">
                Features are fixed by the archetype blend; drag the blend sliders above to shape
                them.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-lg border border-white/10 bg-[#11100f] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Music2 className="h-5 w-5 text-[#d4af37]" />
                  <div>
                    <p className="text-xs uppercase text-stone-400">Suno style prompt</p>
                    <h2 className="text-2xl font-semibold">{active.title}</h2>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setBlend(
                      activeSlot,
                      Array.from({ length: 5 }, () => 20)
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-stone-200 hover:bg-white/10"
                >
                  <RefreshCw className="h-4 w-4" />
                  Even blend
                </button>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase text-stone-400">Mood / texture / structure</p>
                <p className="text-sm text-stone-300">
                  {active.analysis.emotions.length
                    ? `${active.analysis.emotions.join(", ")} · ${active.analysis.density} · ${active.analysis.texture.join(", ")}`
                    : "No dominant emotions above threshold"}
                </p>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-md border border-white/10 bg-black/25 p-3">
                  <p className="text-xs uppercase text-stone-400">Style prompt</p>
                  <p className="mt-2 max-h-72 overflow-auto text-sm leading-relaxed text-stone-200">
                    {active.prompt}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => copyText(active.prompt, "Style prompt")}
                      className="inline-flex items-center gap-2 rounded-md border border-[#d4af37]/40 bg-[#d4af37]/15 px-2.5 py-1.5 text-xs text-[#f1d574] hover:bg-[#d4af37]/25"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                  </div>
                </div>
                <div className="rounded-md border border-white/10 bg-black/25 p-3">
                  <p className="text-xs uppercase text-stone-400">Negative prompt</p>
                  <p className="mt-2 text-sm leading-relaxed text-stone-200">
                    {active.negative_prompt}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => copyText(active.negative_prompt, "Negative prompt")}
                      className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-stone-300 hover:bg-white/10"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#11100f] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Structure guide</h2>
                <Sparkles className="h-4 w-4 text-[#d4af37]" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-stone-300">
                {active.analysis.structure.length
                  ? active.analysis.structure.join(". ")
                  : "Even-flow arrangement; the blend produced no strong structural directives."}{" "}
                The peak should {active.analysis.climax}.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#11100f] p-4">
              <h2 className="text-lg font-semibold">Full album</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="text-xs uppercase text-stone-400">Title</th>
                      <th className="text-xs uppercase text-stone-400">Prompt preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slotResults.map((result, index) => (
                      <ArchiveItem
                        key={index}
                        title={`${index + 1}. ${result.title}`}
                        prompt={result.prompt}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}