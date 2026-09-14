import { ALBUM_ENGINE_VERSION } from "./albumEngine";

/*
 * P3 persistence shape.
 *
 * A project stores BOTH the small deterministic inputs (name, genre, theme,
 * trackCount, templateArchetype, albumNonce, wizardDna, slotEdits) AND the
 * resolved blueprint snapshot. Loading prefers the stored blueprint so that
 * resolved prompts stay byte-stable across engine upgrades; the engine-version
 * guard surfaces a banner instead of silently rerolling.
 */

export function serializeAlbum(blueprint, { name, genre, theme, trackCount, templateArchetype, albumNonce, wizardDna, slotEdits, approval, production }) {
  const inputs = {
    name,
    genre,
    theme,
    trackCount,
    templateArchetype,
    albumNonce,
    wizardDna: wizardDna || null,
    slotEdits: slotEdits || {},
  };
  return {
    name,
    engine_version: ALBUM_ENGINE_VERSION,
    inputs,
    blueprint,
    approval: approval || { plan: false, slots: {} },
    production: production || { status: "draft", slots: {} },
  };
}

export function deserializeAlbum(payload) {
  const warnings = [];
  if (!payload || typeof payload !== "object") {
    throw new Error("Saved album payload is not an object");
  }
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : "Untitled Album";
  if (name !== payload.name) warnings.push("Title had leading/trailing whitespace; trimmed on load");

  const inputs = payload.inputs && typeof payload.inputs === "object" ? payload.inputs : {};
  const blueprint = payload.blueprint && typeof payload.blueprint === "object" ? payload.blueprint : null;
  if (!blueprint) warnings.push("Snapshot has no blueprint; an album must be regenerated to re-open");
  if (blueprint && (!Array.isArray(blueprint.slots) || !blueprint.slots.length)) {
    warnings.push("Snapshot blueprint has no tracks; an album must be regenerated to re-open");
  }
  if (blueprint && Array.isArray(blueprint.slots) && Number.isFinite(Number(inputs.trackCount)) && blueprint.slots.length !== Number(inputs.trackCount)) {
    warnings.push(`Stored snapshot has ${blueprint.slots.length} tracks but inputs say ${inputs.trackCount}; trusting the snapshot`);
  }

  const savedEngine = typeof payload.engine_version === "string" ? payload.engine_version : null;
  const engineMatches = savedEngine === ALBUM_ENGINE_VERSION;
  if (!savedEngine) {
    warnings.push("Saved project has no engine version stamp");
  } else if (!engineMatches) {
    warnings.push(`Created with ${savedEngine}; this build is ${ALBUM_ENGINE_VERSION}. Prompts are kept exactly as stored — re-roll to upgrade.`);
  }

  const approval = payload.approval && typeof payload.approval === "object" ? payload.approval : { plan: false, slots: {} };
  const production = payload.production && typeof payload.production === "object" ? payload.production : { status: "draft", slots: {} };

  return {
    name,
    engine_version: savedEngine,
    engineMatches,
    inputs,
    blueprint,
    approval,
    production,
    warnings,
  };
}

export function toRestorePatch(project) {
  return {
    inputs: project.inputs,
    blueprint: project.blueprint,
    approval: project.approval,
    production: project.production,
  };
}

export default { serializeAlbum, deserializeAlbum, toRestorePatch };