import { useMemo, useRef, useState } from "react";
import { Copy, Download, RefreshCw, Sparkles, Music2, Layers, FolderOpen, Save, GitBranch, CopyPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ALBUM_ARCHETYPES,
  ARCHETYPE_NAMES,
  ARCHETYPE_TAGLINES,
  GENRES,
  buildIngestPack,
  synthesizePrompt,
} from "@/lib/promptEngine";
import {
  TRACK_ROLES,
  ALBUM_ENGINE_VERSION,
  buildAlbumBlueprint,
  buildAlbumExport,
  buildJourneyView,
  regenerateSlot,
} from "@/lib/albumEngine";
import validateMatrix from "@/lib/matrixValidation";
import { serializeAlbum, deserializeAlbum, toRestorePatch } from "@/lib/albumProjectSerializer";
import {
  listProjects,
  getProject,
  getProjectVersion,
  createProject,
  saveState,
  createVersion,
  duplicateProject,
  renameProject,
  deleteProject,
  getProjectToken,
  setProjectToken,
  ProjectTokenError,
} from "@/lib/albumProjects";
import AlbumWizard from "@/components/AlbumWizard";
import AlbumJourney from "@/components/AlbumJourney";
import BlueprintReview from "@/components/BlueprintReview";
import AlbumProduction from "@/components/AlbumProduction";
import { emptyProduction, buildProductionManifest } from "@/lib/albumProduction";
import { searchLibraryTracks } from "@/lib/albumProjects";

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

const ROLE_CLASS = {
  opener: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  body: "bg-white/5 text-stone-300 border-white/10",
  lift: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  interlude: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  climax: "bg-[#d4af37]/20 text-[#f1d574] border-[#d4af37]/40",
  descent: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  closer: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};
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
  const [templateArchetype, setTemplateArchetype] = useState(null);
  const [albumNonce, setAlbumNonce] = useState(0);
  const [mode, setMode] = useState("wizard");
  const [wizardDna, setWizardDna] = useState(null);
  const [slotEdits, setSlotEdits] = useState({});
  const [showReview, setShowReview] = useState(false);
  const [approval, setApproval] = useState({ plan: false, slots: {} });
  const storedRef = useRef(null);
  const [currentProject, setCurrentProject] = useState(null);
  const [projectWarnings, setProjectWarnings] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [showProjects, setShowProjects] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [projectVersions, setProjectVersions] = useState([]);
  const projectsTokenSet = Boolean(getProjectToken());
  const [production, setProduction] = useState({ status: "draft", slots: {} });
  const [libraryCache, setLibraryCache] = useState({});
  const [blends, setBlends] = useState(
    Array.from({ length: 10 }, (_, i) => {
      const base = Array(5).fill(0);
      base[i % 5] = 100;
      return base;
    })
  );

  const updateSlotEdit = (index, patch) => {
    setSlotEdits((prev) => ({ ...prev, [index]: { ...(prev[index] || {}), ...patch } }));
  };

  const blueprint = useMemo(() => {
    if (templateArchetype === null) return null;
    const key = JSON.stringify({ name, genre, theme, trackCount, templateArchetype, albumNonce, wizardDna });
    if (storedRef.current && storedRef.current.key === key && storedRef.current.blueprint) {
      return storedRef.current.blueprint;
    }
    const count = Math.max(4, Math.min(14, Number(trackCount) || 10));
    const variantSeeds = {};
    if (albumNonce > 0) {
      for (let i = 0; i < count; i += 1) variantSeeds[i] = albumNonce;
    }
    return buildAlbumBlueprint({
      albumName: name,
      genre,
      theme,
      trackCount: count,
      archetypeIndex: templateArchetype,
      variantSeeds,
      slotWeights: wizardDna ? wizardDna.slotWeights : [],
      climaxPctOverride: wizardDna ? wizardDna.climaxPctOverride : null,
      endingBias: wizardDna ? wizardDna.endingBias : null,
      seedBase: wizardDna ? wizardDna.seedBase : 0,
      tempoBehavior: wizardDna ? wizardDna.tempo?.behavior ?? "locked" : "locked",
      tempoSeed: wizardDna ? wizardDna.tempo?.seed ?? 0 : 0,
    });
  }, [name, genre, theme, trackCount, templateArchetype, albumNonce, wizardDna]);

  const handleWizardLaunch = (intent) => {
    setName(intent.album.name);
    setGenre(intent.album.genre);
    setTheme(intent.album.theme);
    setTrackCount(intent.album.trackCount);
    setWizardDna(intent);
    setTemplateArchetype(intent.archetypeWeights.indexOf(Math.max(...intent.archetypeWeights)));
    setSlotEdits({});
    setApproval({ plan: false, slots: {} });
    setProduction(emptyProduction(intent.album.trackCount || 10));
    setMode("studio");
  };

  const albumSlots = useMemo(() => {
    if (!blueprint) return null;
    return blueprint.slots.map((slot, i) => {
      const e = slotEdits[i];
      if (!e || (!e.role && !e.weights && !e.note && !e.variantSeed)) return slot;
      return regenerateSlot(blueprint, i, {
        role: e.role || null,
        variantSeed: e.variantSeed ? slot.variantSeed + e.variantSeed : slot.variantSeed,
        note: e.note ?? slot.note,
        weights: e.weights || null,
      });
    });
  }, [blueprint, slotEdits]);

  const setBlend = (slotIndex, weights) => {
    if (albumSlots) updateSlotEdit(slotIndex, { weights });
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

  const effectiveSlots = albumSlots || slotResults;
  const activeBlueprint = useMemo(
    () => (blueprint ? { bible: blueprint.bible, slots: albumSlots || blueprint.slots } : null),
    [blueprint, albumSlots]
  );
  const journey = useMemo(
    () => (activeBlueprint ? buildJourneyView(activeBlueprint) : null),
    [activeBlueprint]
  );
  const matrix = useMemo(
    () => (activeBlueprint ? validateMatrix(activeBlueprint) : null),
    [activeBlueprint]
  );
  const matrixFails = matrix?.level === "fail";
  const active = effectiveSlots[activeSlot] || slotResults[activeSlot];

  const handleApprove = () => {
    if (!matrix || matrixFails) {
      toast.error("Album plan fails matrix checks — fix the flagged rule before approving.");
      return;
    }
    const slots = {};
    activeBlueprint.slots.forEach((_, i) => {
      slots[i] = "approved";
    });
    setApproval({ plan: true, slots });
    toast.success(`Plan approved · matrix score ${matrix.score}`);
    setShowReview(false);
  };

  const savedBlueprint = useMemo(() => {
    if (!blueprint) return null;
    return {
      ...blueprint,
      slots: albumSlots || blueprint.slots,
      chemistry: journey?.slots.map((s) => s.chemistry).filter(Boolean) || blueprint.chemistry,
      tempo: journey?.tempo || blueprint.tempo,
      tempoBehavior: journey?.tempoBehavior || blueprint.tempoBehavior,
    };
  }, [blueprint, albumSlots, journey]);

  const handleProjectError = (error) => {
    if (error instanceof ProjectTokenError) {
      setShowProjects(true);
      toast.error("Project writes need a save token — enter it below.");
      return;
    }
    toast.error(error.message || "Album project request failed");
  };

  const refreshProjects = async () => {
    try {
      setProjectsList(await listProjects());
    } catch (error) {
      handleProjectError(error);
    }
  };

  const hydrateFromSnapshot = ({ id, restored }, version = null) => {
    if (!restored.blueprint) {
      toast.error("That snapshot has no blueprint — open the latest version that does.");
      return false;
    }
    const key = JSON.stringify({
      name: restored.name,
      genre: restored.inputs.genre || GENRES[0].id,
      theme: restored.inputs.theme || "",
      trackCount: Number(restored.inputs.trackCount) || 10,
      templateArchetype: restored.inputs.templateArchetype ?? null,
      albumNonce: Number(restored.inputs.albumNonce) || 0,
      wizardDna: restored.inputs.wizardDna || null,
    });
    storedRef.current = { key, blueprint: restored.blueprint };
    setName(restored.name);
    setGenre(restored.inputs.genre || GENRES[0].id);
    setTheme(restored.inputs.theme || "");
    setTrackCount(Number(restored.inputs.trackCount) || 10);
    setTemplateArchetype(restored.inputs.templateArchetype ?? null);
    setAlbumNonce(Number(restored.inputs.albumNonce) || 0);
    setWizardDna(restored.inputs.wizardDna || null);
    setSlotEdits({});
    setApproval(restored.approval || { plan: false, slots: {} });
    setProduction(restored.production || emptyProduction(Number(restored.inputs.trackCount) || 10));
    setCurrentProject({
      id,
      name: restored.name,
      engine_version: restored.engine_version,
      engineMatches: restored.engineMatches,
    });
    setProjectWarnings(restored.warnings || []);
    setShowReview(false);
    setMode("studio");
    toast.success(version !== null ? `Restored version ${version} of "${restored.name}"` : `Loaded "${restored.name}"`);
    return true;
  };

  const handleSaveProject = async () => {
    if (!blueprint) {
      toast.info("Generate an album before saving");
      return;
    }
    if (matrixFails) {
      toast.error("Fix matrix failures before saving");
      return;
    }
    const serialized = serializeAlbum(savedBlueprint, {
      name,
      genre,
      theme,
      trackCount,
      templateArchetype,
      albumNonce,
      wizardDna,
      slotEdits,
      approval,
      production,
    });
    try {
      if (currentProject?.id) {
        await saveState(currentProject.id, toRestorePatch(serialized));
        toast.success(`Saved "${currentProject.name}"`);
      } else {
        const created = await createProject(serialized);
        setCurrentProject({
          id: created.id,
          name: serialized.name,
          engine_version: serialized.engine_version,
          engineMatches: true,
        });
        toast.success(`Project created as "${serialized.name}"`);
      }
      refreshProjects();
    } catch (error) {
      handleProjectError(error);
    }
  };

  const handleSaveVersion = async () => {
    if (!currentProject?.id) {
      toast.info("Save the project first, then checkpoint a version");
      return;
    }
    try {
      const label = versionLabel.trim();
      const result = await createVersion(currentProject.id, label);
      setVersionLabel("");
      refreshProjects();
      toast.success(`Version ${result.version} saved${label ? ` — "${label}"` : ""}`);
    } catch (error) {
      handleProjectError(error);
    }
  };

  const handleDuplicate = async () => {
    if (!currentProject?.id) return;
    try {
      const result = await duplicateProject(currentProject.id);
      refreshProjects();
      toast.success(`Duplicate created: ${result.name}`);
    } catch (error) {
      handleProjectError(error);
    }
  };

  const handleRename = async () => {
    if (!currentProject?.id || !renameDraft.trim()) return;
    try {
      const next = renameDraft.trim();
      await renameProject(currentProject.id, next);
      setName(next);
      setCurrentProject((p) => ({ ...p, name: next }));
      setRenameDraft("");
      refreshProjects();
      toast.success("Renamed");
    } catch (error) {
      handleProjectError(error);
    }
  };

  const handleDelete = async () => {
    if (!currentProject?.id) return;
    if (!window.confirm(`Delete album project "${currentProject.name}"? This cannot be undone.`)) return;
    try {
      await deleteProject(currentProject.id);
      setCurrentProject(null);
      refreshProjects();
      toast.success("Project deleted (the album stays open here)");
    } catch (error) {
      handleProjectError(error);
    }
  };

  const handleOpenProject = async (id) => {
    try {
      const payload = await getProject(id);
      const restored = deserializeAlbum(payload);
      setProjectVersions(payload.versions || []);
      hydrateFromSnapshot({ id, restored });
    } catch (error) {
      handleProjectError(error);
    }
  };

  const handleFetchTrack = async (query) => {
    const tracks = await searchLibraryTracks(query);
    const nextCache = { ...libraryCache };
    tracks.forEach((track) => {
      nextCache[track.id] = track;
    });
    setLibraryCache(nextCache);
    return tracks;
  };

  const handleFinishAlbum = async () => {
    const finished = { ...production, status: "finished" };
    setProduction(finished);
    toast.success("Album finished — all tracks accepted");
    if (currentProject?.id) {
      try {
        const serialized = serializeAlbum(savedBlueprint, {
          name,
          genre,
          theme,
          trackCount,
          templateArchetype,
          albumNonce,
          wizardDna,
          slotEdits,
          approval,
          production: finished,
        });
        await saveState(currentProject.id, { ...toRestorePatch(serialized), status: "finished" });
        refreshProjects();
      } catch (error) {
        handleProjectError(error);
      }
    }
  };

  const handleExportManifest = () => {
    if (!activeBlueprint) return;
    const manifest = buildProductionManifest(activeBlueprint, production, libraryCache);
    const blob = new Blob([JSON.stringify({ album: activeBlueprint.bible.album.name, finished: production.status === "finished", tracks: manifest }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name.replace(/\s+/g, "-").toLowerCase()}-production-manifest.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Production manifest exported");
  };

  const handleOpenVersion = async (version) => {
    if (!currentProject?.id) return;
    try {
      const payload = await getProjectVersion(currentProject.id, version);
      const restored = deserializeAlbum({
        name: payload.snapshot_name,
        engine_version: payload.engine_version,
        inputs: payload.inputs,
        blueprint: payload.blueprint,
        approval: payload.approval,
      });
      hydrateFromSnapshot({ id: currentProject.id, restored }, version);
    } catch (error) {
      handleProjectError(error);
    }
  };

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
    if (activeBlueprint) {
      const ex = buildAlbumExport(activeBlueprint, {});
      const blob = new Blob([JSON.stringify(ex.ingest, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${name.replace(/\s+/g, "-").toLowerCase()}-suno-ingest.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${effectiveSlots.length} ingest payloads exported`);
    } else {
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
    }
  };

  const exportPasteSheet = () => {
    if (activeBlueprint) {
      const { pasteSheet } = buildAlbumExport(activeBlueprint, {});
      navigator.clipboard
        .writeText(pasteSheet)
        .then(() => toast.success("Album paste sheet copied"))
        .catch(() => toast.error("Clipboard unavailable"));
    } else {
      const lines = [];
      effectiveSlots.forEach((result, index) => {
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
    }
  };

  const spread = Object.entries(active.profile ?? {})
    .filter(([key]) => key !== "climax_track_index_pct" && key !== "emotional_variance_index")
    .map(([key, value]) => ({ key, value, label: EMOTION_LABELS[key] || key }));

  const ed = slotEdits[activeSlot] || {};

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
              disabled={matrixFails}
              title={matrixFails ? "Matrix checks fail — resolve flagged rules before exporting" : undefined}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-stone-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy className="h-4 w-4" />
              Copy paste sheet
            </button>
            <button
              onClick={exportAll}
              disabled={matrixFails}
              title={matrixFails ? "Matrix checks fail — resolve flagged rules before exporting" : undefined}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-stone-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export album
            </button>
            <button
              onClick={() => {
                setShowProjects((v) => !v);
                if (!showProjects) refreshProjects();
              }}
              className={cx(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
                showProjects
                  ? "border-[#d4af37]/50 bg-[#d4af37]/10 text-[#f1d574]"
                  : "border-white/10 bg-white/5 text-stone-200 hover:bg-white/10"
              )}
            >
              <FolderOpen className="h-4 w-4" />
              Projects
            </button>
          </div>
        </header>

        <div className="mt-4 flex items-center gap-1 rounded-lg border border-white/10 bg-black/25 p-1 w-fit">
          <button
            onClick={() => setMode("wizard")}
            className={cx(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "wizard"
                ? "bg-[#d4af37] text-black"
                : "text-stone-300 hover:bg-white/5"
            )}
          >
            ✨ Make Me an Album
          </button>
          <button
            onClick={() => setMode("studio")}
            className={cx(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "studio"
                ? "bg-[#d4af37] text-black"
                : "text-stone-300 hover:bg-white/5"
            )}
          >
            🎛 Advanced Studio
          </button>
        </div>

        {mode === "wizard" ? (
          <div className="mt-6 rounded-lg border border-white/10 bg-[#11100f] p-4">
            <AlbumWizard onLaunch={handleWizardLaunch} />
          </div>
        ) : (
        <><div className="mt-6 rounded-lg border border-white/10 bg-[#11100f] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-[#d4af37]" />
              <div>
                <p className="text-xs uppercase text-stone-400">Album template</p>
                <p className="text-sm text-stone-300">
                  {blueprint
                    ? `${ARCHETYPE_NAMES[blueprint.bible.album.archetypeIndex]} · climax track ${blueprint.bible.climaxPosition.slotIndex + 1} · ${blueprint.bible.bpmCenter} BPM`
                    : "Pick an archetype to lock this album's emotional DNA across all tracks."}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (templateArchetype === null) {
                  toast.info("Pick a template archetype to build the album");
                  return;
                }
                setAlbumNonce((n) => n + 1);
                setApproval({ plan: false, slots: {} });
                setProduction(emptyProduction(effectiveSlots?.length || blends.length));
                toast.success("Album re-rolled — titles shifted, album genes intact");
              }}
              className="inline-flex items-center gap-2 rounded-md border border-[#d4af37]/50 bg-[#d4af37] px-3 py-2 text-sm font-medium text-black hover:bg-[#e8c14a]"
            >
              <Sparkles className="h-4 w-4" />
              {blueprint ? "Re-roll album" : "Generate album"}
            </button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-5">
            {ALBUM_ARCHETYPES.map((archetype, index) => {
              const active = templateArchetype === index;
              return (
                <button
                  key={archetype.cluster_id}
                  onClick={() => setTemplateArchetype(index)}
                  className={cx(
                    "rounded-md border p-3 text-left transition-colors",
                    active
                      ? "border-[#d4af37]/50 bg-[#d4af37]/10"
                      : "border-white/10 bg-black/20 hover:border-white/25"
                  )}
                >
                  <p className="text-sm font-medium text-[#f1d574]">{ARCHETYPE_NAMES[index]}</p>
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
        </div>

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
            {showProjects && (
              <div className="rounded-lg border border-white/10 bg-[#11100f] p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Album projects</h2>
                  <span className="text-xs text-stone-500">stored on the server</span>
                </div>

                {currentProject ? (
                  <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-stone-200">{currentProject.name}</p>
                      {currentProject.engineMatches === false ? (
                        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                          older engine
                        </span>
                      ) : (
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                          current engine
                        </span>
                      )}
                    </div>
                    {projectWarnings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {projectWarnings.map((warning, i) => (
                          <p key={i} className="text-xs text-amber-300/90">
                            {warning}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-stone-500">
                    No project loaded — the current album becomes a new project when you save.
                  </p>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={handleSaveProject}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d4af37]/40 bg-[#d4af37] px-3 py-2 text-xs font-medium text-black hover:bg-[#e8c14a]"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {currentProject ? "Save" : "Save as new project"}
                  </button>
                  <button
                    onClick={handleSaveVersion}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-stone-200 hover:bg-white/10"
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    Save version
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={versionLabel}
                    onChange={(e) => setVersionLabel(e.target.value)}
                    placeholder="Version label (optional)"
                    className="rounded-md border border-white/10 bg-black/25 p-2 text-xs text-white outline-none focus:border-[#d4af37]"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={handleDuplicate}
                      title="Duplicate project"
                      className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 px-2 py-2 text-stone-300 hover:bg-white/10"
                    >
                      <CopyPlus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={handleRename}
                      title="Rename project"
                      className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 px-2 py-2 text-stone-300 hover:bg-white/10"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={handleDelete}
                      title="Delete project"
                      className="inline-flex items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 px-2 py-2 text-red-300 hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <input
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    placeholder="New name for rename"
                    className="w-full rounded-md border border-white/10 bg-black/25 p-2 text-xs text-white outline-none focus:border-[#d4af37]"
                  />
                </div>

                {currentProject && projectVersions.length > 0 && (
                  <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase text-stone-500">Versions</p>
                    <ul className="mt-2 space-y-1">
                      {projectVersions.slice().reverse().map((version) => (
                        <li key={version.version} className="flex items-center justify-between text-xs">
                          <span className="text-stone-300">
                            v{version.version}
                            {version.label ? ` — ${version.label}` : ""}
                          </span>
                          <button
                            onClick={() => handleOpenVersion(version.version)}
                            className="text-[#f1d574] hover:underline"
                          >
                            restore
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4">
                  <p className="text-xs uppercase text-stone-500">Save token</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="password"
                      value={tokenDraft}
                      onChange={(e) => setTokenDraft(e.target.value)}
                      placeholder={projectsTokenSet ? "Token stored — replace?" : "Enter write token"}
                      className="w-full rounded-md border border-white/10 bg-black/25 p-2 text-xs text-white outline-none focus:border-[#d4af37]"
                    />
                    <button
                      onClick={() => {
                        setProjectToken(tokenDraft);
                        setTokenDraft("");
                        toast.success(projectsTokenSet ? "Token updated" : "Token stored");
                      }}
                      className="rounded-md border border-white/10 bg-white/5 px-3 text-xs text-stone-200 hover:bg-white/10"
                    >
                      Set
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs uppercase text-stone-500">Saved projects</p>
                  <div className="mt-2 max-h-60 space-y-1 overflow-y-auto pr-1">
                    {projectsList.length === 0 ? (
                      <p className="text-xs text-stone-500">No saved projects yet.</p>
                    ) : (
                      projectsList.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => handleOpenProject(project.id)}
                          className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-left hover:border-white/25"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm text-stone-200">{project.name}</span>
                            <span
                              className={cx(
                                "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium",
                                project.engine_version === ALBUM_ENGINE_VERSION
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                  : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                              )}
                            >
                              {project.engine_version === ALBUM_ENGINE_VERSION ? "current" : "older"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] text-stone-500">
                            {project.track_count ?? "?"} tracks
                            {project.genre ? ` · ${project.genre}` : ""} · v{project.latest_version || 1} · {project.status}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="rounded-lg border border-white/10 bg-[#11100f] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Track slots</h2>
                <span className="text-xs text-stone-400">{blends.length} tracks</span>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {effectiveSlots.map((result, index) => (
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
                    {blueprint && (
                      <span
                        className={cx(
                          "mt-1 block rounded border px-1 py-0.5 text-[9px] font-medium",
                          ROLE_CLASS[result.role] || "bg-white/5 text-stone-300 border-white/10"
                        )}
                      >
                        {result.roleLabel}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

<div className="rounded-lg border border-white/10 bg-[#11100f] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Slot {activeSlot + 1}{blueprint ? <> · <span className={cx("rounded-md border px-2 py-0.5 text-sm font-medium", ROLE_CLASS[active.role] || "")}>{active.roleLabel}</span></> : " blend"}
                </h2>
                <span className="text-xs text-stone-400">
                  {blueprint ? `BPM ${active.bpm} · intensity ${Math.round(active.intensity * 100)}%` : `Dominant: ${ARCHETYPE_NAMES[active.dominantCluster]}`}
                </span>
              </div>

              {blueprint ? (
                <div className="mt-3 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-xs text-stone-400">
                      Role
                      <select
                        value={active.role}
                        onChange={(e) => updateSlotEdit(activeSlot, { role: e.target.value })}
                        className="mt-1 w-full rounded-md border border-white/10 bg-black/25 p-2.5 text-sm text-white outline-none focus:border-[#d4af37]"
                      >
                        {TRACK_ROLES.map((r) => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-end gap-2">
                      <button
                        onClick={() => updateSlotEdit(activeSlot, { variantSeed: (ed.variantSeed || 0) + 1 })}
                        className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-stone-200 hover:bg-white/10"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Re-roll take
                      </button>
                      <span className="text-xs text-stone-500">seed {(ed.variantSeed || 0)}</span>
                    </div>
                  </div>
                  <label className="text-xs text-stone-400">
                    Personal direction (optional)
                    <textarea
                      value={ed.note || ""}
                      onChange={(e) => updateSlotEdit(activeSlot, { note: e.target.value })}
                      rows={2}
                      className="mt-1 w-full rounded-md border border-white/10 bg-black/25 p-2.5 text-sm text-white outline-none focus:border-[#d4af37]"
                      placeholder="e.g. bring in the detuned sub at the chorus"
                    />
                  </label>
                  <p className="text-xs text-stone-500">
                    The track-specific note is added to the prompt but the album's anchor lines stay intact, so continuity is preserved.
                  </p>
                </div>
              ) : (
                <>
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
                </>
              )}
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
              {blueprint && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {effectiveSlots.map((s, i) => (
                    <span key={i} className={cx("rounded border px-1.5 py-0.5 text-[10px] font-medium", ROLE_CLASS[s.role] || "bg-white/5 text-stone-300 border-white/10")}>
                      {i + 1}
                    </span>
                  ))}
                  <span className="text-xs text-stone-500">climax → track {blueprint.bible.climaxPosition.slotIndex + 1}</span>
                </div>
              )}
              <p className="mt-2 text-sm leading-relaxed text-stone-300">
                {active.analysis.structure.length
                  ? active.analysis.structure.join(". ")
                  : "Even-flow arrangement; the blend produced no strong structural directives."}{" "}
                The peak should {active.analysis.climax}.
              </p>
            </div>

            {journey && <AlbumJourney journey={journey} />}

            {journey && matrix && (
              <div className="rounded-lg border border-white/10 bg-[#11100f] p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Matrix health</h2>
                  <span
                    className={cx(
                      "rounded-md border px-2 py-0.5 text-xs font-medium",
                      matrix.level === "pass" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
                      matrix.level === "warn" && "border-amber-500/40 bg-amber-500/10 text-amber-300",
                      matrix.level === "fail" && "border-red-500/40 bg-red-500/10 text-red-300"
                    )}
                  >
                    {matrix.level.toUpperCase()} · {matrix.score}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(matrix.rules).map(([key, rule]) => (
                    <div key={key} className="rounded-md border border-white/10 bg-black/20 p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-wider text-stone-500">{key}</p>
                        <span
                          className={cx(
                            "text-[10px] font-medium uppercase",
                            rule.level === "pass" && "text-emerald-300",
                            rule.level === "warn" && "text-amber-300",
                            rule.level === "fail" && "text-red-300"
                          )}
                        >
                          {rule.level}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-stone-300">{rule.detail}</p>
                    </div>
                  ))}
                </div>
                {matrix.level !== "pass" && (
                  <p className="mt-2 text-xs text-stone-500">{matrix.detail}</p>
                )}
              </div>
            )}

            {journey && (
              <>
                <button
                  onClick={() => setShowReview((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-stone-300 hover:bg-white/10"
                >
                  <Layers className="h-3.5 w-3.5" />
                  {showReview ? "Close blueprint review" : "Open blueprint review"}
                </button>
                {showReview && (
                  <BlueprintReview
                    blueprint={activeBlueprint}
                    journey={journey}
                    matrix={matrix}
                    approved={approval.plan}
                    approvalSlots={approval.slots}
                    onSelectTrack={(i) => {
                      setActiveSlot(i);
                      setShowReview(false);
                    }}
                    onApprove={handleApprove}
                  />
                )}
              </>
            )}

            <div className="rounded-lg border border-white/10 bg-[#11100f] p-4">
              <h2 className="text-lg font-semibold">Full album</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="text-xs uppercase text-stone-400">#</th>
                      <th className="text-xs uppercase text-stone-400">Title</th>
                      <th className="text-xs uppercase text-stone-400">Role</th>
                      <th className="text-xs uppercase text-stone-400">BPM</th>
                      <th className="text-xs uppercase text-stone-400">Prompt preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {effectiveSlots.map((result, index) => (
                      <tr key={index} className="border-t border-white/10">
                        <td className="py-3 pr-2 align-top text-xs text-stone-500">{index + 1}</td>
                        <td className="min-w-40 py-3 pr-3 align-top text-sm font-medium text-white">
                          {result.title}
                        </td>
                        <td className="py-3 pr-3 align-top">
                          {result.roleLabel ? (
                            <span className={cx("inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium", ROLE_CLASS[result.role] || "bg-white/5 text-stone-300 border-white/10")}>
                              {result.roleLabel}
                            </span>
                          ) : <span className="text-xs text-stone-600">—</span>}
                        </td>
                        <td className="py-3 pr-3 align-top text-xs text-stone-400">
                          {result.bpm ? `${result.bpm}` : "—"}
                        </td>
                        <td className="py-3 text-xs leading-relaxed text-stone-300">
                          {result.prompt.slice(0, 180)}
                          {result.prompt.length > 180 ? <span className="text-stone-500"> …</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {activeBlueprint && (
              <AlbumProduction
                blueprint={activeBlueprint}
                production={production}
                onChange={setProduction}
                libraryCache={libraryCache}
                onFetchTrack={handleFetchTrack}
                onFinish={handleFinishAlbum}
                onExport={handleExportManifest}
              />
            )}
          </div>
        </div>
          </>)}
      </div>
    </main>
  );
}