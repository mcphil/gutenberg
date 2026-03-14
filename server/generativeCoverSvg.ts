/**
 * Server-side Generative Cover SVG Generator
 *
 * Mirrors the client-side GenerativeCover.tsx Canvas logic, producing an
 * identical deterministic SVG for each (title, author, previewText) triple.
 *
 * Design spec (fixed layout — same proportions for every cover):
 *   560px total height at 400px width (7:5 aspect ratio)
 *   • White header:   140px (fixed — never changes)
 *   • Botanical area: 396px (71% of cover height)
 *   • Black bottom:    24px with "gutenberg-navigator.de"
 *   - Title: always 26pt, max 6 words → truncated with " …"
 *   - Title+author block vertically centered in the 140px header
 *   - 7 deterministic color palettes (hash of title)
 *   - Botanical L-system fern as background
 *   - UPPERCASE keyword cloud from preview text
 *
 * SVG uses system-safe font stacks (Georgia/Arial) since server has no
 * Noto Serif installed. The WebP rasterization via sharp uses these fallbacks.
 */

// ─── Dimensions ────────────────────────────────────────────────────────────────
const W = 400;
const H = 560;

const LAYOUT = {
  REF_W: 400,
  REF_H: 560,
  COLOR_BAR_H: 6,    // thin colored stripe at top of header
  HEADER_H: 140,     // white header block (fixed)
  BOTTOM_BAR_H: 24,  // black bottom bar
  TITLE_FONT_PX: 26,
  TITLE_LINE_H: 32,
  AUTHOR_FONT_PX: 14,
  AUTHOR_H: 20,
  TITLE_AUTHOR_GAP: 11,
  PADDING: 14,
  MAX_TITLE_WORDS: 6,
};

// ─── Color palettes ────────────────────────────────────────────────────────────
// [bg_top_rgb, bg_bottom_rgb, branch_young_rgb, branch_old_rgb]
const PALETTES: [string, string, string, string][] = [
  ["rgb(12,35,60)",   "rgb(22,60,100)",  "rgb(100,175,235)", "rgb(195,235,255)"],
  ["rgb(50,18,6)",    "rgb(90,38,12)",   "rgb(230,140,55)",  "rgb(255,215,140)"],
  ["rgb(14,45,22)",   "rgb(26,78,38)",   "rgb(85,210,110)",  "rgb(195,255,175)"],
  ["rgb(48,12,48)",   "rgb(85,22,85)",   "rgb(205,105,230)", "rgb(245,195,255)"],
  ["rgb(52,38,6)",    "rgb(95,70,12)",   "rgb(225,195,65)",  "rgb(255,245,165)"],
  ["rgb(6,44,48)",    "rgb(12,80,85)",   "rgb(65,205,215)",  "rgb(165,255,255)"],
  ["rgb(48,6,22)",    "rgb(88,12,42)",   "rgb(235,85,135)",  "rgb(255,195,215)"],
];

// ─── German stopwords ──────────────────────────────────────────────────────────
const STOPWORDS = new Set([
  "der","die","das","den","dem","des","ein","eine","einer","einem","einen","eines",
  "und","oder","aber","doch","denn","weil","wenn","als","ob","bis","seit","nach",
  "vor","mit","ohne","für","gegen","über","unter","neben","zwischen","durch","bei",
  "von","zu","an","auf","in","im","am","aus","um","ab","pro",
  "ich","du","er","sie","es","wir","ihr","mich","dich","sich","uns","euch",
  "mein","dein","sein","ihr","unser","euer","mir","dir","ihm","ihnen",
  "ist","bin","bist","sind","seid","war","waren","hat","haben","hatte","hatten",
  "wird","werden","wurde","wurden","worden","gewesen",
  "kann","könnte","muss","müssen","soll","sollen","will","wollen","darf","dürfen",
  "mag","möchte","lassen","macht","gibt","geht","kommt","steht",
  "nicht","kein","keine","keiner","keinem","keinen","keines","nun","noch","schon",
  "auch","sehr","mehr","viel","viele","alle","alles","jeder","jede","jedes","man",
  "so","wie","was","wer","wo","wann","warum","welche","welcher","welches","welchen",
  "da","hier","dort","dann","jetzt","immer","nie","oft","mal","ja","nein","ach",
  "nur","eben","halt","wohl","zwar","dabei","damit","daran","darauf",
  "daher","darum","davon","dazu","deshalb","deswegen","trotzdem","jedoch",
  "außerdem","allerdings","nämlich","sondern","sowie","sowohl","entweder","weder",
  "zum","zur","beim","ins","ans","aufs","vom","ums","fürs","hinter","hinterm",
  "dieser","diese","dieses","diesem","diesen","jener","jene","jenes","jenem","jenen",
  "selbst","solch","solche","solcher","solchem","solchen","solches","manche","mancher",
  "ihn","deren","dessen","denen","worauf","worüber","worum","worin","womit",
  "haben","sein","werden","tun","gehen","kommen","sehen","wissen","denken","glauben",
  "sagen","fragen","stehen","liegen","legen","setzen","stellen","bringen",
  "nehmen","geben","halten","heißen","bleiben","scheinen","beginnen","enden",
  "habe","hast","habt","ward","wart","doch","zwar","gar","dass","daß",
  "herauf","herab","quer","krumm","schier","meine","meiner","meinen","meinem",
  "seine","seiner","seinen","seinem","sehe","stehe","steh","armer","arme","armen",
]);

// ─── Helpers ───────────────────────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseRgb(s: string): [number, number, number] {
  const m = s.match(/(\d+),\s*(\d+),\s*(\d+)/);
  return m ? [+m[1]!, +m[2]!, +m[3]!] : [0, 0, 0];
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Truncate title to at most maxWords words, append " …" if cut. */
function truncateTitle(title: string, maxWords = LAYOUT.MAX_TITLE_WORDS): string {
  const words = title.split(/\s+/);
  if (words.length <= maxWords) return title;
  return words.slice(0, maxWords).join(" ") + " \u2026";
}

/**
 * Approximate word-wrap using character-width estimation.
 * SVG has no measureText, so we use avg char width ≈ fontSize * 0.55 for serif.
 */
function wordWrapSvg(text: string, maxW: number, fontSize: number): string[] {
  const charW = fontSize * 0.55; // approximate avg char width for serif bold
  const maxChars = Math.floor(maxW / charW);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (test.length > maxChars && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function extractKeywords(text: string, max = 22): string[] {
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

// ─── L-System ─────────────────────────────────────────────────────────────────

function lsystemExpand(axiom: string, rules: Record<string, string>, iterations: number): string {
  let s = axiom;
  for (let i = 0; i < iterations; i++) {
    s = s.split("").map(c => rules[c] ?? c).join("");
  }
  return s;
}

interface Segment { x0: number; y0: number; x1: number; y1: number; depth: number; }

function lsystemSegments(
  lStr: string,
  startAngleDeg: number,
  angleDeg: number,
  step: number
): { segments: Segment[]; maxDepth: number } {
  const toRad = (d: number) => (d * Math.PI) / 180;
  let x = 0, y = 0, angle = startAngleDeg;
  const stack: { x: number; y: number; angle: number; depth: number }[] = [];
  let depth = 0;
  const segments: Segment[] = [];
  let maxDepth = 0;

  for (const c of lStr) {
    if (c === "F") {
      const nx = x + Math.cos(toRad(angle)) * step;
      const ny = y + Math.sin(toRad(angle)) * step;
      segments.push({ x0: x, y0: y, x1: nx, y1: ny, depth });
      if (depth > maxDepth) maxDepth = depth;
      x = nx; y = ny;
    } else if (c === "+") {
      angle += angleDeg;
    } else if (c === "-") {
      angle -= angleDeg;
    } else if (c === "[") {
      stack.push({ x, y, angle, depth });
      depth++;
    } else if (c === "]") {
      const top = stack.pop();
      if (top) { x = top.x; y = top.y; angle = top.angle; depth = top.depth; }
    }
  }
  return { segments, maxDepth };
}

// ─── Gradient helper ───────────────────────────────────────────────────────────

function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + t * (b[0] - a[0]));
  const g = Math.round(a[1] + t * (b[1] - a[1]));
  const bv = Math.round(a[2] + t * (b[2] - a[2]));
  return `rgb(${r},${g},${bv})`;
}

// ─── Main SVG generator ────────────────────────────────────────────────────────

export function generateGenerativeCoverSvg(
  title: string,
  author: string,
  previewText: string
): string {
  const seed = hashString(title || "?");
  const paletteIdx = seed % PALETTES.length;
  const palette = PALETTES[paletteIdx]!;
  const rng = makeRng(seed);

  const bgTop    = parseRgb(palette[0]);
  const bgBottom = parseRgb(palette[1]);
  const brYoung  = parseRgb(palette[2]);
  const brOld    = parseRgb(palette[3]);

  const HEADER_H     = LAYOUT.HEADER_H;
  const BOTTOM_BAR_H = LAYOUT.BOTTOM_BAR_H;
  const COLOR_BAR_H  = LAYOUT.COLOR_BAR_H;
  const VIS_H        = H - HEADER_H - BOTTOM_BAR_H;
  const PADDING      = LAYOUT.PADDING;
  const MAX_TEXT_W   = W - PADDING * 2;

  // ── Title layout ──
  const displayTitle = truncateTitle(title, LAYOUT.MAX_TITLE_WORDS);
  const titleLines = wordWrapSvg(displayTitle, MAX_TEXT_W, LAYOUT.TITLE_FONT_PX);
  const titleBlockH = titleLines.length * LAYOUT.TITLE_LINE_H;
  const textBlockH  = titleBlockH + LAYOUT.TITLE_AUTHOR_GAP + LAYOUT.AUTHOR_H;
  const availH      = HEADER_H - COLOR_BAR_H;
  const titleStartY = COLOR_BAR_H + Math.max(PADDING, Math.round((availH - textBlockH) / 2));

  // ── L-System fern ──
  const axiom = "X";
  const rules: Record<string, string> = { X: "F+[[X]-X]-F[-FX]+X", F: "FF" };
  const angleDeg  = 22 + (seed % 10);
  const startAngle = 75 + (seed % 30);
  const step       = 3.2 + (seed % 3) * 0.3;
  const lStr = lsystemExpand(axiom, rules, 5);
  const { segments, maxDepth } = lsystemSegments(lStr, startAngle, angleDeg, step);

  const allX = segments.flatMap(s => [s.x0, s.x1]);
  const allY = segments.flatMap(s => [s.y0, s.y1]);
  const minX = Math.min(...allX), maxX = Math.max(...allX);
  const minY = Math.min(...allY), maxY = Math.max(...allY);
  const scaleXf = (W - 20) / Math.max(maxX - minX, 1);
  const scaleYf = (VIS_H - 20) / Math.max(maxY - minY, 1);
  const scale   = Math.min(scaleXf, scaleYf) * 0.82;
  const renderedW = (maxX - minX) * scale;
  const offsetX   = (W - renderedW) / 2 - minX * scale;

  const transform = (px: number, py: number): [number, number] => {
    const tx = px * scale + offsetX;
    const ty = VIS_H - ((py - minY) * scale + 10);
    return [Math.round(tx), Math.round(ty + HEADER_H)];
  };

  // ── Keywords ──
  const keywords = extractKeywords(previewText, 22);

  // ── Build SVG parts ──
  const parts: string[] = [];

  // Background gradient (simulated with horizontal strips every 4px)
  for (let py = HEADER_H; py < H - BOTTOM_BAR_H; py += 4) {
    const t = (py - HEADER_H) / Math.max(VIS_H - 1, 1);
    parts.push(`<rect x="0" y="${py}" width="${W}" height="4" fill="${lerpRgb(bgTop, bgBottom, t)}"/>`);
  }

  // Fern branches
  for (const seg of segments) {
    const [x0, y0] = transform(seg.x0, seg.y0);
    const [x1, y1] = transform(seg.x1, seg.y1);
    if (y0 < HEADER_H && y1 < HEADER_H) continue;
    if (y0 > H - BOTTOM_BAR_H && y1 > H - BOTTOM_BAR_H) continue;
    const t = seg.depth / Math.max(maxDepth, 1);
    const color = lerpRgb(brYoung, brOld, t);
    const lineW = Math.max(1, Math.round((2.5 - t * 1.8) * 10) / 10);
    parts.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${color}" stroke-width="${lineW}"/>`);
  }

  // Keywords — placed with a simple deterministic grid-jitter approach
  // (no measureText on server, so we use char-width approximation)
  const placed: [number, number, number, number][] = [];
  const overlaps = (x: number, y: number, tw: number, th: number) => {
    for (const [rx, ry, rw, rh] of placed) {
      if (!(x + tw < rx - 8 || x > rx + rw + 8 || y + th < ry - 6 || y > ry + rh + 6)) {
        return true;
      }
    }
    return false;
  };

  for (const word of keywords) {
    const fontSize = Math.round(11 + rng() * 11); // 11–22px
    const charW    = fontSize * 0.62; // approximate bold sans-serif char width
    const tw = Math.ceil(word.length * charW);
    const th = fontSize;
    let placed_ = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      const wx = Math.round(8 + rng() * Math.max(1, W - tw - 16));
      const wy = Math.round(HEADER_H + 8 + rng() * Math.max(1, H - BOTTOM_BAR_H - HEADER_H - th - 14));
      if (!overlaps(wx, wy, tw, th)) {
        placed.push([wx, wy, tw, th]);
        parts.push(`<text x="${wx}" y="${wy}" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(255,255,255,0.92)" dominant-baseline="hanging">${esc(word)}</text>`);
        placed_ = true;
        break;
      }
    }
    if (!placed_) {
      const wx = Math.round(8 + rng() * Math.max(1, W - tw - 16));
      const wy = Math.round(HEADER_H + 8 + rng() * Math.max(1, H - BOTTOM_BAR_H - HEADER_H - th - 14));
      parts.push(`<text x="${wx}" y="${wy}" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(255,255,255,0.92)" dominant-baseline="hanging">${esc(word)}</text>`);
    }
  }

  // ── Header ──
  const titleTspans = titleLines
    .map((line, i) => `<tspan x="${PADDING}" dy="${i === 0 ? 0 : LAYOUT.TITLE_LINE_H}">${esc(line)}</tspan>`)
    .join("");

  const authorY = titleStartY + titleBlockH + LAYOUT.TITLE_AUTHOR_GAP;

  // ── Assemble SVG ──
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<!-- Botanical background -->
${parts.join("\n")}
<!-- White header -->
<rect x="0" y="0" width="${W}" height="${HEADER_H}" fill="#ffffff"/>
<!-- Color bar at top of header -->
<rect x="0" y="0" width="${W}" height="${COLOR_BAR_H}" fill="${palette[0]}"/>
<!-- Header separator -->
<rect x="0" y="${HEADER_H - 1}" width="${W}" height="1" fill="#e0e0e0"/>
<!-- Title -->
<text x="${PADDING}" y="${titleStartY}" font-family="Georgia,'Times New Roman',serif" font-size="${LAYOUT.TITLE_FONT_PX}" font-weight="bold" fill="#111111" dominant-baseline="hanging">${titleTspans}</text>
<!-- Author -->
<text x="${PADDING}" y="${authorY}" font-family="Georgia,'Times New Roman',serif" font-size="${LAYOUT.AUTHOR_FONT_PX}" fill="#555555" dominant-baseline="hanging">${esc(author)}</text>
<!-- Black bottom bar -->
<rect x="0" y="${H - BOTTOM_BAR_H}" width="${W}" height="${BOTTOM_BAR_H}" fill="#000000"/>
<!-- URL label -->
<text x="${W - 10}" y="${H - BOTTOM_BAR_H / 2}" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="bold" fill="rgba(180,180,180,0.9)" text-anchor="end" dominant-baseline="middle">gutenberg-navigator.de</text>
</svg>`;
}
