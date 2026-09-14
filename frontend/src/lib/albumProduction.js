/*
 * P3.5 Album Production Workflow — pure helpers.
 *
 * Lifecycle per slot: prompt_ready -> generated -> imported -> accepted.
 * generated  = the Suno song was made (manual workflow; a Suno link can be kept).
 * imported   = a finished library track is attached (has audio in the library).
 * accepted   = the artist accepts this take for the album slot.
 *
 * Compare is target-vs-actual and NEVER blocks: when the attached track has
 * library analysis we surface a verdict; when it has none we say analysis is
 * pending. Replaces/regenerates are just status resets run through the same
 * state shape.
 */

export const PRODUCTION_STATUSES = ["prompt_ready", "generated", "imported", "accepted"];

export const PRODUCTION_STATUS_LABELS = {
  prompt_ready: "Prompt ready",
  generated: "Generated in Suno",
  imported: "Track attached",
  accepted: "Accepted",
};

export function emptyProduction(slotCount) {
  const slots = {};
  for (let i = 0; i < slotCount; i += 1) slots[i] = { status: "prompt_ready" };
  return { status: "draft", slots };
}

export function normalizeProduction(production, slotCount) {
  const base = emptyProduction(slotCount).slots;
  const raw = production && typeof production === "object" ? production : {};
  const rawSlots = raw.slots && typeof raw.slots === "object" ? raw.slots : {};
  const slots = {};
  for (let i = 0; i < slotCount; i += 1) {
    const entry = rawSlots[i] && typeof rawSlots[i] === "object" ? rawSlots[i] : {};
    slots[i] = {
      status: PRODUCTION_STATUSES.includes(entry.status) ? entry.status : "prompt_ready",
      suno_url: typeof entry.suno_url === "string" ? entry.suno_url : "",
      library_track_id: typeof entry.library_track_id === "string" ? entry.library_track_id : "",
      note: typeof entry.note === "string" ? entry.note : "",
      ...(base[i] ? {} : {}),
    };
  }
  return {
    status: raw.status === "finished" ? "finished" : "draft",
    slots,
  };
}

export function productionSummary(production, slotCount) {
  const p = normalizeProduction(production, slotCount);
  const counts = { prompt_ready: 0, generated: 0, imported: 0, accepted: 0 };
  PRODUCTION_STATUSES.forEach((s) => {
    counts[s] = 0;
  });
  Object.values(p.slots).forEach((entry) => {
    counts[entry.status] = (counts[entry.status] || 0) + 1;
  });
  const done = counts.accepted;
  return { ...counts, done, total: slotCount, allAccepted: slotCount > 0 && done === slotCount };
}

export function nextTransition(slot) {
  const idx = PRODUCTION_STATUSES.indexOf(slot);
  if (idx < 0 || idx >= PRODUCTION_STATUSES.length - 1) return null;
  return { from: PRODUCTION_STATUSES[idx], to: PRODUCTION_STATUSES[idx + 1] };
}

export function setSlotStatus(production, slotIndex, status, extra = {}) {
  const existing = production?.slots && typeof production.slots === "object" ? Object.keys(production.slots).length : 0;
  const count = Math.max(existing, slotIndex + 1);
  const next = normalizeProduction(production, count);
  next.slots[slotIndex] = { ...next.slots[slotIndex], status, ...extra };
  return next;
}

export function targetProfileForSlot(slot) {
  return {
    bpm: Number(slot?.bpm) || null,
    role: slot?.role || null,
  };
}

export function compareTargetActual(slot, libraryTrack) {
  if (!libraryTrack) return { available: false, meaning: "not_attached" };
  const targetBpm = Number(slot?.bpm);
  const details = [];
  let verdict = "pending";

  const bpmRaw = libraryTrack.bpm;
  if (bpmRaw !== null && bpmRaw !== undefined && Number.isFinite(Number(bpmRaw))) {
    const actualBpm = Number(bpmRaw);
    const onTarget = Number.isFinite(targetBpm) && targetBpm > 0 ? Math.abs(targetBpm - actualBpm) <= 6 : true;
    const delta = onTarget && Number.isFinite(targetBpm) && targetBpm > 0 ? Math.abs(targetBpm - actualBpm) : null;
    details.push({ metric: "bpm", target: targetBpm || null, actual: actualBpm, delta, ok: onTarget });
  }

  const energyRaw = libraryTrack.energy;
  if (energyRaw !== null && energyRaw !== undefined && Number.isFinite(Number(energyRaw))) {
    const energy = Number(energyRaw);
    details.push({ metric: "energy", target: null, actual: Number(energy.toFixed(2)), delta: null, ok: true });
  }

  if (Number(libraryTrack.duration_seconds)) {
    details.push({
      metric: "duration_s",
      target: null,
      actual: Number(libraryTrack.duration_seconds),
      delta: null,
      ok: true,
    });
  }

  if (details.length === 0) {
    return { available: false, meaning: "no_analysis" };
  }
  verdict = details.every((d) => d.ok) ? "on_target" : "differs";
  return { available: true, meaning: "analyzed", verdict, details };
}

export function buildProductionManifest(blueprint, production, libraryById = {}, resolvedFrom = {}) {
  const slots = blueprint?.slots || [];
  const p = normalizeProduction(production, slots.length);
  return slots.map((slot, i) => {
    const entry = p.slots[i] || { status: "prompt_ready" };
    const track = entry.library_track_id ? libraryById[entry.library_track_id] || null : null;
    return {
      slot: i + 1,
      title: slot.title,
      role: slot.role,
      target_bpm: Number(slot.bpm) || null,
      target_prompt: slot.prompt,
      status: entry.status,
      suno_url: entry.suno_url || "",
      library_track_id: entry.library_track_id || "",
      library_title: track ? track.display_title : "",
      source_url: track ? track.source_url || track.original_filepath || "" : "",
      compare: compareTargetActual(slot, track),
      resolved_from: resolvedFrom[entry.library_track_id] || "",
    };
  });
}