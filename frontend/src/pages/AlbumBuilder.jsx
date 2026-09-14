import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Copy, Download, FolderOpen, GitBranch, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader,
  PageNav,
  PageSection,
  DetailPanel,
  Toolbar,
  DataTable,
  StatusBadge,
  Metric,
  ActivityFeed,
  EmptyState,
} from "@/components/layout";
import AlbumJourney from "@/components/AlbumJourney";
import BlueprintReview from "@/components/BlueprintReview";
import AlbumProduction from "@/components/AlbumProduction";
import { ALBUM_ENGINE_VERSION, buildAlbumExport, buildJourneyView } from "@/lib/albumEngine";
import { ARCHETYPE_NAMES } from "@/lib/promptEngine";
import validateMatrix from "@/lib/matrixValidation";
import { serializeAlbum, deserializeAlbum, toRestorePatch } from "@/lib/albumProjectSerializer";
import {
  getProject,
  getProjectVersion,
  createVersion,
  saveState,
  searchLibraryTracks,
  ProjectTokenError,
} from "@/lib/albumProjects";
import { emptyProduction, buildProductionManifest } from "@/lib/albumProduction";
import { setAlbumContext } from "@/lib/albumContext";

const SECTIONS = ["overview", "blueprint", "tracks", "journey", "production", "export"];

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

function RoleChip({ role, label }) {
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${ROLE_CLASS[role] || "bg-white/5 text-stone-300 border-white/10"}`}>
      {label}
    </span>
  );
}

function matrixTone(level) {
  if (level === "pass") return "ok";
  if (level === "warn") return "warn";
  return "err";
}

function MatrixHealth({ matrix }) {
  if (!matrix) return null;
  return (
    <PageSection title="Matrix health">
      <div className="flex items-center justify-between">
        <span className="text-sm ma-muted">Plan-level quality checks</span>
        <StatusBadge tone={matrixTone(matrix.level)} label={`${matrix.level.toUpperCase()} · ${matrix.score}`} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(matrix.rules).map(([key, rule]) => (
          <div key={key} className="rounded-sm border ma-hairline bg-[var(--ma-inset)] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider ma-faint">{key}</p>
              <StatusBadge tone={matrixTone(rule.level)} label={rule.level} dot={false} />
            </div>
            <p className="mt-1 text-xs ma-muted">{rule.detail}</p>
          </div>
        ))}
      </div>
      {matrix.level !== "pass" && <p className="mt-3 text-xs ma-faint">{matrix.detail}</p>}
    </PageSection>
  );
}

export default function AlbumBuilder() {
  const { id, section } = useParams();
  const navigate = useNavigate();
  const sectionKey = section || "overview";

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [payload, setPayload] = useState(null);
  const [restored, setRestored] = useState(null);
  const [versions, setVersions] = useState([]);
  const [production, setProduction] = useState(null);
  const [approval, setApproval] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [libraryCache, setLibraryCache] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    getProject(id)
      .then((projectPayload) => {
        if (cancelled) return;
        const loaded = deserializeAlbum(projectPayload);
        const count = Number(loaded.inputs?.trackCount) || loaded.blueprint?.slots?.length || 10;
        setPayload(projectPayload);
        setRestored(loaded);
        setVersions(projectPayload.versions || []);
        setProduction(loaded.production || emptyProduction(count));
        setApproval(loaded.approval || { plan: false, slots: {} });
        setShowReview(false);
        setAlbumContext({ id, name: loaded.name, status: projectPayload.status });
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      setAlbumContext(null);
    };
  }, [id]);

  const handleProjectError = (error) => {
    if (error instanceof ProjectTokenError) {
      toast.error("Project writes need a save token — set it in the prompt studio.");
      return;
    }
    toast.error(error.message || "Album project request failed");
  };

  const blueprint = restored?.blueprint || null;
  const inputs = restored?.inputs || {};

  const activeBlueprint = useMemo(
    () => (blueprint ? { bible: blueprint.bible, slots: blueprint.slots } : null),
    [blueprint]
  );
  const journey = useMemo(
    () => (activeBlueprint ? buildJourneyView(activeBlueprint) : null),
    [activeBlueprint]
  );
  const matrix = useMemo(
    () => (activeBlueprint ? validateMatrix(activeBlueprint) : null),
    [activeBlueprint]
  );
  const slots = blueprint?.slots || [];

  const savedBlueprint = useMemo(() => {
    if (!blueprint) return null;
    return {
      ...blueprint,
      chemistry: journey?.slots.map((slot) => slot.chemistry).filter(Boolean) || blueprint.chemistry,
      tempo: journey?.tempo || blueprint.tempo,
      tempoBehavior: journey?.tempoBehavior || blueprint.tempoBehavior,
    };
  }, [blueprint, journey]);

  const handleSave = async () => {
    if (!blueprint || !id) return;
    const serialized = serializeAlbum(savedBlueprint, {
      name: restored.name,
      genre: inputs.genre || "universal",
      theme: inputs.theme || "",
      trackCount: Number(inputs.trackCount) || slots.length,
      templateArchetype: inputs.templateArchetype ?? null,
      albumNonce: Number(inputs.albumNonce) || 0,
      wizardDna: inputs.wizardDna || null,
      slotEdits: inputs.slotEdits || {},
      approval,
      production,
    });
    try {
      await saveState(id, toRestorePatch(serialized));
      toast.success(`Saved "${restored.name}"`);
    } catch (error) {
      handleProjectError(error);
    }
  };

  const handleSaveVersion = async () => {
    if (!id) return;
    try {
      const result = await createVersion(id, "");
      toast.success(`Version ${result.version} saved`);
    } catch (error) {
      handleProjectError(error);
    }
  };

  const handleOpenVersion = async (versionNumber) => {
    try {
      const versionPayload = await getProjectVersion(id, versionNumber);
      const loaded = deserializeAlbum({
        name: versionPayload.snapshot_name,
        engine_version: versionPayload.engine_version,
        inputs: versionPayload.inputs,
        blueprint: versionPayload.blueprint,
        approval: versionPayload.approval,
      });
      setRestored(loaded);
      const count = Number(loaded.inputs?.trackCount) || loaded.blueprint?.slots?.length || 10;
      setProduction(loaded.production || emptyProduction(count));
      setApproval(loaded.approval || { plan: false, slots: {} });
      toast.success(`Restored v${versionNumber}`);
    } catch (error) {
      handleProjectError(error);
    }
  };

  const handleFetchTrack = async (query) => {
    const tracks = await searchLibraryTracks(query);
    setLibraryCache((cache) => {
      const next = { ...cache };
      tracks.forEach((track) => {
        next[track.id] = track;
      });
      return next;
    });
    return tracks;
  };

  const handleFinishAlbum = async () => {
    if (!id) return;
    const finished = { ...production, status: "finished" };
    setProduction(finished);
    toast.success("Album finished — all tracks accepted");
    try {
      const serialized = serializeAlbum(savedBlueprint, {
        name: restored.name,
        genre: inputs.genre || "universal",
        theme: inputs.theme || "",
        trackCount: Number(inputs.trackCount) || slots.length,
        templateArchetype: inputs.templateArchetype ?? null,
        albumNonce: Number(inputs.albumNonce) || 0,
        wizardDna: inputs.wizardDna || null,
        slotEdits: inputs.slotEdits || {},
        approval,
        production: finished,
      });
      await saveState(id, { ...toRestorePatch(serialized), status: "finished" });
    } catch (error) {
      handleProjectError(error);
    }
  };

  const handleExportManifest = () => {
    if (!activeBlueprint) return;
    const manifest = buildProductionManifest(activeBlueprint, production, libraryCache);
    const blob = new Blob(
      [JSON.stringify({ album: activeBlueprint.bible.album.name, finished: production?.status === "finished", tracks: manifest }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(restored?.name || "album").replace(/\s+/g, "-").toLowerCase()}-production-manifest.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Production manifest exported");
  };

  const exportAll = () => {
    if (!activeBlueprint) return;
    const ex = buildAlbumExport(activeBlueprint, {});
    const blob = new Blob([JSON.stringify(ex.ingest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(restored?.name || "album").replace(/\s+/g, "-").toLowerCase()}-suno-ingest.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${slots.length} ingest payloads exported`);
  };

  const exportPasteSheet = () => {
    if (!activeBlueprint) return;
    const { pasteSheet } = buildAlbumExport(activeBlueprint, {});
    copyText(pasteSheet, "Album paste sheet");
  };

  const sectionItems = SECTIONS.map((sectionKeyName) => ({
    key: sectionKeyName,
    label: sectionKeyName.charAt(0).toUpperCase() + sectionKeyName.slice(1),
  }));

  if (notFound) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)]">
        <EmptyState
          icon={FolderOpen}
          title="Album not found"
          description="That project may have been deleted. Head back to the albums list."
          actions={
            <button
              onClick={() => navigate("/albums")}
              className="ma-ring-focus inline-flex items-center gap-2 rounded-sm ma-accent-bg px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              Browse albums
            </button>
          }
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] px-6 py-6">
        <PageHeader title="Loading album…" />
        <PageNav items={sectionItems} activeKey={sectionKey} onSelect={() => {}} />
        <div className="p-6 text-sm ma-muted">Reading project…</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <PageHeader
        title={restored?.name || "Album"}
        subtitle={
          blueprint
            ? `${ARCHETYPE_NAMES[blueprint.bible.album.archetypeIndex]} · climax track ${blueprint.bible.climaxPosition.slotIndex + 1} · ${blueprint.bible.bpmCenter} BPM`
            : undefined
        }
      >
        <StatusBadge
          tone={payload?.engine_version !== ALBUM_ENGINE_VERSION ? "warn" : "ok"}
          label={payload?.engine_version !== ALBUM_ENGINE_VERSION ? "older engine" : "current engine"}
        />
        <StatusBadge
          tone={production?.status === "finished" ? "ok" : production?.status === "production" ? "info" : "neutral"}
          label={production?.status || "draft"}
        />
        <button
          onClick={handleSaveVersion}
          className="ma-ring-focus inline-flex items-center gap-2 rounded-sm border ma-hairline-strong px-3 py-1.5 text-sm ma-muted transition-colors hover:bg-white/5 hover:text-slate-200"
        >
          <GitBranch className="h-4 w-4" />
          Checkpoint
        </button>
        <button
          onClick={handleSave}
          className="ma-ring-focus inline-flex items-center gap-2 rounded-sm ma-accent-bg px-3 py-1.5 text-sm font-medium hover:opacity-90"
        >
          <Save className="h-4 w-4" />
          Save
        </button>
      </PageHeader>

      <PageNav
        items={sectionItems}
        activeKey={sectionKey}
        onSelect={(key) => navigate(`/albums/${id}${key === "overview" ? "" : `/${key}`}`)}
      />

      <div className="space-y-5 p-6">
        {sectionKey === "overview" && (
          <>
            <div className="flex flex-wrap gap-10 border ma-hairline bg-[var(--ma-surface-1)] px-6 py-4">
              <Metric label="Tracks" value={String(slots.length)} />
              <Metric label="Matrix" value={matrix ? String(matrix.score) : "—"} tone={matrix ? matrixTone(matrix.level) : "neutral"} />
              <Metric label="Approval" value={approval?.plan ? "Approved" : "Pending"} tone={approval?.plan ? "ok" : "warn"} />
              <Metric label="Status" value={production?.status || "draft"} tone={production?.status === "finished" ? "ok" : "info"} />
            </div>

            {blueprint && (
              <PageSection title="Album bible">
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { label: "Genre", value: inputs.genre || "—" },
                    { label: "Theme", value: inputs.theme || "—" },
                    { label: "Archetype", value: ARCHETYPE_NAMES[blueprint.bible.album.archetypeIndex] },
                    { label: "Climax", value: `track ${blueprint.bible.climaxPosition.slotIndex + 1}` },
                    { label: "BPM center", value: String(blueprint.bible.bpmCenter) },
                    { label: "Tempo behavior", value: journey?.tempoBehavior || "locked" },
                  ].map((row) => (
                    <div key={row.label}>
                      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] ma-faint">{row.label}</dt>
                      <dd className="mt-1 text-sm text-slate-200">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </PageSection>
            )}

            <PageSection title="Version history" description="Checkpoints saved on the server">
              {versions.length ? (
                <ActivityFeed
                  events={versions
                    .slice()
                    .reverse()
                    .map((version) => ({
                      key: version.version,
                      title: `Version ${version.version}${version.label ? ` — ${version.label}` : ""}`,
                      detail: version.note || "Checkpoint",
                      time: version.created_at ? String(version.created_at).slice(0, 16) : undefined,
                    }))}
                />
              ) : (
                <p className="py-4 text-sm ma-muted">No checkpoints yet — hit Checkpoint in the header to save one.</p>
              )}
            </PageSection>

            <MatrixHealth matrix={matrix} />
          </>
        )}

        {sectionKey === "blueprint" && (
          <>
            <div className="flex items-center gap-2">
              <StatusBadge tone={approval?.plan ? "ok" : "warn"} label={approval?.plan ? "Plan approved" : "Plan pending"} />
              <button
                onClick={() => setShowReview((value) => !value)}
                className="ma-ring-focus inline-flex items-center gap-2 rounded-sm border ma-hairline-strong px-3 py-1.5 text-sm ma-muted transition-colors hover:bg-white/5 hover:text-slate-200"
              >
                <Sparkles className="h-4 w-4" />
                {showReview ? "Close blueprint review" : "Open blueprint review"}
              </button>
            </div>

            {showReview && activeBlueprint && journey && matrix ? (
              <BlueprintReview
                blueprint={activeBlueprint}
                journey={journey}
                matrix={matrix}
                approved={Boolean(approval?.plan)}
                approvalSlots={approval?.slots || {}}
                onSelectTrack={() => navigate(`/albums/${id}/tracks`)}
                onApprove={() => {
                  if (matrix.level === "fail") {
                    toast.error("Album plan fails matrix checks — fix the flagged rule before approving.");
                    return;
                  }
                  const next = { plan: true, slots: {} };
                  slots.forEach((_, index) => {
                    next.slots[index] = "approved";
                  });
                  setApproval(next);
                  toast.success(`Plan approved · matrix score ${matrix.score}`);
                }}
              />
            ) : (
              blueprint && (
                <PageSection title="Role blueprint">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {slots.map((slot, index) => (
                      <div key={index} className="flex items-center gap-1.5">
                        <span className="font-mono text-xs ma-faint">{index + 1}</span>
                        <RoleChip role={slot.role} label={slot.roleLabel} />
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs ma-faint">
                    climax → track {blueprint.bible.climaxPosition.slotIndex + 1} · edited takes are baked into the saved blueprint.
                  </p>
                </PageSection>
              )
            )}
            <MatrixHealth matrix={matrix} />
          </>
        )}

        {sectionKey === "tracks" && (
          <>
            {blueprint ? (
              <div className="border ma-hairline bg-[var(--ma-surface-1)]">
                <Toolbar
                  left={<span className="text-sm ma-muted">{slots.length} tracks · Suno-ready prompts</span>}
                  right={
                    <>
                      <button
                        onClick={exportPasteSheet}
                        className="ma-ring-focus inline-flex items-center gap-2 rounded-sm border ma-hairline-strong px-2.5 py-1.5 text-xs ma-muted transition-colors hover:bg-white/5 hover:text-slate-200"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy paste sheet
                      </button>
                      <button
                        onClick={exportAll}
                        className="ma-ring-focus inline-flex items-center gap-2 rounded-sm border ma-hairline-strong px-2.5 py-1.5 text-xs ma-muted transition-colors hover:bg-white/5 hover:text-slate-200"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Export ingest
                      </button>
                    </>
                  }
                />
                <DataTable
                  columns={[
                    { key: "index", label: "#", width: "2.5rem", render: (row) => <span className="ma-faint">{row.index + 1}</span> },
                    { key: "title", label: "Title", render: (row) => <span className="font-medium text-slate-100">{row.title}</span> },
                    { key: "role", label: "Role", render: (row) => <RoleChip role={row.role} label={row.roleLabel || "—"} /> },
                    { key: "bpm", label: "BPM", width: "4rem" },
                    {
                      key: "prompt",
                      label: "Prompt preview",
                      render: (row) => (
                        <span className="block text-xs leading-relaxed ma-muted" title={row.prompt}>
                          {row.prompt.slice(0, 140)}
                          {row.prompt.length > 140 ? " …" : ""}
                        </span>
                      ),
                    },
                    {
                      key: "copy",
                      label: "",
                      align: "right",
                      render: (row) => (
                        <button
                          onClick={() => copyText(row.prompt, `${row.title} prompt`)}
                          className="ma-ring-focus rounded-sm border ma-hairline px-1.5 py-1 text-xs ma-muted hover:bg-white/5 hover:text-slate-200"
                          title={`Copy ${row.title} style prompt`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      ),
                    },
                  ]}
                  rows={slots.map((slot, index) => ({
                    index,
                    title: slot.title,
                    role: slot.role,
                    roleLabel: slot.roleLabel,
                    bpm: slot.bpm ? String(slot.bpm) : "—",
                    prompt: slot.prompt,
                  }))}
                  rowKey={(row) => row.index}
                  emptyText="This saved album has no tracks."
                />
              </div>
            ) : (
              <EmptyState title="No blueprint" description="This project has no saved blueprint." />
            )}
          </>
        )}

        {sectionKey === "journey" && (
          <>
            {journey ? <AlbumJourney journey={journey} /> : <EmptyState title="No journey" description="Generate the album to unlock the emotional journey." />}
            <MatrixHealth matrix={matrix} />
          </>
        )}

        {sectionKey === "production" && (
          activeBlueprint ? (
            <AlbumProduction
              blueprint={activeBlueprint}
              production={production}
              onChange={setProduction}
              libraryCache={libraryCache}
              onFetchTrack={handleFetchTrack}
              onFinish={handleFinishAlbum}
              onExport={handleExportManifest}
            />
          ) : (
            <EmptyState title="No production flow" description="Generate the album before running production." />
          )
        )}

        {sectionKey === "export" && (
          <>
            <DetailPanel title="Suno ingest" description="Style prompts for every track, ready to paste or download">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={exportAll}
                  className="ma-ring-focus inline-flex items-center gap-2 rounded-sm ma-accent-bg px-3 py-2 text-sm font-medium hover:opacity-90"
                >
                  <Download className="h-4 w-4" />
                  Export ingest JSON
                </button>
                <button
                  onClick={exportPasteSheet}
                  className="ma-ring-focus inline-flex items-center gap-2 rounded-sm border ma-hairline-strong px-3 py-2 text-sm ma-muted transition-colors hover:bg-white/5 hover:text-slate-200"
                >
                  <Copy className="h-4 w-4" />
                  Copy paste sheet
                </button>
              </div>
              <p className="mt-3 text-xs ma-faint">
                {slots.length} prompts built on the album's anchor lines, so continuity survives generation.
              </p>
            </DetailPanel>
            <DetailPanel title="Production manifest" description="The accepted library tracks for the finished album">
              <button
                onClick={handleExportManifest}
                disabled={production?.status !== "finished"}
                className="ma-ring-focus inline-flex items-center gap-2 rounded-sm border ma-hairline-strong px-3 py-2 text-sm ma-muted transition-colors hover:bg-white/5 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                Export production manifest
              </button>
              <p className="mt-3 text-xs ma-faint">
                {production?.status === "finished"
                  ? `${Object.keys(production.slots || {}).filter((key) => production.slots[key]?.status === "accepted").length} of ${slots.length} slots accepted.`
                  : "Finish production in the Production view to unlock the manifest."}
              </p>
            </DetailPanel>
          </>
        )}
      </div>
    </div>
  );
}