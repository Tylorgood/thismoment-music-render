import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Activity,
  Brain,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Download,
  Loader2,
  LogOut,
  Mail,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Play,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import {
  bootstrapWorkspace,
  approveOutboundMessage,
  buildBriefingContext,
  calculateEventReadiness,
  createCampaignKit,
  createEventPlan,
  createPlanFromRecommendations,
  createFollowUpFromCommunication,
  eventReadinessDetails,
  executeApprovedPlan,
  fetchMemberships,
  fetchWorkspace,
  generateAi,
  getSmartRecommendations,
  getSession,
  insertRecord,
  markSocialPostManualExport,
  saveAiOutputAsCommunication,
  saveAiOutputAsContent,
  saveAiOutputAsTask,
  sendOutboundEmail,
  approvePlan,
  rejectPlanStep,
  signIn,
  signOut,
  signUp,
  softDeleteRecord,
  updateRecord,
} from "@/lib/v2Api";

const tabs = [
  ["today", "Today", Sparkles],
  ["diagnostics", "Health", Activity],
  ["execute", "Execute", Play],
  ["growth", "Growth", Send],
  ["relationships", "Relationships", Users],
  ["events", "Events", CalendarDays],
  ["communications", "Comms", Mail],
  ["tasks", "Tasks", ClipboardList],
  ["content", "Content", Megaphone],
  ["revenue", "Revenue", CircleDollarSign],
  ["weekly", "Weekly", CheckCircle2],
  ["intelligence", "AI", Brain],
];

const emptyWorkspace = {
  brands: [],
  cities: [],
  people: [],
  organizations: [],
  opportunities: [],
  events: [],
  tasks: [],
  communications: [],
  content: [],
  revenue: [],
  weeklyReviews: [],
  promptTemplates: [],
  aiOutputs: [],
  plans: [],
  planSteps: [],
  automationRuns: [],
  executionLogs: [],
  providerConnections: [],
  contentAssets: [],
  outboundMessages: [],
  messageEvents: [],
  socialAccounts: [],
  socialPosts: [],
  executionQueue: [],
};

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function shortDate(value) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function setupObjectUrl(data) {
  return URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
}

function Card({ children, className }) {
  return <section className={cx("rounded-lg border border-white/10 bg-[#11100f] p-4", className)}>{children}</section>;
}

function Button({ children, onClick, variant = "gold", type = "button", disabled }) {
  const styles =
    variant === "gold"
      ? "border-[#d4af37]/40 bg-[#d4af37] text-black hover:bg-[#e8c14a]"
      : "border-white/10 bg-white/5 text-stone-200 hover:bg-white/10";
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
        styles
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, value, onChange, multiline, type = "text", options }) {
  const base =
    "mt-1 w-full rounded-md border border-white/10 bg-black/25 p-2.5 text-sm text-white outline-none focus:border-[#d4af37]";
  if (options) {
    return (
      <label className="text-xs text-stone-400">
        {label}
        <select className={base} value={value || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select</option>
          {options.map((option) => (
            <option key={typeof option === "string" ? option : option.value} value={typeof option === "string" ? option : option.value}>
              {typeof option === "string" ? option : option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (multiline) {
    return (
      <label className="text-xs text-stone-400">
        {label}
        <textarea className={`${base} min-h-24`} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }
  return (
    <label className="text-xs text-stone-400">
      {label}
      <input className={base} type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Metric({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase text-stone-400">{label}</p>
        <Icon className="h-4 w-4 text-[#d4af37]" />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-sm text-stone-400">{hint}</p> : null}
    </div>
  );
}

function AuthScreen({ onReady }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter an email and password before continuing.");
      return;
    }
    if (password.length < 6) {
      setError("Use a password with at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = mode === "signin" ? await signIn(email, password) : await signUp(email, password);
      if (mode === "signup" && result.user && !result.session) {
        setError("Check your email to confirm your account, then sign in.");
      } else {
        onReady();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#090807] p-4 text-white">
      <div className="mx-auto flex min-h-screen max-w-md items-center">
        <Card className="w-full">
          <p className="text-xs uppercase text-[#d4af37]">This Moment V2</p>
          <h1 className="mt-2 text-3xl font-semibold">Sign in to your operating system</h1>
          <p className="mt-2 text-sm text-stone-400">
            V2 stores business data in Supabase/Postgres with auth, RLS, and audit-friendly records.
          </p>
          <form className="mt-5 space-y-3" onSubmit={submit}>
            <Field label="Email" value={email} onChange={setEmail} />
            <Field label="Password" type="password" value={password} onChange={setPassword} />
            {error ? <p className="rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <button className="mt-4 text-sm text-[#d4af37]" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </Card>
      </div>
    </main>
  );
}

function SetupGate() {
  return (
    <main className="min-h-screen bg-[#090807] p-4 text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center">
        <Card>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-[#d4af37]" />
            <div>
              <p className="text-xs uppercase text-[#d4af37]">Supabase required</p>
              <h1 className="mt-2 text-3xl font-semibold">V2 is ready for real data</h1>
              <p className="mt-3 text-stone-300">
                Add `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` to `frontend/.env`, run the migration in Supabase, then restart the dev server. This build intentionally does not store business-critical data in localStorage.
              </p>
              <div className="mt-4 rounded-md border border-white/10 bg-black/25 p-3 text-sm text-stone-300">
                See the root README for Supabase setup, Edge Function deployment, admin setup, and the first-week operating workflow.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

function WorkspaceBootstrap({ user, onCreated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    setLoading(true);
    setError("");
    try {
      await bootstrapWorkspace(user.id);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  function resetSession() {
    supabase.auth.clearLocalSession();
    window.location.reload();
  }
  return (
    <main className="min-h-screen bg-[#090807] p-4 text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center">
        <Card>
          <p className="text-xs uppercase text-[#d4af37]">Admin setup</p>
          <h1 className="mt-2 text-3xl font-semibold">Create your This Moment workspace</h1>
          <p className="mt-3 text-stone-300">
            This creates the account, Metro Detroit brand, first city, starter records, event, tasks, content, communications, and revenue estimate in Postgres.
          </p>
          {error ? (
            <div className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
              <p>{error}</p>
              <p className="mt-2 text-red-100/80">
                If this mentions RLS, run the bootstrap RPC migration. If it mentions JWT/session, reset the local session and sign in again.
              </p>
            </div>
          ) : null}
          <div className="mt-5 flex gap-3">
            <Button onClick={create} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Create workspace
            </Button>
            <Button variant="ghost" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
            <Button variant="ghost" onClick={resetSession}>
              Reset session
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default function OperatingSystem() {
  const [session, setSession] = useState(null);
  const [account, setAccount] = useState(null);
  const [activeTab, setActiveTab] = useState("today");
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function boot() {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { session: activeSession } = await getSession();
      setSession(activeSession);
      if (activeSession) {
        const memberships = await fetchMemberships();
        const membership = memberships[0];
        setAccount(membership?.accounts || null);
        if (membership?.account_id) {
          setWorkspace(await fetchWorkspace(membership.account_id));
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    boot();
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange(() => boot());
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    if (account?.id) {
      setError("");
      try {
        setWorkspace(await fetchWorkspace(account.id));
        setNotice("Workspace refreshed.");
      } catch (err) {
        setError(err.message);
      }
    }
  }

  async function createRecord(table, record) {
    if (!account) return;
    const brandId = workspace.brands[0]?.id;
    setError("");
    try {
      const created = await insertRecord(table, { account_id: account.id, brand_id: brandId, ...record });
      await refresh();
      setNotice("Record saved.");
      return created;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  async function patch(table, id, record) {
    setError("");
    try {
      await updateRecord(table, id, record);
      await refresh();
      setNotice("Record updated.");
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  async function remove(table, id) {
    setError("");
    try {
      await softDeleteRecord(table, id);
      await refresh();
      setNotice("Record archived.");
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  if (!isSupabaseConfigured) return <SetupGate />;
  if (loading) return <LoadingScreen />;
  if (!session) return <AuthScreen onReady={boot} />;
  if (!account) return <WorkspaceBootstrap user={session.user} onCreated={boot} />;

  const brand = workspace.brands[0];
  const selectedEvent = workspace.events[0];
  const readiness = calculateEventReadiness(selectedEvent, workspace.tasks, workspace.content, workspace.communications);
  const revenueTotal = workspace.revenue.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const openTasks = workspace.tasks.filter((task) => !["done", "cancelled"].includes(task.status));

  return (
    <main className="min-h-screen bg-[#090807] text-white">
      <header className="border-b border-white/10 bg-black/35">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase text-[#d4af37]">V2 operating system</p>
              <h1 className="mt-1 text-3xl font-semibold sm:text-5xl">This Moment Command Center</h1>
              <p className="mt-2 text-sm text-stone-400">{brand?.name || account.name} · real Supabase workspace</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={refresh}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <ExportButton account={account} workspace={workspace} />
              <Button variant="ghost" onClick={signOut}>
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
          {error ? <p className="rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
          {notice && !error ? <p className="rounded-md border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p> : null}
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cx(
                  "flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm",
                  activeTab === key
                    ? "border-[#d4af37]/40 bg-[#d4af37]/15 text-[#f1d574]"
                    : "border-white/10 bg-white/5 text-stone-300"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {activeTab === "today" ? (
          <Today
            account={account}
            brand={brand}
            workspace={workspace}
            selectedEvent={selectedEvent}
            readiness={readiness}
            revenueTotal={revenueTotal}
            openTasks={openTasks}
            createRecord={createRecord}
            patch={patch}
            refresh={refresh}
          />
        ) : null}
        {activeTab === "execute" ? (
          <ExecutionCenter account={account} brand={brand} workspace={workspace} refresh={refresh} setError={setError} />
        ) : null}
        {activeTab === "growth" ? (
          <GrowthEngine account={account} brand={brand} workspace={workspace} refresh={refresh} setError={setError} />
        ) : null}
        {activeTab === "diagnostics" ? (
          <Diagnostics account={account} workspace={workspace} refresh={refresh} setError={setError} />
        ) : null}
        {activeTab === "relationships" ? (
          <Relationships workspace={workspace} createRecord={createRecord} patch={patch} remove={remove} />
        ) : null}
        {activeTab === "events" ? (
          <Events account={account} brand={brand} workspace={workspace} createRecord={createRecord} patch={patch} remove={remove} refresh={refresh} />
        ) : null}
        {activeTab === "communications" ? (
          <Communications account={account} brand={brand} workspace={workspace} createRecord={createRecord} remove={remove} refresh={refresh} />
        ) : null}
        {activeTab === "tasks" ? <Tasks workspace={workspace} createRecord={createRecord} patch={patch} remove={remove} /> : null}
        {activeTab === "content" ? (
          <Content workspace={workspace} createRecord={createRecord} patch={patch} remove={remove} />
        ) : null}
        {activeTab === "revenue" ? (
          <Revenue workspace={workspace} createRecord={createRecord} remove={remove} revenueTotal={revenueTotal} />
        ) : null}
        {activeTab === "weekly" ? <Weekly workspace={workspace} createRecord={createRecord} patch={patch} /> : null}
        {activeTab === "intelligence" ? (
          <Intelligence account={account} brand={brand} workspace={workspace} refresh={refresh} />
        ) : null}
      </div>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090807] text-white">
      <div className="flex items-center gap-3 text-stone-300">
        <Loader2 className="h-5 w-5 animate-spin text-[#d4af37]" />
        Loading V2 workspace
      </div>
    </main>
  );
}

function ExportButton({ account, workspace }) {
  function exportJson() {
    const url = setupObjectUrl({ exported_at: new Date().toISOString(), account, workspace });
    const link = document.createElement("a");
    link.href = url;
    link.download = "this-moment-v2-export.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button variant="ghost" onClick={exportJson}>
      <Download className="h-4 w-4" />
      Export
    </Button>
  );
}

function Today({ account, brand, workspace, selectedEvent, readiness, revenueTotal, openTasks, createRecord, patch, refresh }) {
  const overdue = openTasks.filter((task) => task.due_at && new Date(task.due_at) < new Date());
  const recommendations = getSmartRecommendations(workspace);
  const followUps = [
    ...workspace.people.map((item) => ({ ...item, kind: "Person", label: item.display_name })),
    ...workspace.organizations.map((item) => ({ ...item, kind: "Org", label: item.name })),
  ]
    .filter((item) => item.next_follow_up_at)
    .sort((a, b) => String(a.next_follow_up_at).localeCompare(String(b.next_follow_up_at)))
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="People" value={workspace.people.length} hint="Waitlist and community CRM" />
        <Metric icon={Building2} label="Organizations" value={workspace.organizations.length} hint="Venues, sponsors, partners" />
        <Metric icon={CalendarDays} label="Event readiness" value={`${readiness}%`} hint={selectedEvent?.name || "No event yet"} />
        <Metric icon={CircleDollarSign} label="Net tracked" value={money(revenueTotal)} hint="Revenue and expenses" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase text-[#d4af37]">What matters today</p>
              <h2 className="mt-1 text-2xl font-semibold">Operator briefing</h2>
            </div>
            <span className="rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-1 text-sm text-[#f1d574]">
              {openTasks.length} open tasks
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <BriefingColumn title="Overdue" items={overdue} empty="Nothing overdue" render={(task) => task.title} />
            <BriefingColumn title="Follow-ups" items={followUps} empty="No follow-ups due" render={(item) => `${item.label} · ${shortDate(item.next_follow_up_at)}`} />
            <BriefingColumn
              title="Event risk"
              items={[
                readiness < 80 ? { id: "readiness", title: `${selectedEvent?.name || "Next event"} is not ready yet` } : null,
                !workspace.content.length ? { id: "content", title: "No content scheduled" } : null,
              ].filter(Boolean)}
              empty="No major risk detected"
              render={(item) => item.title}
            />
          </div>
        </Card>
        <QuickCapture createRecord={createRecord} />
      </div>

      <Card>
        <h2 className="text-xl font-semibold">Next best actions</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {recommendations.map((rec) => (
            <div key={rec.id} className="rounded-md border border-[#d4af37]/20 bg-[#d4af37]/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-[#f1d574]">{rec.title}</p>
                <span className="rounded-full border border-[#d4af37]/30 px-2 py-0.5 text-xs text-[#f1d574]">{rec.priority}</span>
              </div>
              <p className="mt-2 text-sm text-stone-300">{rec.reason}</p>
            </div>
          ))}
          {openTasks.slice(0, 6).map((task) => (
            <div key={task.id} className="rounded-md border border-white/10 bg-black/20 p-3">
              <p className="font-medium">{task.title}</p>
              <p className="mt-1 text-sm text-stone-400">{task.priority} · {shortDate(task.due_at)}</p>
              <Button variant="ghost" onClick={() => patch("tasks", task.id, { status: "done", completed_at: new Date().toISOString() })}>
                <CheckCircle2 className="h-4 w-4" />
                Done
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() =>
              createRecord("tasks", {
                title: "Run today's operator block",
                priority: "high",
                status: "todo",
                task_type: "admin",
                due_at: new Date().toISOString(),
                notes: recommendations.map((rec) => `${rec.title}: ${rec.reason}`).join("\n"),
              })
            }
          >
            <Plus className="h-4 w-4" />
            Turn recommendations into task
          </Button>
          <Button
            onClick={async () => {
              await createPlanFromRecommendations({
                accountId: account.id,
                brandId: brand?.id,
                recommendations,
                event: selectedEvent,
              });
              await refresh();
            }}
            disabled={!recommendations.length}
          >
            <Play className="h-4 w-4" />
            Create approval plan
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ExecutionCenter({ account, brand, workspace, refresh, setError }) {
  const [selectedPlanId, setSelectedPlanId] = useState(workspace.plans[0]?.id || "");
  const [running, setRunning] = useState(false);
  const selectedPlan = workspace.plans.find((plan) => plan.id === selectedPlanId) || workspace.plans[0];
  const steps = selectedPlan
    ? workspace.planSteps.filter((step) => step.plan_id === selectedPlan.id).sort((a, b) => a.position - b.position)
    : [];
  const logs = selectedPlan ? workspace.executionLogs.filter((log) => log.plan_id === selectedPlan.id) : workspace.executionLogs;

  async function approveSelectedPlan() {
    if (!selectedPlan) return;
    setError("");
    try {
      await approvePlan({ accountId: account.id, brandId: brand?.id, plan: selectedPlan, steps });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function runSelectedPlan() {
    if (!selectedPlan) return;
    setRunning(true);
    setError("");
    try {
      await executeApprovedPlan({ accountId: account.id, brandId: brand?.id, plan: selectedPlan, steps });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  async function rejectStep(step) {
    setError("");
    try {
      await rejectPlanStep(step);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <PanelHeader icon={Play} title="Plan approval queue" count={workspace.plans.length} />
        <p className="mt-2 text-sm text-stone-400">
          Review generated plans, approve the safe internal steps, then run the queue. This executes only database actions for now.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <Field
            label="Plan"
            value={selectedPlan?.id || ""}
            onChange={setSelectedPlanId}
            options={workspace.plans.map((plan) => ({ value: plan.id, label: `${plan.title} (${plan.status})` }))}
          />
          <div className="flex items-end">
            <Button variant="ghost" onClick={approveSelectedPlan} disabled={!selectedPlan || !steps.length}>
              <CheckCircle2 className="h-4 w-4" />
              Approve plan
            </Button>
          </div>
          <div className="flex items-end">
            <Button onClick={runSelectedPlan} disabled={!selectedPlan || running || !steps.some((step) => step.status === "approved")}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Final submit
            </Button>
          </div>
        </div>
      </Card>

      {selectedPlan ? (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase text-[#d4af37]">{selectedPlan.plan_type} plan</p>
              <h2 className="mt-1 text-2xl font-semibold">{selectedPlan.title}</h2>
              <p className="mt-1 text-sm text-stone-400">{selectedPlan.objective || "No objective"}</p>
            </div>
            <span className="rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-1 text-sm text-[#f1d574]">
              {selectedPlan.status}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {steps.map((step) => (
              <div key={step.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-stone-300">#{step.position}</span>
                      <span className="rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-0.5 text-xs text-[#f1d574]">{step.status}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-stone-300">{step.step_type}</span>
                    </div>
                    <p className="mt-2 font-medium">{step.title}</p>
                    <p className="mt-1 text-sm text-stone-400">{step.description}</p>
                    {step.error ? <p className="mt-2 text-sm text-red-200">{step.error}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {step.status === "proposed" ? (
                      <Button variant="ghost" onClick={() => rejectStep(step)}>
                        <Trash2 className="h-4 w-4" />
                        Reject
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {!steps.length ? <p className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-stone-500">No steps yet. Create an approval plan from Today.</p> : null}
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-stone-400">No plans yet. Go to Today and click Create approval plan.</p>
        </Card>
      )}

      <Card>
        <PanelHeader icon={Activity} title="Execution log" count={logs.length} />
        <div className="mt-4 space-y-2">
          {logs.slice(0, 20).map((log) => (
            <div key={log.id} className="rounded-md border border-white/10 bg-black/20 p-3">
              <p className={cx("text-sm", log.level === "error" ? "text-red-200" : "text-stone-300")}>{log.message}</p>
              <p className="mt-1 text-xs text-stone-500">{new Date(log.created_at).toLocaleString()}</p>
            </div>
          ))}
          {!logs.length ? <p className="text-sm text-stone-500">No execution logs yet.</p> : null}
        </div>
      </Card>
    </div>
  );
}

function Diagnostics({ account, workspace, refresh, setError }) {
  const [health, setHealth] = useState(null);
  const [running, setRunning] = useState(false);

  async function runHealthCheck() {
    setRunning(true);
    setError("");
    try {
      const result = await supabase.diagnostics.healthCheck();
      setHealth(result);
    } catch (err) {
      setHealth({ ok: false, error: err.message });
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  function resetSession() {
    supabase.auth.clearLocalSession();
    window.location.reload();
  }

  const counts = [
    ["People", workspace.people.length],
    ["Organizations", workspace.organizations.length],
    ["Events", workspace.events.length],
    ["Tasks", workspace.tasks.length],
    ["Communications", workspace.communications.length],
    ["Content", workspace.content.length],
    ["Revenue items", workspace.revenue.length],
    ["AI outputs", workspace.aiOutputs.length],
    ["Plans", workspace.plans.length],
    ["Plan steps", workspace.planSteps.length],
    ["Runs", workspace.automationRuns.length],
    ["Logs", workspace.executionLogs.length],
  ];

  return (
    <div className="space-y-5">
      <Card>
        <PanelHeader icon={Activity} title="System health" count={health?.ok ? "OK" : "Run"} />
        <p className="mt-2 text-sm text-stone-400">
          Use this when Supabase wakes from hibernation, a token expires, or a workflow feels stuck.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={runHealthCheck} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Run health check
          </Button>
          <Button variant="ghost" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            Reload workspace
          </Button>
          <Button variant="ghost" onClick={resetSession}>
            <LogOut className="h-4 w-4" />
            Reset local session
          </Button>
        </div>
        {health ? (
          <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3 text-sm">
            {health.ok ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <p>Supabase URL: <span className="text-stone-400">{health.supabaseUrl}</span></p>
                <p>Response time: <span className="text-stone-400">{health.elapsedMs}ms</span></p>
                <p>Email auth: <span className="text-stone-400">{health.emailAuthEnabled ? "enabled" : "disabled"}</span></p>
                <p>REST API: <span className="text-stone-400">{health.restReachable ? "reachable" : "blocked"}</span></p>
                <p>Session: <span className="text-stone-400">{health.hasSession ? "present" : "missing"}</span></p>
                <p>Expires: <span className="text-stone-400">{health.sessionExpiresAt ? new Date(health.sessionExpiresAt * 1000).toLocaleString() : "unknown"}</span></p>
              </div>
            ) : (
              <p className="text-red-200">{health.error}</p>
            )}
          </div>
        ) : null}
      </Card>

      <Card>
        <PanelHeader icon={CheckCircle2} title="Workspace smoke test" count={account?.name || "No account"} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {counts.map(([label, count]) => (
            <Metric key={label} icon={CheckCircle2} label={label} value={count} />
          ))}
        </div>
        <p className="mt-4 text-sm text-stone-400">
          Week 1 target: every count should load reliably after refresh, and creating/updating/deleting records should not produce RLS or fetch errors.
        </p>
      </Card>
    </div>
  );
}

function BriefingColumn({ title, items, empty, render }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <p className="font-medium">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => <p key={item.id} className="text-sm text-stone-300">{render(item)}</p>) : <p className="text-sm text-stone-500">{empty}</p>}
      </div>
    </div>
  );
}

function QuickCapture({ createRecord }) {
  const [type, setType] = useState("task");
  const [text, setText] = useState("");
  async function submit() {
    if (!text.trim()) return;
    if (type === "task") await createRecord("tasks", { title: text, priority: "medium", status: "todo", task_type: "general" });
    if (type === "person") await createRecord("people", { display_name: text, lifecycle_stage: "lead", source: "Quick capture" });
    if (type === "org") await createRecord("organizations", { name: text, org_type: "venue", status: "prospect" });
    if (type === "content") await createRecord("content_items", { title: text, platform: "Instagram", content_type: "post", status: "idea" });
    setText("");
  }
  return (
    <Card>
      <p className="text-xs uppercase text-[#d4af37]">Quick capture</p>
      <h2 className="mt-1 text-xl font-semibold">Add without breaking flow</h2>
      <div className="mt-4 space-y-3">
        <Field label="Type" value={type} onChange={setType} options={["task", "person", "org", "content"]} />
        <Field label="Capture" value={text} onChange={setText} />
        <Button onClick={submit}>
          <Plus className="h-4 w-4" />
          Save
        </Button>
      </div>
    </Card>
  );
}

function GrowthEngine({ account, brand, workspace, refresh, setError }) {
  const [busy, setBusy] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const event = workspace.events[0];
  const selectedMessage = workspace.outboundMessages.find((message) => message.id === selectedMessageId) || workspace.outboundMessages[0];
  const messageEvents = selectedMessage
    ? workspace.messageEvents.filter((eventItem) => eventItem.outbound_message_id === selectedMessage.id)
    : [];
  const pendingSocial = workspace.socialPosts.filter((post) => !["published", "manual_exported", "cancelled"].includes(post.status));

  async function run(action, label) {
    setBusy(label);
    setError("");
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function updateMessageRecipient() {
    if (!selectedMessage) return;
    await run(
      () =>
        updateRecord("outbound_messages", selectedMessage.id, {
          to_email: recipient || selectedMessage.to_email,
          from_email: fromEmail || selectedMessage.from_email || null,
          reply_to_email: replyToEmail || selectedMessage.reply_to_email || null,
          metadata: { ...(selectedMessage.metadata || {}), needs_real_recipient: false },
        }),
      "Saving recipient"
    );
  }

  async function approveAndSend(message) {
    if (!message.to_email || message.to_email.includes("replace-with-real-contact")) {
      throw new Error("Add a real recipient email before sending.");
    }
    if (message.status !== "approved") {
      await approveOutboundMessage(message);
    }
    await sendOutboundEmail(message.id);
  }

  return (
    <div className="space-y-5">
      <Card>
        <PanelHeader icon={Send} title="Growth command center" count={workspace.outboundMessages.length + workspace.socialPosts.length} />
        <p className="mt-2 text-sm text-stone-400">
          Generate event content, prepare Instagram posts, approve outreach emails, send through Resend, and keep the provider trail attached to the operating system.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric icon={Megaphone} label="Content drafts" value={workspace.content.filter((item) => ["idea", "drafted", "scheduled"].includes(item.status)).length} />
          <Metric icon={Mail} label="Outbound emails" value={workspace.outboundMessages.length} />
          <Metric icon={Activity} label="Provider events" value={workspace.messageEvents.length} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() =>
              run(
                () => createCampaignKit({ accountId: account.id, brandId: brand?.id, event }),
                "Creating campaign kit"
              )
            }
            disabled={Boolean(busy)}
          >
            {busy === "Creating campaign kit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Create Valentine campaign kit
          </Button>
          <Button variant="ghost" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh statuses
          </Button>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <PanelHeader icon={Mail} title="Approved email lane" count={workspace.outboundMessages.length} />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field
              label="Draft"
              value={selectedMessage?.id || ""}
              onChange={(value) => {
                setSelectedMessageId(value);
                const next = workspace.outboundMessages.find((message) => message.id === value);
                setRecipient(next?.to_email || "");
                setFromEmail(next?.from_email || "");
                setReplyToEmail(next?.reply_to_email || "");
              }}
              options={workspace.outboundMessages.map((message) => ({ value: message.id, label: `${message.subject} (${message.status})` }))}
            />
            <Field label="Recipient email" type="email" value={recipient || selectedMessage?.to_email || ""} onChange={setRecipient} />
            <Field label="From email override" type="email" value={fromEmail || selectedMessage?.from_email || ""} onChange={setFromEmail} />
            <Field label="Reply-to override" type="email" value={replyToEmail || selectedMessage?.reply_to_email || ""} onChange={setReplyToEmail} />
          </div>
          {selectedMessage ? (
            <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{selectedMessage.subject}</p>
                  <p className="text-sm text-stone-400">
                    {selectedMessage.provider} · {selectedMessage.status} · {selectedMessage.to_email}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={updateMessageRecipient} disabled={Boolean(busy)}>
                    Save recipient
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => run(() => approveOutboundMessage(selectedMessage), "Approving email")}
                    disabled={Boolean(busy)}
                  >
                    Approve
                  </Button>
                  <Button onClick={() => run(() => approveAndSend(selectedMessage), "Sending email")} disabled={Boolean(busy)}>
                    {busy === "Sending email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send now
                  </Button>
                </div>
              </div>
              <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-white/10 bg-[#090807] p-3 text-sm text-stone-300">{selectedMessage.body}</pre>
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-white/10 bg-black/20 p-3 text-sm text-stone-500">No outbound drafts yet. Create a campaign kit to start.</p>
          )}
        </Card>

        <Card>
          <PanelHeader icon={Activity} title="Email status trail" count={messageEvents.length} />
          <div className="mt-4 space-y-2">
            {messageEvents.map((eventItem) => (
              <div key={eventItem.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                <p className="text-sm font-semibold">{eventItem.event_type}</p>
                <p className="text-xs text-stone-500">{new Date(eventItem.event_at).toLocaleString()}</p>
              </div>
            ))}
            {!messageEvents.length ? <p className="text-sm text-stone-500">No provider events yet. Sent emails will add local sent events immediately; Resend webhooks add delivery/reply events.</p> : null}
          </div>
        </Card>
      </div>

      <Card>
        <PanelHeader icon={Megaphone} title="Instagram preparation lane" count={pendingSocial.length} />
        <p className="mt-2 text-sm text-stone-400">
          Direct publishing comes after Meta setup. For tonight, this prepares approved packages with captions and image prompts so you can post manually without losing the operational trail.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {pendingSocial.map((post) => {
            const content = workspace.content.find((item) => item.id === post.content_item_id);
            return (
              <div key={post.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                <p className="font-semibold">{content?.title || "Instagram post"}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-[#d4af37]">{post.status}</p>
                <p className="mt-2 text-sm text-stone-300">{post.caption}</p>
                {post.metadata?.image_prompt ? <p className="mt-2 text-xs text-stone-500">Image prompt: {post.metadata.image_prompt}</p> : null}
                <div className="mt-3">
                  <Button variant="ghost" onClick={() => run(() => markSocialPostManualExport(post), "Exporting social post")} disabled={Boolean(busy)}>
                    Mark manually posted
                  </Button>
                </div>
              </div>
            );
          })}
          {!pendingSocial.length ? <p className="text-sm text-stone-500">No social drafts waiting. Create a campaign kit to generate Instagram packages.</p> : null}
        </div>
      </Card>
    </div>
  );
}

function Relationships({ workspace, createRecord, patch, remove }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <PeoplePanel people={workspace.people} createRecord={createRecord} patch={patch} remove={remove} />
      <OrganizationsPanel organizations={workspace.organizations} createRecord={createRecord} patch={patch} remove={remove} />
    </div>
  );
}

function PeoplePanel({ people, createRecord, patch, remove }) {
  const [form, setForm] = useState({ display_name: "", email: "", instagram: "", lifecycle_stage: "waitlist" });
  return (
    <Card>
      <PanelHeader icon={UserPlus} title="People" count={people.length} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
        <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label="Instagram" value={form.instagram} onChange={(v) => setForm({ ...form, instagram: v })} />
        <Field label="Stage" value={form.lifecycle_stage} onChange={(v) => setForm({ ...form, lifecycle_stage: v })} options={["lead", "waitlist", "attendee", "member", "volunteer", "partner", "inactive"]} />
      </div>
      <div className="mt-3">
        <Button onClick={() => createRecord("people", form)}>
          <Plus className="h-4 w-4" />
          Add person
        </Button>
      </div>
      <RecordList records={people} title={(p) => p.display_name} subtitle={(p) => `${p.lifecycle_stage} · ${p.email || p.instagram || "no contact"}`} onDone={(p) => patch("people", p.id, { next_follow_up_at: null })} onDelete={(p) => remove("people", p.id)} />
    </Card>
  );
}

function OrganizationsPanel({ organizations, createRecord, patch, remove }) {
  const [form, setForm] = useState({ name: "", org_type: "venue", status: "prospect", instagram: "" });
  return (
    <Card>
      <PanelHeader icon={Building2} title="Organizations" count={organizations.length} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Type" value={form.org_type} onChange={(v) => setForm({ ...form, org_type: v })} options={["venue", "sponsor", "vendor", "partner", "media", "community", "other"]} />
        <Field label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={["prospect", "contacted", "interested", "meeting_scheduled", "active", "rejected", "inactive"]} />
        <Field label="Instagram" value={form.instagram} onChange={(v) => setForm({ ...form, instagram: v })} />
      </div>
      <div className="mt-3">
        <Button onClick={() => createRecord("organizations", form)}>
          <Plus className="h-4 w-4" />
          Add organization
        </Button>
      </div>
      <RecordList records={organizations} title={(o) => o.name} subtitle={(o) => `${o.org_type} · ${o.status}`} onDone={(o) => patch("organizations", o.id, { status: "active" })} onDelete={(o) => remove("organizations", o.id)} />
    </Card>
  );
}

function Events({ account, brand, workspace, createRecord, patch, remove, refresh }) {
  const [form, setForm] = useState({ name: "", event_type: "meetup", status: "planning", capacity: 40, target_attendance: 30 });
  const [selectedId, setSelectedId] = useState(workspace.events[0]?.id || "");
  const [localError, setLocalError] = useState("");
  const selectedEvent = workspace.events.find((event) => event.id === selectedId) || workspace.events[0];

  async function generatePlan(event) {
    setLocalError("");
    try {
      await createEventPlan({ accountId: account.id, brandId: brand?.id, event });
      await refresh();
    } catch (err) {
      setLocalError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <PanelHeader icon={CalendarDays} title="Event planning system" count={workspace.events.length} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Event name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Type" value={form.event_type} onChange={(v) => setForm({ ...form, event_type: v })} options={["meetup", "walk", "game_night", "happy_hour", "flagship", "networking", "workshop", "other"]} />
          <Field label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={["idea", "planning", "promoting", "ready", "completed", "cancelled"]} />
          <Field label="Capacity" type="number" value={form.capacity} onChange={(v) => setForm({ ...form, capacity: Number(v) })} />
          <Field label="Target" type="number" value={form.target_attendance} onChange={(v) => setForm({ ...form, target_attendance: Number(v) })} />
        </div>
        <div className="mt-3">
          <Button onClick={() => createRecord("events", form)}>
            <Plus className="h-4 w-4" />
            Create event
          </Button>
        </div>
      </Card>
      {selectedEvent ? (
        <Card>
          {localError ? <p className="mb-4 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{localError}</p> : null}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase text-[#d4af37]">Event command center</p>
              <h3 className="mt-1 text-2xl font-semibold">{selectedEvent.name}</h3>
              <p className="mt-1 text-sm text-stone-400">
                {selectedEvent.event_type} · {selectedEvent.status} · {shortDate(selectedEvent.starts_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Field label="Focus event" value={selectedEvent.id} onChange={setSelectedId} options={workspace.events.map((event) => ({ value: event.id, label: event.name }))} />
              <Button onClick={() => generatePlan(selectedEvent)}>
                <Sparkles className="h-4 w-4" />
                Generate event plan
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Metric icon={CheckCircle2} label="Readiness" value={`${calculateEventReadiness(selectedEvent, workspace.tasks, workspace.content, workspace.communications)}%`} />
            <Metric icon={ClipboardList} label="Linked tasks" value={workspace.tasks.filter((task) => task.related_id === selectedEvent.id).length} />
            <Metric icon={Megaphone} label="Linked content" value={workspace.content.filter((item) => item.event_id === selectedEvent.id).length} />
            <Metric icon={CircleDollarSign} label="Event net" value={money(workspace.revenue.filter((item) => item.event_id === selectedEvent.id).reduce((sum, item) => sum + Number(item.amount || 0), 0))} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div>
              <h4 className="font-semibold">Readiness checklist</h4>
              <div className="mt-3 grid gap-2">
                {eventReadinessDetails(selectedEvent, workspace.tasks, workspace.content, workspace.communications).map((item) => (
                  <div key={item.key} className="rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className={cx("mt-0.5 h-4 w-4", item.done ? "text-emerald-300" : "text-stone-500")} />
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="mt-1 text-sm text-stone-400">{item.done ? "Complete" : item.fix}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold">Linked workflow</h4>
              <div className="mt-3 space-y-3">
                <Button
                  variant="ghost"
                  onClick={() =>
                    createRecord("content_items", {
                      event_id: selectedEvent.id,
                      title: `${selectedEvent.name} announcement`,
                      platform: "Instagram",
                      content_type: "post",
                      status: "idea",
                      caption: `Announce ${selectedEvent.name} with a warm, low-pressure CTA.`,
                    })
                  }
                >
                  <Megaphone className="h-4 w-4" />
                  Create event content
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    createRecord("communications", {
                      event_id: selectedEvent.id,
                      channel: "note",
                      direction: "internal",
                      subject: `${selectedEvent.name} planning note`,
                      body: "Add venue, sponsor, staffing, content, or attendee notes here.",
                    })
                  }
                >
                  <Mail className="h-4 w-4" />
                  Log planning note
                </Button>
                <Button variant="ghost" onClick={() => remove("events", selectedEvent.id)}>
                  <Trash2 className="h-4 w-4" />
                  Archive event
                </Button>
              </div>
              <div className="mt-4 grid gap-2">
                {workspace.tasks.filter((task) => task.related_id === selectedEvent.id).slice(0, 6).map((task) => (
                  <div key={task.id} className="rounded-md border border-white/10 bg-black/20 p-3 text-sm">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-stone-400">{task.priority} · {task.status} · {shortDate(task.due_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Communications({ account, brand, workspace, createRecord, remove, refresh }) {
  const [form, setForm] = useState({ channel: "note", direction: "internal", subject: "", body: "", follow_up_at: "" });
  const [localError, setLocalError] = useState("");

  async function logCommunication() {
    setLocalError("");
    try {
      const created = await createRecord("communications", form);
      if (created?.follow_up_at) {
        await createFollowUpFromCommunication({
          accountId: account.id,
          brandId: brand?.id,
          communication: created,
        });
        await refresh();
      }
      setForm({ channel: "note", direction: "internal", subject: "", body: "", follow_up_at: "" });
    } catch (err) {
      setLocalError(err.message);
    }
  }

  return (
    <Card>
      <PanelHeader icon={Mail} title="Communication timeline" count={workspace.communications.length} />
      {localError ? <p className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{localError}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Channel" value={form.channel} onChange={(v) => setForm({ ...form, channel: v })} options={["note", "email", "sms", "call", "meeting", "instagram", "in_person"]} />
        <Field label="Direction" value={form.direction} onChange={(v) => setForm({ ...form, direction: v })} options={["inbound", "outbound", "internal"]} />
        <Field label="Subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} />
        <Field label="Follow-up date" type="datetime-local" value={form.follow_up_at} onChange={(v) => setForm({ ...form, follow_up_at: v })} />
        <Field label="Body" multiline value={form.body} onChange={(v) => setForm({ ...form, body: v })} />
      </div>
      <div className="mt-3">
        <Button onClick={logCommunication}>
          <Plus className="h-4 w-4" />
          Log communication and follow-up
        </Button>
      </div>
      <RecordList records={workspace.communications} title={(c) => c.subject || c.channel} subtitle={(c) => `${c.direction} · ${shortDate(c.occurred_at)} · ${c.body}`} onDelete={(c) => remove("communications", c.id)} />
    </Card>
  );
}

function Tasks({ workspace, createRecord, patch, remove }) {
  const [form, setForm] = useState({ title: "", priority: "medium", status: "todo", task_type: "general" });
  const [filter, setFilter] = useState("open");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const filteredTasks = workspace.tasks.filter((task) => {
    if (filter === "all") return true;
    if (filter === "completed") return task.status === "done";
    if (filter === "archived") return task.status === "cancelled";
    return !["done", "cancelled"].includes(task.status);
  });
  const selectedTask = workspace.tasks.find((task) => task.id === selectedTaskId) || filteredTasks[0];

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <Card>
        <PanelHeader icon={ClipboardList} title="Tasks and follow-ups" count={workspace.tasks.length} />
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Field label="Task" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <Field label="Priority" value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} options={["low", "medium", "high", "urgent"]} />
          <Field label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={["todo", "doing", "waiting", "done", "cancelled"]} />
          <Field label="Type" value={form.task_type} onChange={(v) => setForm({ ...form, task_type: v })} options={["general", "follow_up", "event_prep", "content", "sales", "admin"]} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => createRecord("tasks", form)}>
            <Plus className="h-4 w-4" />
            Add task
          </Button>
          {["open", "completed", "all", "archived"].map((option) => (
            <Button key={option} variant={filter === option ? "gold" : "ghost"} onClick={() => setFilter(option)}>
              {option}
            </Button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {filteredTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => setSelectedTaskId(task.id)}
              className={cx(
                "w-full rounded-md border p-3 text-left transition",
                selectedTask?.id === task.id
                  ? "border-[#d4af37]/40 bg-[#d4af37]/10"
                  : "border-white/10 bg-black/20 hover:bg-white/5"
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className={cx("font-medium", task.status === "done" && "text-stone-400 line-through")}>{task.title}</p>
                  <p className="mt-1 text-sm text-stone-400">
                    {task.priority} · {task.status} · {task.task_type} · due {shortDate(task.due_at)}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-stone-300">
                  {getRelatedLabel(task, workspace)}
                </span>
              </div>
            </button>
          ))}
          {!filteredTasks.length ? <p className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-stone-500">No tasks in this view.</p> : null}
        </div>
      </Card>

      <TaskDetailPanel task={selectedTask} workspace={workspace} patch={patch} remove={remove} />
    </div>
  );
}

function TaskDetailPanel({ task, workspace, patch, remove }) {
  if (!task) {
    return (
      <Card>
        <p className="text-sm text-stone-400">Select a task to see the full operating details.</p>
      </Card>
    );
  }

  const context = getRelatedContext(task, workspace);
  const relatedComms = workspace.communications.filter((communication) => {
    if (task.related_type === "event") return communication.event_id === task.related_id;
    if (task.related_type === "organization") return communication.organization_id === task.related_id;
    if (task.related_type === "person") return communication.person_id === task.related_id;
    return false;
  });

  return (
    <Card className="h-fit xl:sticky xl:top-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-[#d4af37]">Task detail</p>
          <h2 className="mt-1 text-xl font-semibold">{task.title}</h2>
        </div>
        <span className="rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-1 text-sm text-[#f1d574]">
          {task.status}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Status" value={task.status} onChange={(v) => patch("tasks", task.id, { status: v, completed_at: v === "done" ? new Date().toISOString() : null })} options={["todo", "doing", "waiting", "done", "cancelled"]} />
        <Field label="Priority" value={task.priority} onChange={(v) => patch("tasks", task.id, { priority: v })} options={["low", "medium", "high", "urgent"]} />
        <Field label="Due date" type="datetime-local" value={toDateTimeLocal(task.due_at)} onChange={(v) => patch("tasks", task.id, { due_at: v || null })} />
        <Field label="Type" value={task.task_type} onChange={(v) => patch("tasks", task.id, { task_type: v })} options={["general", "follow_up", "event_prep", "content", "sales", "admin"]} />
      </div>

      <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
        <p className="text-xs uppercase text-stone-500">Linked context</p>
        <p className="mt-2 font-medium">{context.title}</p>
        <p className="mt-1 text-sm text-stone-400">{context.subtitle}</p>
      </div>

      <div className="mt-4">
        <Field label="Details / notes" multiline value={task.notes} onChange={(v) => patch("tasks", task.id, { notes: v })} />
      </div>

      <div className="mt-4 grid gap-2 text-sm text-stone-400">
        <p>Created: {task.created_at ? new Date(task.created_at).toLocaleString() : "Unknown"}</p>
        <p>Updated: {task.updated_at ? new Date(task.updated_at).toLocaleString() : "Unknown"}</p>
        <p>Completed: {task.completed_at ? new Date(task.completed_at).toLocaleString() : "Not completed"}</p>
      </div>

      {relatedComms.length ? (
        <div className="mt-4">
          <p className="text-sm font-semibold">Related communications</p>
          <div className="mt-2 space-y-2">
            {relatedComms.slice(0, 4).map((communication) => (
              <div key={communication.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                <p className="text-sm font-medium">{communication.subject || communication.channel}</p>
                <p className="mt-1 line-clamp-2 text-xs text-stone-400">{communication.body}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => patch("tasks", task.id, { status: "done", completed_at: new Date().toISOString() })}>
          <CheckCircle2 className="h-4 w-4" />
          Mark done
        </Button>
        <Button variant="ghost" onClick={() => patch("tasks", task.id, { status: "todo", completed_at: null })}>
          Reopen
        </Button>
        <Button variant="ghost" onClick={() => remove("tasks", task.id)}>
          <Trash2 className="h-4 w-4" />
          Archive
        </Button>
      </div>
    </Card>
  );
}

function getRelatedLabel(task, workspace) {
  return getRelatedContext(task, workspace).title;
}

function getRelatedContext(task, workspace) {
  if (!task.related_type || !task.related_id) {
    return { title: "No link", subtitle: "This task is not tied to a record yet." };
  }

  if (task.related_type === "event") {
    const event = workspace.events.find((item) => item.id === task.related_id);
    return event
      ? { title: event.name, subtitle: `${event.event_type} · ${event.status} · ${shortDate(event.starts_at)}` }
      : { title: "Missing event", subtitle: task.related_id };
  }

  if (task.related_type === "organization") {
    const org = workspace.organizations.find((item) => item.id === task.related_id);
    return org
      ? { title: org.name, subtitle: `${org.org_type} · ${org.status} · ${org.email || org.instagram || org.phone || "no contact"}` }
      : { title: "Missing organization", subtitle: task.related_id };
  }

  if (task.related_type === "person") {
    const person = workspace.people.find((item) => item.id === task.related_id);
    return person
      ? { title: person.display_name, subtitle: `${person.lifecycle_stage} · ${person.email || person.instagram || person.phone || "no contact"}` }
      : { title: "Missing person", subtitle: task.related_id };
  }

  return { title: task.related_type, subtitle: task.related_id };
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function Content({ workspace, createRecord, patch, remove }) {
  const [form, setForm] = useState({ title: "", platform: "Instagram", content_type: "post", status: "idea" });
  return (
    <Card>
      <PanelHeader icon={Megaphone} title="Content calendar" count={workspace.content.length} />
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        <Field label="Platform" value={form.platform} onChange={(v) => setForm({ ...form, platform: v })} />
        <Field label="Type" value={form.content_type} onChange={(v) => setForm({ ...form, content_type: v })} options={["post", "reel", "story", "email", "blog", "short", "carousel", "poll"]} />
        <Field label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={["idea", "drafted", "filmed", "edited", "scheduled", "posted", "archived"]} />
      </div>
      <div className="mt-3">
        <Button onClick={() => createRecord("content_items", form)}>
          <Plus className="h-4 w-4" />
          Add content
        </Button>
      </div>
      <RecordList records={workspace.content} title={(c) => c.title} subtitle={(c) => `${c.platform} · ${c.status} · ${c.caption || "No caption yet"}`} onDone={(c) => patch("content_items", c.id, { status: "posted" })} onDelete={(c) => remove("content_items", c.id)} />
    </Card>
  );
}

function Revenue({ workspace, createRecord, remove, revenueTotal }) {
  const [form, setForm] = useState({ item_type: "ticket", description: "", amount: 0, status: "planned" });
  return (
    <div className="space-y-5">
      <Metric icon={CircleDollarSign} label="Net tracked" value={money(revenueTotal)} hint="Use negative amounts for expenses" />
      <Card>
        <PanelHeader icon={CircleDollarSign} title="Revenue and expenses" count={workspace.revenue.length} />
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Field label="Type" value={form.item_type} onChange={(v) => setForm({ ...form, item_type: v })} options={["ticket", "sponsorship", "expense", "in_kind", "donation", "other"]} />
          <Field label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <Field label="Amount" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: Number(v) })} />
          <Field label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={["planned", "pending", "received", "paid", "cancelled"]} />
        </div>
        <div className="mt-3">
          <Button onClick={() => createRecord("revenue_items", form)}>
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        </div>
        <RecordList records={workspace.revenue} title={(r) => r.description} subtitle={(r) => `${r.item_type} · ${money(r.amount)} · ${r.status}`} onDelete={(r) => remove("revenue_items", r.id)} />
      </Card>
    </div>
  );
}

function Weekly({ workspace, createRecord, patch }) {
  const [form, setForm] = useState({ week_of: new Date().toISOString().slice(0, 10), accomplished: "", top_priorities: "" });
  return (
    <Card>
      <PanelHeader icon={CheckCircle2} title="Weekly planning and check-in" count={workspace.weeklyReviews.length} />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Week of" type="date" value={form.week_of} onChange={(v) => setForm({ ...form, week_of: v })} />
        <Field label="Accomplished" multiline value={form.accomplished} onChange={(v) => setForm({ ...form, accomplished: v })} />
        <Field label="Top priorities" multiline value={form.top_priorities} onChange={(v) => setForm({ ...form, top_priorities: v })} />
      </div>
      <div className="mt-3">
        <Button onClick={() => createRecord("weekly_reviews", form)}>
          <Plus className="h-4 w-4" />
          Save review
        </Button>
      </div>
      <RecordList records={workspace.weeklyReviews} title={(w) => `Week of ${w.week_of}`} subtitle={(w) => w.top_priorities || w.accomplished || "No notes"} onDone={(w) => patch("weekly_reviews", w.id, { ai_summary: "Reviewed manually." })} />
    </Card>
  );
}

function Intelligence({ account, brand, workspace, refresh }) {
  const [templateId, setTemplateId] = useState("");
  const [relatedEventId, setRelatedEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runGenerator() {
    const template = workspace.promptTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setLoading(true);
    setError("");
    try {
      await generateAi({
        templateId,
        accountId: account.id,
        brandId: brand?.id,
        relatedType: relatedEventId ? "event" : null,
        relatedId: relatedEventId || null,
        context: {
          brand,
          selectedEvent: workspace.events.find((event) => event.id === relatedEventId),
          briefing: buildBriefingContext(workspace),
        },
      });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function convertOutput(output, target) {
    setError("");
    try {
      if (target === "task") {
        await saveAiOutputAsTask({ accountId: account.id, brandId: brand?.id, output });
      }
      if (target === "content") {
        await saveAiOutputAsContent({ accountId: account.id, brandId: brand?.id, output });
      }
      if (target === "communication") {
        await saveAiOutputAsCommunication({ accountId: account.id, brandId: brand?.id, output });
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <PanelHeader icon={Brain} title="AI generator" count={workspace.promptTemplates.length} />
        <p className="mt-2 text-sm text-stone-400">
          Uses prompt templates in Postgres and saves outputs to `ai_outputs`. Configure `OPENAI_API_KEY` on the Supabase Edge Function to generate live results.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Generator" value={templateId} onChange={setTemplateId} options={workspace.promptTemplates.map((t) => ({ value: t.id, label: `${t.name} (${t.category})` }))} />
          <Field label="Related event" value={relatedEventId} onChange={setRelatedEventId} options={workspace.events.map((e) => ({ value: e.id, label: e.name }))} />
          <div className="flex items-end">
            <Button onClick={runGenerator} disabled={loading || !templateId}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              Generate and save
            </Button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {workspace.promptTemplates.map((template) => (
            <div key={template.id} className="rounded-md border border-white/10 bg-black/20 p-3">
              <p className="font-medium">{template.name}</p>
              <p className="text-sm text-stone-400">{template.category}</p>
            </div>
          ))}
        </div>
        {error ? <p className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
      </Card>
      <Card>
        <PanelHeader icon={Sparkles} title="Saved AI outputs" count={workspace.aiOutputs.length} />
        <div className="mt-4 space-y-2">
          {workspace.aiOutputs.map((output) => (
            <div key={output.id} className="rounded-md border border-white/10 bg-black/20 p-3">
              <p className="font-medium">{output.title}</p>
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-stone-400">{output.output}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => convertOutput(output, "task")}>
                  <ClipboardList className="h-4 w-4" />
                  Save as task
                </Button>
                <Button variant="ghost" onClick={() => convertOutput(output, "content")}>
                  <Megaphone className="h-4 w-4" />
                  Save as content
                </Button>
                <Button variant="ghost" onClick={() => convertOutput(output, "communication")}>
                  <Mail className="h-4 w-4" />
                  Save as comm
                </Button>
              </div>
            </div>
          ))}
          {!workspace.aiOutputs.length ? <p className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-stone-500">No AI outputs yet.</p> : null}
        </div>
      </Card>
    </div>
  );
}

function PanelHeader({ icon: Icon, title, count }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-[#d4af37]" />
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-stone-300">{count}</span>
    </div>
  );
}

function RecordList({ records, title, subtitle, onDone, onDelete }) {
  return (
    <div className="mt-4 space-y-2">
      {records.map((record) => (
        <div key={record.id} className="rounded-md border border-white/10 bg-black/20 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium">{title(record)}</p>
              <p className="mt-1 line-clamp-2 text-sm text-stone-400">{subtitle(record)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              {onDone ? (
                <Button variant="ghost" onClick={() => onDone(record)}>
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              ) : null}
              {onDelete ? (
                <Button variant="ghost" onClick={() => onDelete(record)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ))}
      {!records.length ? <p className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-stone-500">No records yet.</p> : null}
    </div>
  );
}
