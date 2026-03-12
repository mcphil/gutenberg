import { describe, it, expect } from "vitest";
import { generateFallbackCoverSvg } from "./fallbackCover";

describe("generateFallbackCoverSvg", () => {
  it("returns a valid SVG string", () => {
    const svg = generateFallbackCoverSvg("Die Verwandlung", "Franz Kafka");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("includes the book title in the SVG", () => {
    const svg = generateFallbackCoverSvg("Faust", "Johann Wolfgang von Goethe");
    expect(svg).toContain("Faust");
  });

  it("includes the author name in the SVG", () => {
    const svg = generateFallbackCoverSvg("Faust", "Johann Wolfgang von Goethe");
    // Long names are wrapped across tspan elements, so check for a substring
    // that is guaranteed to appear in at least one line (first 24 chars)
    expect(svg).toContain("Johann Wolfgang von");
  });

  it("escapes XML special characters in title", () => {
    const svg = generateFallbackCoverSvg("Über & Unter <Wasser>", "Test Autor");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&lt;");
    expect(svg).toContain("&gt;");
    expect(svg).not.toContain(" & ");
    expect(svg).not.toContain("<Wasser>");
  });

  it("escapes XML special characters in author", () => {
    const svg = generateFallbackCoverSvg("Ein Buch", "Autor & Co.");
    expect(svg).toContain("&amp;");
  });

  it("wraps long titles into multiple lines", () => {
    const longTitle = "Eine sehr lange Geschichte über das Leben und Sterben in der modernen Welt";
    const svg = generateFallbackCoverSvg(longTitle, "Max Mustermann");
    // Should have multiple tspan elements for the wrapped title
    const tspanCount = (svg.match(/<tspan/g) ?? []).length;
    expect(tspanCount).toBeGreaterThan(1);
  });

  it("always produces the same SVG for the same inputs (deterministic)", () => {
    const svg1 = generateFallbackCoverSvg("Der Steppenwolf", "Hermann Hesse");
    const svg2 = generateFallbackCoverSvg("Der Steppenwolf", "Hermann Hesse");
    expect(svg1).toBe(svg2);
  });

  it("produces different colours for different titles (palette variety)", () => {
    // Generate SVGs for many titles and check that not all use the same background
    const titles = [
      "Faust", "Die Verwandlung", "Der Steppenwolf", "Buddenbrooks",
      "Der Zauberberg", "Effi Briest", "Der grüne Heinrich", "Siddhartha",
    ];
    const backgrounds = new Set(
      titles.map((t) => {
        const svg = generateFallbackCoverSvg(t, "Autor");
        // Extract the first rect fill colour
        const match = svg.match(/fill="(#[0-9A-Fa-f]{6})"/);
        return match?.[1] ?? "";
      })
    );
    // With 8 titles and 8 palette entries we expect at least 3 distinct colours
    expect(backgrounds.size).toBeGreaterThanOrEqual(3);
  });

  it("handles empty author gracefully", () => {
    const svg = generateFallbackCoverSvg("Unbekanntes Werk", "");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("includes GUTENBERG NAVIGATOR label", () => {
    const svg = generateFallbackCoverSvg("Ein Buch", "Ein Autor");
    expect(svg).toContain("GUTENBERG NAVIGATOR");
  });

  it("has correct viewBox dimensions (400x600 book proportions)", () => {
    const svg = generateFallbackCoverSvg("Test", "Autor");
    expect(svg).toContain('viewBox="0 0 400 600"');
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="600"');
  });
});
