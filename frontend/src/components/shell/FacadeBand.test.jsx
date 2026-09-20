import { renderToStaticMarkup } from "react-dom/server";
import FacadeBand, { InsertCoinButton } from "@/components/shell/FacadeBand";

describe("FacadeBand (8D home facade)", () => {
  it("renders the dissolving marquee facade band", () => {
    const markup = renderToStaticMarkup(<FacadeBand items={["ALPHA", "BETA"]} />);
    expect(markup).toContain("ma-motive-marquee");
    expect(markup).toContain("ma-facade-dissolve");
    expect(markup).toContain("ALPHA");
  });

  it("renders the insert coin CTA safe for SSR", () => {
    const markup = renderToStaticMarkup(<InsertCoinButton />);
    expect(markup).toContain("INSERT COIN");
    expect(markup).toContain('href="/music"');
    expect(markup).toContain("ma-motive-press");
  });
});
