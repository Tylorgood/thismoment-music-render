import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Disc3, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, DataTable, StatusBadge, EmptyState, Metric } from "@/components/layout";
import { listProjects } from "@/lib/albumProjects";
import { ALBUM_ENGINE_VERSION } from "@/lib/albumEngine";

function statusTone(status) {
  if (status === "finished") return "ok";
  if (status === "production") return "info";
  return "warn";
}

export default function AlbumHome() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listProjects()
      .then((list) => {
        if (!cancelled) setProjects(list || []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load albums");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const minutesPlayed = useMemo(
    () => projects.reduce((sum, project) => sum + (project.total_duration_seconds || 0), 0) / 60,
    [projects]
  );

  const rows = projects.map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status || "draft",
    track_count: project.track_count ?? "—",
    genre: project.genre || "—",
    engine: project.engine_version === ALBUM_ENGINE_VERSION ? "current" : "older",
    version: project.latest_version || 1,
  }));

  const columns = [
    {
      key: "name",
      label: "Album",
      render: (row) => (
        <button
          onClick={() => navigate(`/albums/${row.id}`)}
          className="ma-ring-focus text-left text-sm text-slate-100 hover:underline"
        >
          {row.name}
        </button>
      ),
    },
    { key: "status", label: "Status", render: (row) => <StatusBadge tone={statusTone(row.status)} label={row.status} /> },
    { key: "track_count", label: "Tracks", width: "4rem" },
    { key: "genre", label: "Genre" },
    { key: "engine", label: "Engine", render: (row) => <StatusBadge tone={row.engine === "current" ? "ok" : "warn"} label={row.engine} dot={false} /> },
    { key: "version", label: "Version", align: "right", render: (row) => <span className="font-mono text-xs ma-muted">v{row.version}</span> },
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <PageHeader title="Albums" subtitle="Saved album projects — open one to keep building.">
        <button
          onClick={() => navigate("/create")}
          className="ma-ring-focus inline-flex items-center gap-2 rounded-sm ma-accent-bg px-3 py-1.5 text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New album
        </button>
      </PageHeader>

      {loading ? (
        <div className="px-6 py-10 text-sm ma-muted">Loading albums…</div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Disc3}
          title="No albums yet"
          description="Build an album in the prompt studio, then save it — it will show up here with its blueprint, journey and production flow."
          actions={
            <button
              onClick={() => navigate("/prompts")}
              className="ma-ring-focus inline-flex items-center gap-2 rounded-sm ma-accent-bg px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" />
              Open the studio
            </button>
          }
        />
      ) : (
        <div className="space-y-5 p-6">
          <div className="flex flex-wrap gap-10 border ma-hairline bg-[var(--ma-surface-1)] px-6 py-4">
            <Metric label="Albums" value={String(projects.length)} />
            <Metric
              label="Total tracks"
              value={String(projects.reduce((sum, p) => sum + (p.track_count || 0), 0))}
            />
            <Metric label="Minutes of music" value={`${Math.round(minutesPlayed * 10) / 10}`} sub="estimated playback" />
          </div>
          <div className="border ma-hairline bg-[var(--ma-surface-1)]">
            <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} emptyText="No saved albums." />
          </div>
        </div>
      )}
    </div>
  );
}