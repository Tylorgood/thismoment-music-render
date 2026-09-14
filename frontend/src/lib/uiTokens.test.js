const fs = require("fs");
const path = require("path");

let css = "";
try {
  css = fs.readFileSync(path.resolve(__dirname, "..", "index.css"), "utf8");
} catch (error) {
  throw new Error(`Unable to read index.css for token contract test: ${error.message}`);
}

const REQUIRED_TOKENS = [
  "--ma-bg",
  "--ma-chrome",
  "--ma-surface-1",
  "--ma-surface-2",
  "--ma-surface-3",
  "--ma-inset",
  "--ma-fg",
  "--ma-fg-muted",
  "--ma-fg-faint",
  "--ma-line",
  "--ma-line-strong",
  "--ma-status-ok",
  "--ma-status-ok-soft",
  "--ma-status-warn",
  "--ma-status-warn-soft",
  "--ma-status-err",
  "--ma-status-err-soft",
  "--ma-status-info",
  "--ma-status-info-soft",
  "--ma-status-emotion",
  "--ma-status-emotion-alt",
  "--ma-status-emotion-soft",
  "--ma-accent",
  "--ma-accent-strong",
  "--ma-accent-soft",
  "--ma-ring",
  "--ma-radius-sm",
  "--ma-radius-md",
  "--ma-radius-lg",
  "--ma-radius-xl",
  "--ma-space-xs",
  "--ma-space-sm",
  "--ma-space-md",
  "--ma-space-lg",
  "--ma-space-xl",
  "--ma-space-2xl",
  "--ma-space-3xl",
  "--ma-font-sans",
  "--ma-font-display",
  "--ma-font-mono",
  "--ma-z-base",
  "--ma-z-raised",
  "--ma-z-sticky",
  "--ma-z-overlay",
  "--ma-z-palette",
  "--ma-z-toast",
  "--ma-motion-fast",
  "--ma-motion-base",
  "--ma-motion-slow",
  "--ma-ease",
  "--ma-glow-gold",
  "--ma-glow-emotion",
];

describe("Music Arcade token contract (index.css)", () => {
  it("declares every required --ma-* token", () => {
    const missing = REQUIRED_TOKENS.filter((token) => !css.includes(`${token}:`));
    expect(missing).toEqual([]);
  });

  it("declares a status color per semantic meaning", () => {
    const statuses = [
      "--ma-status-ok",
      "--ma-status-warn",
      "--ma-status-err",
      "--ma-status-info",
      "--ma-status-emotion",
    ];
    statuses.forEach((token) => {
      expect(css.includes(`${token}:`)).toBe(true);
    });
  });

  it("keeps radius sharp-friendly (sm is a hairline, not a pillow)", () => {
    expect(css.includes("--ma-radius-sm: 2px")).toBe(true);
  });

  it("does not duplicate :root token blocks", () => {
    const matches = css.match(/:root\s*{/g) || [];
    expect(matches.length).toBe(1);
  });
});