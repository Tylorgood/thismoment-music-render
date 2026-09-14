import { renderToStaticMarkup } from "react-dom/server";
import {
  StatusBadge,
  Metric,
  PageHeader,
  PageSection,
  DetailPanel,
  Toolbar,
  DataTable,
  EmptyState,
  SplitPane,
  ActivityFeed,
  PageNav,
} from "./index";
import { Ghost } from "lucide-react";

describe("layout anatomy components", () => {
  it("StatusBadge maps tones to soft surfaces", () => {
    const ok = renderToStaticMarkup(<StatusBadge tone="ok" label="Ready" />);
    expect(ok).toContain("ma-ok-soft");
    expect(ok).toContain(">Ready<");
    expect(ok).toContain("ma-badge-dot");
  });

  it("StatusBadge renders without a dot", () => {
    const markup = renderToStaticMarkup(<StatusBadge tone="warn" label="Draft" dot={false} />);
    expect(markup).toContain("ma-warn-soft");
    expect(markup).not.toContain("ma-badge-dot");
  });

  it("Metric renders label, value and sub", () => {
    const markup = renderToStaticMarkup(<Metric label="Tracks" value="12" sub="3 pending" tone="ok" />);
    expect(markup).toContain(">Tracks<");
    expect(markup).toContain(">12<");
    expect(markup).toContain("3 pending");
    expect(markup).toContain("ma-ok-text");
  });

  it("PageHeader renders title and action slot", () => {
    const markup = renderToStaticMarkup(
      <PageHeader title="Library" subtitle="All songs">
        <button>New</button>
      </PageHeader>
    );
    expect(markup).toContain(">Library<");
    expect(markup).toContain("All songs");
    expect(markup).toContain(">New</button>");
  });

  it("DetailPanel renders header and body", () => {
    const markup = renderToStaticMarkup(
      <DetailPanel title="Journey" actions={<button>Edit</button>}>
        <p>Body</p>
      </DetailPanel>
    );
    expect(markup).toContain(">Journey<");
    expect(markup).toContain(">Body</p>");
    expect(markup).toContain(">Edit</button>");
  });

  it("PageSection builds a DetailPanel", () => {
    const markup = renderToStaticMarkup(<PageSection title="Overview">content</PageSection>);
    expect(markup).toContain("<section");
    expect(markup).toContain(">Overview<");
    expect(markup).toContain("content");
  });

  it("Toolbar renders left and right slots", () => {
    const markup = renderToStaticMarkup(<Toolbar left={<span>left</span>} right={<span>right</span>} />);
    expect(markup).toContain(">left<");
    expect(markup).toContain(">right<");
  });

  it("DataTable renders headers, cells, custom render and empty state", () => {
    const columns = [
      { key: "name", label: "Name" },
      { key: "status", label: "Status", render: (row) => <StatusBadge tone={row.tone} label={row.status} /> },
    ];
    const rows = [
      { name: "Love", status: "Ready", tone: "ok" },
      { name: "Halo", status: "Draft", tone: "warn" },
    ];
    const markup = renderToStaticMarkup(<DataTable columns={columns} rows={rows} rowKey={(r) => r.name} />);
    expect(markup).toContain(">Name<");
    expect(markup).toContain(">Love<");
    expect(markup).toContain("ma-ok-soft");
    expect(markup).toContain("ma-warn-soft");

    const empty = renderToStaticMarkup(<DataTable columns={columns} rows={[]} emptyText="Nothing here." />);
    expect(empty).toContain("Nothing here.");
  });

  it("EmptyState renders icon, copy and actions", () => {
    const markup = renderToStaticMarkup(
      <EmptyState
        icon={Ghost}
        title="No albums yet"
        description="Create your first album."
        actions={<button>Start</button>}
      />
    );
    expect(markup).toContain("No albums yet");
    expect(markup).toContain("Create your first album.");
    expect(markup).toContain(">Start</button>");
  });

  it("SplitPane renders both panes horizontally", () => {
    const markup = renderToStaticMarkup(
      <SplitPane ratio={0.6} left={<div>left-pane</div>} right={<div>right-pane</div>} />
    );
    expect(markup).toContain("left-pane");
    expect(markup).toContain("right-pane");
  });

  it("ActivityFeed renders event timeline with tones", () => {
    const markup = renderToStaticMarkup(
      <ActivityFeed
        events={[
          { key: "a", title: "Generated", time: "12:00", tone: "ok" },
          { key: "b", title: "Production", detail: "Awaiting import" },
        ]}
      />
    );
    expect(markup).toContain("Generated");
    expect(markup).toContain("12:00");
    expect(markup).toContain("ma-ok-soft");
    expect(markup).toContain("Awaiting import");
  });

  it("PageNav marks the active section", () => {
    const markup = renderToStaticMarkup(
      <PageNav
        items={[
          { key: "blueprint", label: "Blueprint" },
          { key: "tracks", label: "Tracks" },
        ]}
        activeKey="tracks"
      />
    );
    expect(markup).toContain(">Blueprint<");
    expect(markup).toContain(">Tracks<");
    expect(markup).toContain('aria-current="page"');
  });
});