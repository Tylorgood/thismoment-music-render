import { supabase } from "@/lib/supabaseClient";

const selectAll = "select=*";
const active = "deleted_at=is.null";

function qs(parts) {
  return `?${parts.filter(Boolean).join("&")}`;
}

function first(data) {
  return Array.isArray(data) ? data[0] : data;
}

export async function getSession() {
  if (!supabase) return { session: null };
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchMemberships() {
  const memberships = await supabase.table("account_memberships").list(qs([selectAll, active]));
  const hydrated = await Promise.all(
    memberships.map(async (membership) => {
      const accounts = await supabase.table("accounts").list(qs([selectAll, `id=eq.${membership.account_id}`, active]));
      return { ...membership, accounts: first(accounts) };
    })
  );
  return hydrated;
}

export async function bootstrapWorkspace(userId) {
  return supabase.rpc("bootstrap_this_moment_workspace");
}

export async function seedWorkspace(accountId, brandId, cityId) {
  const venue = first(
    await supabase.table("organizations").insert({
      account_id: accountId,
      brand_id: brandId,
      city_id: cityId,
      name: "Eastern Market Brewing Co.",
      org_type: "venue",
      instagram: "@easternmarketbrewing",
      capacity: 75,
      status: "interested",
      next_follow_up_at: nextDate(3),
      notes: "Potential compatibility happy hour venue.",
    })
  );

  const sponsor = first(
    await supabase.table("organizations").insert({
      account_id: accountId,
      brand_id: brandId,
      city_id: cityId,
      name: "Detroit florist lead",
      org_type: "sponsor",
      status: "prospect",
      next_follow_up_at: nextDate(5),
      notes: "Strong Valentine tie-in for floral photo moment or mini bouquet giveaway.",
    })
  );

  const event = first(
    await supabase.table("events").insert({
      account_id: accountId,
      brand_id: brandId,
      city_id: cityId,
      venue_organization_id: venue?.id,
      name: "Compatibility Happy Hour",
      event_type: "happy_hour",
      status: "planning",
      starts_at: nextDate(38),
      capacity: 40,
      target_attendance: 32,
      expected_attendance: 24,
      ticket_goal: 800,
      budget_goal: 250,
      description: "Low-pressure social event to test compatibility prompts before Valentine's.",
    })
  );

  await supabase.table("people").insert({
    account_id: accountId,
    brand_id: brandId,
    city_id: cityId,
    display_name: "Waitlist Member",
    email: "example@email.com",
    instagram: "@metrodetroitsingle",
    lifecycle_stage: "waitlist",
    source: "Instagram",
    consent_email: true,
    notes: "Wants events that feel natural and not awkward.",
    next_follow_up_at: nextDate(7),
  });

  await supabase.table("opportunities").insert({
    account_id: accountId,
    brand_id: brandId,
    organization_id: venue?.id,
    opportunity_type: "venue",
    title: "Host compatibility happy hour",
    stage: "qualified",
    expected_close_date: nextDateOnly(10),
    next_follow_up_at: nextDate(3),
    notes: "Ask about Thursday evening availability and revenue share.",
  });

  await supabase.table("opportunities").insert({
    account_id: accountId,
    brand_id: brandId,
    organization_id: sponsor?.id,
    opportunity_type: "sponsorship",
    title: "Valentine floral sponsor",
    stage: "prospect",
    in_kind_value: 300,
    expected_close_date: nextDateOnly(30),
    next_follow_up_at: nextDate(5),
  });

  await supabase.table("tasks").insert({
    account_id: accountId,
    brand_id: brandId,
    title: "Confirm first happy hour venue",
    status: "todo",
    priority: "urgent",
    due_at: nextDate(3),
    task_type: "follow_up",
    related_type: "event",
    related_id: event?.id,
    notes: "Ask about capacity, private/semi-private space, fee, and bar minimum.",
  });

  await supabase.table("tasks").insert({
    account_id: accountId,
    brand_id: brandId,
    title: "Draft Valentine waitlist CTA",
    status: "todo",
    priority: "high",
    due_at: nextDate(2),
    task_type: "content",
  });

  await supabase.table("content_items").insert({
    account_id: accountId,
    brand_id: brandId,
    event_id: event?.id,
    title: "Question of the week",
    platform: "Instagram",
    content_type: "post",
    status: "idea",
    publish_at: nextDate(1),
    caption: "What makes a first conversation feel easy instead of forced?",
    image_prompt:
      "Cinematic Metro Detroit coffee shop table, two drinks, warm window light, premium romantic editorial mood, empty text-safe space.",
    hashtags: "#detroitsingles #metrodetroit #thismoment",
  });

  await supabase.table("communications").insert({
    account_id: accountId,
    brand_id: brandId,
    organization_id: venue?.id,
    event_id: event?.id,
    channel: "note",
    direction: "internal",
    subject: "Initial venue fit",
    body: "Good candidate for a small compatibility happy hour. Need fee, available dates, and food/drink expectations.",
    follow_up_at: nextDate(3),
  });

  await supabase.table("revenue_items").insert({
    account_id: accountId,
    brand_id: brandId,
    event_id: event?.id,
    item_type: "expense",
    description: "Initial event supplies estimate",
    amount: -85,
    status: "planned",
  });
}

export async function fetchWorkspace(accountId) {
  const accountFilter = `account_id=eq.${accountId}`;
  const [
    brands,
    cities,
    people,
    organizations,
    opportunities,
    events,
    tasks,
    communications,
    content,
    revenue,
    weeklyReviews,
    promptTemplates,
    aiOutputs,
    plans,
    planSteps,
    automationRuns,
    executionLogs,
    providerConnections,
    contentAssets,
    outboundMessages,
    messageEvents,
    socialAccounts,
    socialPosts,
    executionQueue,
  ] = await Promise.all([
    supabase.table("brands").list(qs([selectAll, accountFilter, active, "order=created_at.asc"])),
    supabase.table("cities").list(qs([selectAll, accountFilter, active, "order=created_at.asc"])),
    supabase.table("people").list(qs([selectAll, accountFilter, active, "order=created_at.desc"])),
    supabase.table("organizations").list(qs([selectAll, accountFilter, active, "order=created_at.desc"])),
    supabase.table("opportunities").list(qs([selectAll, accountFilter, active, "order=created_at.desc"])),
    supabase.table("events").list(qs([selectAll, accountFilter, active, "order=starts_at.asc.nullslast"])),
    supabase.table("tasks").list(qs([selectAll, accountFilter, active, "order=due_at.asc.nullslast"])),
    supabase.table("communications").list(qs([selectAll, accountFilter, active, "order=occurred_at.desc"])),
    supabase.table("content_items").list(qs([selectAll, accountFilter, active, "order=publish_at.asc.nullslast"])),
    supabase.table("revenue_items").list(qs([selectAll, accountFilter, active, "order=occurred_on.desc"])),
    supabase.table("weekly_reviews").list(qs([selectAll, accountFilter, active, "order=week_of.desc"])),
    supabase.table("prompt_templates").list(qs([selectAll, "or=(account_id.is.null,account_id.eq." + accountId + ")", active, "order=category.asc"])),
    supabase.table("ai_outputs").list(qs([selectAll, accountFilter, active, "order=created_at.desc"])),
    supabase.table("plans").list(qs([selectAll, accountFilter, active, "order=created_at.desc"])),
    supabase.table("plan_steps").list(qs([selectAll, accountFilter, active, "order=position.asc"])),
    supabase.table("automation_runs").list(qs([selectAll, accountFilter, active, "order=created_at.desc"])),
    supabase.table("execution_logs").list(qs([selectAll, accountFilter, "order=created_at.desc", "limit=50"])),
    supabase.table("provider_connections").list(qs([selectAll, accountFilter, active, "order=created_at.desc"])),
    supabase.table("content_assets").list(qs([selectAll, accountFilter, active, "order=created_at.desc"])),
    supabase.table("outbound_messages").list(qs([selectAll, accountFilter, active, "order=created_at.desc"])),
    supabase.table("message_events").list(qs([selectAll, accountFilter, "order=event_at.desc", "limit=100"])),
    supabase.table("social_accounts").list(qs([selectAll, accountFilter, active, "order=created_at.desc"])),
    supabase.table("social_posts").list(qs([selectAll, accountFilter, active, "order=scheduled_at.asc.nullslast"])),
    supabase.table("execution_queue").list(qs([selectAll, accountFilter, active, "order=run_after.asc"])),
  ]);

  return {
    brands,
    cities,
    people,
    organizations,
    opportunities,
    events,
    tasks,
    communications,
    content,
    revenue,
    weeklyReviews,
    promptTemplates,
    aiOutputs,
    plans,
    planSteps,
    automationRuns,
    executionLogs,
    providerConnections,
    contentAssets,
    outboundMessages,
    messageEvents,
    socialAccounts,
    socialPosts,
    executionQueue,
  };
}

export async function insertRecord(table, record) {
  return first(await supabase.table(table).insert(record));
}

export async function updateRecord(table, id, patch) {
  return first(await supabase.table(table).update(id, patch));
}

export async function softDeleteRecord(table, id) {
  await updateRecord(table, id, { deleted_at: new Date().toISOString() });
}

export async function createPlanFromRecommendations({ accountId, brandId, recommendations, event }) {
  const plan = await insertRecord("plans", {
    account_id: accountId,
    brand_id: brandId,
    title: `${new Date().toLocaleDateString()} Operator Plan`,
    plan_type: event ? "event" : "daily",
    status: "draft",
    objective: "Convert system recommendations into an approved execution queue.",
  });

  const steps = recommendations.map((rec, index) => ({
    account_id: accountId,
    brand_id: brandId,
    plan_id: plan.id,
    position: index + 1,
    title: rec.title,
    description: rec.reason,
    step_type: "create_task",
    status: "proposed",
    requires_human: false,
    action_payload: {
      title: rec.title,
      priority: rec.priority === "urgent" ? "urgent" : rec.priority === "high" ? "high" : "medium",
      task_type: event ? "event_prep" : "admin",
      related_type: event ? "event" : null,
      related_id: event?.id || null,
      notes: rec.reason,
      due_at: new Date().toISOString(),
    },
  }));

  for (const step of steps) {
    await insertRecord("plan_steps", step);
  }

  await logExecution({
    accountId,
    brandId,
    planId: plan.id,
    message: `Created plan with ${steps.length} proposed steps.`,
  });

  return plan;
}

export async function approvePlan({ accountId, brandId, plan, steps }) {
  await updateRecord("plans", plan.id, {
    status: "approved",
    approved_at: new Date().toISOString(),
  });

  for (const step of steps.filter((item) => item.status === "proposed")) {
    await updateRecord("plan_steps", step.id, { status: "approved" });
  }

  await insertRecord("approvals", {
    account_id: accountId,
    brand_id: brandId,
    plan_id: plan.id,
    decision: "approved",
    notes: "Approved from command center.",
  });

  await logExecution({
    accountId,
    brandId,
    planId: plan.id,
    message: "Plan approved and ready for execution.",
  });
}

export async function executeApprovedPlan({ accountId, brandId, plan, steps }) {
  const run = await insertRecord("automation_runs", {
    account_id: accountId,
    brand_id: brandId,
    plan_id: plan.id,
    status: "running",
    started_at: new Date().toISOString(),
    summary: "Executing approved internal actions.",
  });

  await updateRecord("plans", plan.id, {
    status: "running",
    started_at: new Date().toISOString(),
  });

  let completed = 0;
  let failed = 0;

  for (const step of steps.filter((item) => item.status === "approved")) {
    try {
      await updateRecord("plan_steps", step.id, { status: "running" });
      const result = await executePlanStep({ accountId, brandId, step });
      await updateRecord("plan_steps", step.id, {
        status: "done",
        result,
      });
      await logExecution({
        accountId,
        brandId,
        planId: plan.id,
        planStepId: step.id,
        automationRunId: run.id,
        message: `Completed: ${step.title}`,
        metadata: result,
      });
      completed += 1;
    } catch (error) {
      failed += 1;
      await updateRecord("plan_steps", step.id, {
        status: "failed",
        error: error.message,
      });
      await logExecution({
        accountId,
        brandId,
        planId: plan.id,
        planStepId: step.id,
        automationRunId: run.id,
        level: "error",
        message: `Failed: ${step.title}`,
        metadata: { error: error.message },
      });
    }
  }

  const finalStatus = failed ? "failed" : "completed";
  await updateRecord("automation_runs", run.id, {
    status: finalStatus,
    completed_at: new Date().toISOString(),
    summary: `${completed} completed, ${failed} failed.`,
  });
  await updateRecord("plans", plan.id, {
    status: finalStatus,
    completed_at: new Date().toISOString(),
  });

  return { completed, failed };
}

export async function rejectPlanStep(step) {
  return updateRecord("plan_steps", step.id, { status: "rejected" });
}

export async function createCampaignKit({ accountId, brandId, event }) {
  const eventName = event?.name || "This Moment Valentine event";
  const eventId = event?.id || null;
  const now = new Date();
  const contentIdeas = [
    {
      title: `${eventName}: announcement post`,
      content_type: "post",
      caption: "Something intentional is coming for Metro Detroit singles. Low pressure, good energy, real conversation. Join the waitlist for first access.",
      image_prompt: "Cinematic Metro Detroit evening social scene, warm ambient light, stylish diverse singles laughing naturally, premium editorial event photography, clean text-safe space.",
      publish_at: daysFromNow(1),
    },
    {
      title: `${eventName}: conversation prompt reel`,
      content_type: "reel",
      caption: "A good first conversation does not need a perfect opener. It needs a better room.",
      image_prompt: "Vertical cinematic reel cover, cozy Detroit cocktail lounge, two empty seats at a small table, romantic but modern lighting, minimal premium composition.",
      publish_at: daysFromNow(3),
    },
    {
      title: `${eventName}: waitlist story`,
      content_type: "story",
      caption: "Would you come to a singles event that felt more like a curated night out than a dating app in real life?",
      image_prompt: "Instagram story background, soft flash photo aesthetic, Detroit nightlife textures, gold and black event brand palette, text-safe negative space.",
      publish_at: daysFromNow(5),
    },
  ];

  const createdContent = [];
  const createdPosts = [];
  for (const idea of contentIdeas) {
    const content = await insertRecord("content_items", {
      account_id: accountId,
      brand_id: brandId,
      event_id: eventId,
      title: idea.title,
      platform: "Instagram",
      content_type: idea.content_type,
      status: "drafted",
      approval_status: "draft",
      publish_at: idea.publish_at,
      caption: idea.caption,
      image_prompt: idea.image_prompt,
      notes: "Generated from campaign kit. Review caption, create/attach asset, then approve.",
      metadata: { source: "campaign_kit", generated_at: now.toISOString() },
    });
    createdContent.push(content);
    const socialPost = await insertRecord("social_posts", {
      account_id: accountId,
      brand_id: brandId,
      content_item_id: content.id,
      event_id: eventId,
      provider: "instagram",
      caption: idea.caption,
      status: "needs_media",
      scheduled_at: idea.publish_at,
      metadata: { source: "campaign_kit", image_prompt: idea.image_prompt },
    });
    createdPosts.push(socialPost);
  }

  const emailDrafts = [
    {
      subject: `Venue idea: ${eventName}`,
      body: `Hi there,\n\nI'm building This Moment, a Metro Detroit social events brand for singles who want a more natural way to meet people.\n\nI'm looking for a warm venue partner for ${eventName}. The goal is a polished, low-pressure room with good energy, clear arrival flow, and a setting that makes conversation easy.\n\nWould you be open to a quick conversation about availability, capacity, room minimums, and what a simple partnership could look like?\n\nThank you,\nThis Moment`,
      taskTitle: `Review and send venue pitch for ${eventName}`,
    },
    {
      subject: `Local sponsorship fit for ${eventName}`,
      body: `Hi there,\n\nI'm reaching out from This Moment, a Metro Detroit community events brand creating intentional social experiences for local singles.\n\nWe're preparing ${eventName} and looking for a few aligned local partners who want warm visibility with an audience that values experiences, style, and real-life connection.\n\nA simple fit could be an in-kind moment, small giveaway, featured table, or light sponsorship package.\n\nWould it be worth a quick intro to see if this audience and event concept fit your goals?\n\nThank you,\nThis Moment`,
      taskTitle: `Review and send sponsor pitch for ${eventName}`,
    },
  ];

  const createdMessages = [];
  for (const draft of emailDrafts) {
    const communication = await insertRecord("communications", {
      account_id: accountId,
      brand_id: brandId,
      event_id: eventId,
      channel: "email",
      direction: "outbound",
      subject: draft.subject,
      body: draft.body,
      follow_up_at: daysFromNow(3),
      provider: "resend",
      delivery_status: "draft",
      metadata: { source: "campaign_kit" },
    });
    const message = await insertRecord("outbound_messages", {
      account_id: accountId,
      brand_id: brandId,
      communication_id: communication.id,
      event_id: eventId,
      provider: "resend",
      message_type: "email",
      to_email: "replace-with-real-contact@example.com",
      subject: draft.subject,
      body: draft.body,
      status: "draft",
      metadata: { source: "campaign_kit", needs_real_recipient: true },
    });
    await insertRecord("tasks", {
      account_id: accountId,
      brand_id: brandId,
      title: draft.taskTitle,
      status: "todo",
      priority: "high",
      due_at: daysFromNow(1),
      task_type: "sales",
      related_type: "communication",
      related_id: communication.id,
      notes: "Replace recipient, personalize, approve, then send from Growth.",
    });
    createdMessages.push(message);
  }

  await logExecution({
    accountId,
    brandId,
    message: `Created campaign kit for ${eventName}.`,
    metadata: {
      content_items: createdContent.map((item) => item.id),
      social_posts: createdPosts.map((item) => item.id),
      outbound_messages: createdMessages.map((item) => item.id),
    },
  });

  return { content: createdContent, socialPosts: createdPosts, outboundMessages: createdMessages };
}

export async function approveOutboundMessage(message) {
  return updateRecord("outbound_messages", message.id, { status: "approved" });
}

export async function sendOutboundEmail(messageId) {
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: { message_id: messageId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function markSocialPostManualExport(post) {
  await updateRecord("social_posts", post.id, {
    status: "manual_exported",
    published_at: new Date().toISOString(),
  });
  if (post.content_item_id) {
    await updateRecord("content_items", post.content_item_id, {
      status: "posted",
      approval_status: "approved",
      provider_status: "manual_exported",
      published_at: new Date().toISOString(),
    });
  }
}

async function executePlanStep({ accountId, brandId, step }) {
  const payload = step.action_payload || {};
  if (step.requires_human || step.step_type === "human_question" || step.step_type === "manual_action") {
    return updateRecord("plan_steps", step.id, { status: "needs_human" });
  }

  if (step.step_type === "create_task") {
    const record = await insertRecord("tasks", {
      account_id: accountId,
      brand_id: brandId,
      title: payload.title || step.title,
      status: "todo",
      priority: payload.priority || "medium",
      due_at: payload.due_at || null,
      task_type: payload.task_type || "general",
      related_type: payload.related_type || null,
      related_id: payload.related_id || null,
      notes: payload.notes || step.description,
    });
    return { table: "tasks", id: record.id };
  }

  if (step.step_type === "create_content") {
    const record = await insertRecord("content_items", {
      account_id: accountId,
      brand_id: brandId,
      title: payload.title || step.title,
      event_id: payload.event_id || null,
      platform: payload.platform || "Instagram",
      content_type: payload.content_type || "post",
      status: payload.status || "idea",
      caption: payload.caption || step.description,
      image_prompt: payload.image_prompt || null,
      notes: payload.notes || null,
    });
    return { table: "content_items", id: record.id };
  }

  if (step.step_type === "create_communication") {
    const record = await insertRecord("communications", {
      account_id: accountId,
      brand_id: brandId,
      event_id: payload.event_id || null,
      organization_id: payload.organization_id || null,
      person_id: payload.person_id || null,
      channel: payload.channel || "email",
      direction: payload.direction || "outbound",
      subject: payload.subject || step.title,
      body: payload.body || step.description,
      follow_up_at: payload.follow_up_at || null,
    });
    return { table: "communications", id: record.id };
  }

  if (step.step_type === "update_event") {
    const record = await updateRecord("events", payload.event_id, payload.patch || {});
    return { table: "events", id: record.id };
  }

  throw new Error(`Unsupported step type: ${step.step_type}`);
}

async function logExecution({ accountId, brandId, planId, planStepId, automationRunId, level = "info", message, metadata = {} }) {
  return insertRecord("execution_logs", {
    account_id: accountId,
    brand_id: brandId,
    plan_id: planId || null,
    plan_step_id: planStepId || null,
    automation_run_id: automationRunId || null,
    level,
    message,
    metadata,
  });
}

export async function generateAi({ templateId, accountId, brandId, context, relatedType, relatedId }) {
  const { data, error } = await supabase.functions.invoke("generate-ai", {
    body: {
      template_id: templateId,
      account_id: accountId,
      brand_id: brandId,
      context,
      related_type: relatedType,
      related_id: relatedId,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function createEventPlan({ accountId, brandId, event }) {
  const dueBase = event?.starts_at ? new Date(event.starts_at) : new Date();
  const tasks = eventPlanTasks(event).map((task) => ({
    account_id: accountId,
    brand_id: brandId,
    title: task.title,
    status: "todo",
    priority: task.priority,
    due_at: daysBefore(dueBase, task.daysBefore),
    task_type: "event_prep",
    related_type: "event",
    related_id: event.id,
    notes: task.notes,
  }));

  for (const task of tasks) {
    await insertRecord("tasks", task);
  }

  return tasks.length;
}

export async function createFollowUpFromCommunication({ accountId, brandId, communication }) {
  if (!communication?.follow_up_at) return null;
  return insertRecord("tasks", {
    account_id: accountId,
    brand_id: brandId,
    title: `Follow up: ${communication.subject || communication.channel}`,
    status: "todo",
    priority: "high",
    due_at: communication.follow_up_at,
    task_type: "follow_up",
    related_type: communication.organization_id ? "organization" : communication.person_id ? "person" : "communication",
    related_id: communication.organization_id || communication.person_id || communication.id,
    notes: communication.body,
  });
}

export async function saveAiOutputAsTask({ accountId, brandId, output }) {
  return insertRecord("tasks", {
    account_id: accountId,
    brand_id: brandId,
    title: `Use AI output: ${output.title}`,
    status: "todo",
    priority: "medium",
    due_at: daysFromNow(1),
    task_type: output.output_type === "sales" ? "sales" : "content",
    related_type: output.related_type || "ai_output",
    related_id: output.related_id || output.id,
    notes: output.output,
  });
}

export async function saveAiOutputAsContent({ accountId, brandId, output }) {
  return insertRecord("content_items", {
    account_id: accountId,
    brand_id: brandId,
    event_id: output.related_type === "event" ? output.related_id : null,
    title: output.title,
    platform: "Instagram",
    content_type: output.output_type === "growth" ? "post" : "email",
    status: "drafted",
    caption: output.output,
    image_prompt: output.output_type === "growth" ? output.output : null,
    notes: `Created from AI output ${output.id}`,
  });
}

export async function saveAiOutputAsCommunication({ accountId, brandId, output }) {
  return insertRecord("communications", {
    account_id: accountId,
    brand_id: brandId,
    event_id: output.related_type === "event" ? output.related_id : null,
    channel: "email",
    direction: "outbound",
    subject: output.title,
    body: output.output,
    follow_up_at: daysFromNow(3),
  });
}

export function calculateEventReadiness(event, tasks = [], content = [], communications = []) {
  if (!event) return 0;
  const checks = [
    Boolean(event.starts_at),
    Boolean(event.venue_organization_id),
    Boolean(event.capacity),
    Boolean(event.target_attendance),
    Boolean(event.public_url || event.description),
    tasks.some((task) => task.related_id === event.id && task.status === "done"),
    content.some((item) => item.event_id === event.id),
    communications.some((item) => item.event_id === event.id),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function eventReadinessDetails(event, tasks = [], content = [], communications = []) {
  if (!event) return [];
  const relatedTasks = tasks.filter((task) => task.related_id === event.id);
  return [
    { key: "date", label: "Date/time set", done: Boolean(event.starts_at), fix: "Schedule the event date and time." },
    { key: "venue", label: "Venue connected", done: Boolean(event.venue_organization_id), fix: "Select or confirm a venue organization." },
    { key: "capacity", label: "Capacity set", done: Boolean(event.capacity), fix: "Add the room or event capacity." },
    { key: "target", label: "Attendance target set", done: Boolean(event.target_attendance), fix: "Set a target attendance number." },
    { key: "rsvp", label: "RSVP/details ready", done: Boolean(event.public_url || event.description), fix: "Add RSVP URL or a useful event description." },
    { key: "tasks", label: "Prep tasks completed", done: relatedTasks.some((task) => task.status === "done"), fix: "Generate and complete at least one event prep task." },
    { key: "content", label: "Content attached", done: content.some((item) => item.event_id === event.id), fix: "Create a content item for this event." },
    { key: "communication", label: "Communication logged", done: communications.some((item) => item.event_id === event.id), fix: "Log at least one venue, sponsor, or internal planning note." },
  ];
}

export function getSmartRecommendations(workspace) {
  const today = new Date();
  const openTasks = workspace.tasks?.filter((task) => !["done", "cancelled"].includes(task.status)) || [];
  const upcomingEvent = (workspace.events || []).find((event) => event.status !== "completed" && event.status !== "cancelled");
  const readiness = calculateEventReadiness(upcomingEvent, workspace.tasks, workspace.content, workspace.communications);
  const recs = [];

  const overdue = openTasks.filter((task) => task.due_at && new Date(task.due_at) < today);
  if (overdue.length) {
    recs.push({
      id: "overdue-tasks",
      priority: "urgent",
      title: `Clear ${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}`,
      reason: "Overdue work creates hidden event risk.",
    });
  }

  if (upcomingEvent && readiness < 80) {
    recs.push({
      id: "event-readiness",
      priority: "high",
      title: `Raise ${upcomingEvent.name} readiness above 80%`,
      reason: `Current readiness is ${readiness}%. Focus on missing logistics before more promotion.`,
    });
  }

  const orgFollowUps = (workspace.organizations || []).filter((org) => org.next_follow_up_at);
  if (orgFollowUps.length) {
    recs.push({
      id: "org-followups",
      priority: "high",
      title: `Follow up with ${orgFollowUps.length} venue/sponsor lead${orgFollowUps.length === 1 ? "" : "s"}`,
      reason: "Local relationships are the growth engine for the brand.",
    });
  }

  const scheduledContent = (workspace.content || []).filter((item) => ["scheduled", "posted"].includes(item.status));
  if (scheduledContent.length < 2) {
    recs.push({
      id: "content-gap",
      priority: "medium",
      title: "Create two pieces of content for this week",
      reason: "The brand needs visible proof of life while events are being planned.",
    });
  }

  const sponsorPipeline = (workspace.organizations || []).filter((org) => org.org_type === "sponsor");
  if (sponsorPipeline.length < 5) {
    recs.push({
      id: "sponsor-pipeline",
      priority: "medium",
      title: "Add more sponsor targets",
      reason: "The Valentine event needs a broader local partner pipeline.",
    });
  }

  return recs.slice(0, 6);
}

export function buildBriefingContext(workspace) {
  const openTasks = workspace.tasks?.filter((task) => !["done", "cancelled"].includes(task.status)) || [];
  const upcomingEvents = workspace.events?.filter((event) => event.status !== "completed") || [];
  const followUps = [
    ...(workspace.people || []).filter((item) => item.next_follow_up_at),
    ...(workspace.organizations || []).filter((item) => item.next_follow_up_at),
    ...(workspace.opportunities || []).filter((item) => item.next_follow_up_at),
  ];
  return {
    openTasks: openTasks.slice(0, 12),
    upcomingEvents: upcomingEvents.slice(0, 6),
    followUps: followUps.slice(0, 12),
    contentPipeline: workspace.content?.slice(0, 10) || [],
    revenue: workspace.revenue || [],
  };
}

function eventPlanTasks(event) {
  return [
    {
      title: `Confirm venue logistics for ${event.name}`,
      priority: "urgent",
      daysBefore: 21,
      notes: "Confirm room, capacity, arrival time, pricing, food/drink, parking, and point of contact.",
    },
    {
      title: `Publish RSVP details for ${event.name}`,
      priority: "high",
      daysBefore: 18,
      notes: "Add RSVP link, date/time, location, who it is for, and the low-pressure promise.",
    },
    {
      title: `Create promo content for ${event.name}`,
      priority: "high",
      daysBefore: 14,
      notes: "Create announcement, reminder, and day-before content.",
    },
    {
      title: `Send sponsor/partner outreach for ${event.name}`,
      priority: "medium",
      daysBefore: 12,
      notes: "Pitch a simple in-kind or small cash sponsorship tied to the event audience.",
    },
    {
      title: `Prepare supplies for ${event.name}`,
      priority: "medium",
      daysBefore: 5,
      notes: "Name tags, cards, pens, signage, QR code, check-in list, and backup phone charger.",
    },
    {
      title: `Send day-before reminder for ${event.name}`,
      priority: "high",
      daysBefore: 1,
      notes: "Confirm time, location, parking, arrival note, and tone expectations.",
    },
    {
      title: `Send post-event thank-you for ${event.name}`,
      priority: "medium",
      daysBefore: -1,
      notes: "Thank attendees, ask for feedback, and invite them to the next event/waitlist.",
    },
  ];
}

function daysBefore(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next.toISOString();
}

function daysFromNow(days) {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function nextDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function nextDateOnly(days) {
  return nextDate(days).slice(0, 10);
}
