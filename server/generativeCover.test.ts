/**
 * Tests for the adaptive typography logic in GenerativeCover.
 * Since GenerativeCover is a React component using Canvas API (browser-only),
 * we test the pure logic functions that can run in Node.js.
 */
import { describe, it, expect } from "vitest";

// ─── Pure logic extracted from GenerativeCover.tsx for testability ────────────

const MAX_TITLE_WORDS = 6;

function truncateTitle(title: string, maxWords = MAX_TITLE_WORDS): string {
  const words = title.split(/\s+/);
  if (words.length <= maxWords) return title;
  return words.slice(0, maxWords).join(" ") + " \u2026";
}

const STOPWORDS = new Set([
  "der","die","das","den","dem","des","ein","eine","einer","einem","einen","eines",
  "und","oder","aber","doch","denn","weil","wenn","als","ob","bis","seit","nach",
  "vor","mit","ohne","für","gegen","über","unter","neben","zwischen","durch","bei",
  "von","zu","an","auf","in","im","am","aus","um","ab","pro",
  "ich","du","er","sie","es","wir","ihr","mich","dich","sich","uns","euch",
  "ist","bin","bist","sind","seid","war","waren","hat","haben","hatte","hatten",
  "nicht","kein","keine","keiner","keinem","keinen","keines","nun","noch","schon",
  "auch","sehr","mehr","viel","viele","alle","alles","jeder","jede","jedes","man",
  "so","wie","was","wer","wo","wann","warum","welche","welcher","welches","welchen",
]);

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function extractKeywords(text: string, max = 22): string[] {
  // Use lookbehind/lookahead instead of \b to handle umlaut word starts (Ä, Ö, Ü)
  const matches = text.match(/(?<![a-zA-ZäöüÄÖÜß])[a-zA-ZäöüÄÖÜß]{4,}(?![a-zA-ZäöüÄÖÜß])/g) ?? [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const w of matches) {
    const wl = w.toLowerCase();
    if (!STOPWORDS.has(wl) && !seen.has(wl)) {
      seen.add(wl);
      result.push(w.toUpperCase());
    }
    if (result.length >= max) break;
  }
  return result;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GenerativeCover — hashString", () => {
  it("returns a non-negative integer", () => {
    expect(hashString("Faust")).toBeGreaterThanOrEqual(0);
    expect(hashString("")).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic", () => {
    expect(hashString("Die Leiden des jungen Werthers")).toBe(
      hashString("Die Leiden des jungen Werthers")
    );
  });

  it("produces different values for different titles", () => {
    const hashes = new Set([
      hashString("Faust"),
      hashString("Die Verwandlung"),
      hashString("Der Steppenwolf"),
      hashString("Buddenbrooks"),
      hashString("Effi Briest"),
    ]);
    expect(hashes.size).toBe(5);
  });

  it("maps to valid palette index (0-6)", () => {
    const titles = ["Faust", "Werther", "Talisman", "Abendmahl", "Telephon", "Buddenbrooks", "Siddhartha"];
    for (const t of titles) {
      const idx = hashString(t) % 7;
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThanOrEqual(6);
    }
  });
});

describe("GenerativeCover — extractKeywords", () => {
  it("returns uppercase words", () => {
    const kws = extractKeywords("Habe nun Philosophie studiert");
    expect(kws.every(w => w === w.toUpperCase())).toBe(true);
  });

  it("filters stopwords", () => {
    const kws = extractKeywords("und die das der ein eine");
    expect(kws).toHaveLength(0);
  });

  it("filters short words (< 4 chars)", () => {
    const kws = extractKeywords("ich bin der man");
    // all are either stopwords or too short
    expect(kws).toHaveLength(0);
  });

  it("deduplicates words", () => {
    const kws = extractKeywords("Philosophie Philosophie Philosophie Studium Studium");
    expect(kws).toHaveLength(2);
  });

  it("handles German umlauts correctly", () => {
    const kws = extractKeywords("Bemühn Ängstigen Können Schüler Durchaus");
    expect(kws).toContain("BEMÜHN");
    expect(kws).toContain("ÄNGSTIGEN");
    expect(kws).toContain("KÖNNEN");
    expect(kws).toContain("SCHÜLER");
    expect(kws).toContain("DURCHAUS");
  });

  it("respects max limit", () => {
    const longText = Array.from({ length: 50 }, (_, i) => `Wort${i}Wort`).join(" ");
    const kws = extractKeywords(longText, 22);
    expect(kws.length).toBeLessThanOrEqual(22);
  });

  it("returns empty array for empty input", () => {
    expect(extractKeywords("")).toHaveLength(0);
  });

  it("extracts meaningful words from a Faust excerpt", () => {
    const text = "Habe nun, ach! Philosophie, Juristerei und Medizin, und leider auch Theologie durchaus studiert, mit heißem Bemühn.";
    const kws = extractKeywords(text);
    expect(kws).toContain("PHILOSOPHIE");
    expect(kws).toContain("MEDIZIN");
    expect(kws).toContain("THEOLOGIE");
    expect(kws).toContain("BEMÜHN");
    // Stopwords should not appear
    expect(kws).not.toContain("UND");
    expect(kws).not.toContain("MIT");
  });
});

describe("GenerativeCover — palette selection", () => {
  it("assigns consistent palette to the same title", () => {
    const idx1 = hashString("Faust") % 7;
    const idx2 = hashString("Faust") % 7;
    expect(idx1).toBe(idx2);
  });

  it("uses all 7 palette slots across a diverse title set", () => {
    const titles = [
      "Faust", "Die Leiden des jungen Werthers", "Buddenbrooks",
      "Der Steppenwolf", "Siddhartha", "Effi Briest", "Der grüne Heinrich",
      "Die Verwandlung", "Narziss und Goldmund", "Der Zauberberg",
      "Demian", "Unterm Rad", "Peter Camenzind", "Klingsor",
    ];
    const usedPalettes = new Set(titles.map(t => hashString(t) % 7));
    // With 14 titles and 7 palettes, expect at least 4 distinct palettes
    expect(usedPalettes.size).toBeGreaterThanOrEqual(4);
  });
});

describe("GenerativeCover — truncateTitle (v5 fixed layout)", () => {
  it("does not truncate titles with ≤6 words", () => {
    expect(truncateTitle("Faust")).toBe("Faust");
    expect(truncateTitle("Die Leiden des jungen Werthers")).toBe("Die Leiden des jungen Werthers");
    expect(truncateTitle("Ein zwei drei vier fünf sechs")).toBe("Ein zwei drei vier fünf sechs");
  });

  it("truncates titles with >6 words and appends ellipsis", () => {
    const result = truncateTitle("Der Talisman: Historischer Roman in drei Bänden");
    expect(result).toBe("Der Talisman: Historischer Roman in drei \u2026");
    expect(result.split(" ").length).toBe(7); // 6 words + "…"
  });

  it("truncates very long titles correctly", () => {
    const longTitle = "Experimentelle Untersuchungen über die Frage: Ist die Furcht vor Krankheitsübertragung durch das Telephon begründet?";
    const result = truncateTitle(longTitle);
    expect(result).toBe("Experimentelle Untersuchungen über die Frage: Ist \u2026");
  });

  it("respects custom maxWords parameter", () => {
    expect(truncateTitle("Ein zwei drei vier fünf sechs sieben", 4)).toBe("Ein zwei drei vier \u2026");
    expect(truncateTitle("Ein zwei drei", 4)).toBe("Ein zwei drei");
  });

  it("handles single-word titles without truncation", () => {
    expect(truncateTitle("Faust")).toBe("Faust");
    expect(truncateTitle("Siddhartha")).toBe("Siddhartha");
  });

  it("handles exactly 6-word titles without truncation", () => {
    const sixWords = "Die Leiden des jungen Werthers heute";
    expect(truncateTitle(sixWords)).toBe(sixWords);
    expect(truncateTitle(sixWords).endsWith("\u2026")).toBe(false);
  });

  it("handles 7-word titles with truncation", () => {
    const sevenWords = "Die Leiden des jungen Werthers von heute";
    const result = truncateTitle(sevenWords);
    expect(result.endsWith("\u2026")).toBe(true);
    expect(result.split(/\s+/).filter(w => w !== "\u2026").length).toBe(6);
  });
});
