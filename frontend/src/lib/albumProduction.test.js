import {
  emptyProduction,
  normalizeProduction,
  productionSummary,
  nextTransition,
  setSlotStatus,
  compareTargetActual,
  buildProductionManifest,
} from "./albumProduction";

describe("albumProduction", () => {
  const bp = {
    bible: { album: { name: "N", genre: "techno" } },
    slots: [
      { index: 0, role: "opener", title: "Open", prompt: "p0", bpm: 100 },
      { index: 1, role: "climax", title: "Peak", prompt: "p1", bpm: 128 },
    ],
  };

  test("emptyProduction seeds every slot as prompt_ready", () => {
    const p = emptyProduction(3);
    expect(p.status).toBe("draft");
    expect(Object.keys(p.slots)).toHaveLength(3);
    Object.values(p.slots).forEach((entry) => expect(entry.status).toBe("prompt_ready"));
  });

  test("normalizeProduction coerces unknown states and keeps finished flag", () => {
    const raw = {
      status: "finished",
      slots: { 0: { status: "imported", library_track_id: "T1" }, 1: { status: "bogus" } },
    };
    const p = normalizeProduction(raw, 2);
    expect(p.status).toBe("finished");
    expect(p.slots[0].status).toBe("imported");
    expect(p.slots[1].status).toBe("prompt_ready");
  });

  test("productionSummary counts states and flags completion", () => {
    const p = setSlotStatus(emptyProduction(2), 0, "accepted");
    const p2 = setSlotStatus(p, 1, "accepted");
    const summary = productionSummary(p2, 2);
    expect(summary.accepted).toBe(2);
    expect(summary.allAccepted).toBe(true);
    expect(summary.done).toBe(2);
    expect(productionSummary(emptyProduction(2), 2).allAccepted).toBe(false);
  });

  test("nextTransition walks the lifecycle and stops at accepted", () => {
    expect(nextTransition("prompt_ready")).toEqual({ from: "prompt_ready", to: "generated" });
    expect(nextTransition("generated")).toEqual({ from: "generated", to: "imported" });
    expect(nextTransition("imported")).toEqual({ from: "imported", to: "accepted" });
    expect(nextTransition("accepted")).toBeNull();
  });

  test("setSlotStatus preserves existing attached data", () => {
    const p = setSlotStatus(emptyProduction(2), 0, "generated", { suno_url: "https://suno.com/song/x" });
    expect(p.slots[0].suno_url).toBe("https://suno.com/song/x");
    const imported = setSlotStatus(p, 0, "imported", { library_track_id: "T9" });
    expect(imported.slots[0].library_track_id).toBe("T9");
    expect(imported.slots[0].suno_url).toBe("https://suno.com/song/x");
  });

  test("compareTargetActual notes missing analysis instead of blocking", () => {
    expect(compareTargetActual(bp.slots[0], null).meaning).toBe("not_attached");
    const noAnalysis = compareTargetActual(bp.slots[0], { display_title: "x", bpm: null, energy: null });
    expect(noAnalysis.meaning).toBe("no_analysis");
    const withBpm = compareTargetActual(bp.slots[0], { display_title: "x", bpm: 102, energy: 0.6, duration_seconds: 90 });
    expect(withBpm.available).toBe(true);
    expect(withBpm.details[0].delta).toBe(2);
    expect(withBpm.verdict).toBe("on_target");
    const off = compareTargetActual(bp.slots[1], { display_title: "x", bpm: 118, energy: 0.6 });
    expect(off.verdict).toBe("differs");
  });

  test("buildProductionManifest maps slots to attach state and compare", () => {
    const library = { T1: { display_title: "Open Take", bpm: 102, energy: 0.6, duration_seconds: 90, source_url: "" } };
    let p = emptyProduction(2);
    p = setSlotStatus(p, 0, "imported", { library_track_id: "T1" });
    const manifest = buildProductionManifest(bp, p, library, { T1: "accepted take" });
    expect(manifest[0].library_title).toBe("Open Take");
    expect(manifest[0].compare.details[0].delta).toBe(2);
    expect(manifest[1].status).toBe("prompt_ready");
  });
});