/**
 * GenerativeCover — deterministic botanical book cover.
 *
 * Design system (v5 — FIXED LAYOUT):
 *  - Every cover has IDENTICAL proportions:
 *      • Color bar:      16px (top accent)
 *      • White header:   140px (fixed — never changes)
 *      • Botanical area: 396px (71% of cover height)
 *      • Black bottom:    24px with "gutenberg-navigator.de"
 *  - Title: always 26pt Noto Serif Bold, max 6 words → truncated with " …"
 *  - Title+author block vertically centered in the 140px header
 *  - 7 deterministic color palettes (hash of title)
 *  - Botanical L-system fern as background
 *  - UPPERCASE keyword cloud from preview text
 *
 * Data-driven decision (2,395 German Gutenberg titles):
 *  - 65.9% of titles are ≤6 words (no truncation needed)
 *  - 26pt fits all 6-word titles in ≤2 lines at 372px width
 *  - Fixed header = uniform visual rhythm across all covers
 */

import { useRef, useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";

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

// ─── Color palettes ────────────────────────────────────────────────────────────
// [bg_top_rgb, bg_bottom_rgb, branch_young_rgb, branch_old_rgb]
const PALETTES: [string, string, string, string][] = [
  ["rgb(12,35,60)",   "rgb(22,60,100)",  "rgb(100,175,235)", "rgb(195,235,255)"],  // ocean blue
  ["rgb(50,18,6)",    "rgb(90,38,12)",   "rgb(230,140,55)",  "rgb(255,215,140)"],  // amber/rust
  ["rgb(14,45,22)",   "rgb(26,78,38)",   "rgb(85,210,110)",  "rgb(195,255,175)"],  // forest green
  ["rgb(48,12,48)",   "rgb(85,22,85)",   "rgb(205,105,230)", "rgb(245,195,255)"],  // violet
  ["rgb(52,38,6)",    "rgb(95,70,12)",   "rgb(225,195,65)",  "rgb(255,245,165)"],  // gold
  ["rgb(6,44,48)",    "rgb(12,80,85)",   "rgb(65,205,215)",  "rgb(165,255,255)"],  // teal
  ["rgb(48,6,22)",    "rgb(88,12,42)",   "rgb(235,85,135)",  "rgb(255,195,215)"],  // rose/crimson
];

// Parse "rgb(r,g,b)" → [r, g, b]
function parseRgb(s: string): [number, number, number] {
  const m = s.match(/(\d+),\s*(\d+),\s*(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
}

// ─── Deterministic hash ────────────────────────────────────────────────────────
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ─── Seeded RNG (mulberry32) ───────────────────────────────────────────────────
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── L-System ─────────────────────────────────────────────────────────────────
function lsystemExpand(axiom: string, rules: Record<string, string>, iterations: number): string {
  let s = axiom;
  for (let i = 0; i < iterations; i++) {
    s = s.split("").map(c => rules[c] ?? c).join("");
  }
  return s;
}

interface Segment {
  x0: number; y0: number;
  x1: number; y1: number;
  depth: number;
}

function lsystemSegments(
  s: string,
  startAngleDeg: number,
  angleDeg: number,
  step: number
): { segments: Segment[]; maxDepth: number } {
  const angle = (angleDeg * Math.PI) / 180;
  let x = 0, y = 0;
  let heading = (startAngleDeg * Math.PI) / 180;
  const stack: [number, number, number][] = [];
  const depthStack: number[] = [];
  const segments: Segment[] = [];
  let depth = 0;
  let maxDepth = 0;

  for (const c of s) {
    if (c === "F" || c === "G") {
      const nx = x + step * Math.cos(heading);
      const ny = y + step * Math.sin(heading);
      segments.push({ x0: x, y0: y, x1: nx, y1: ny, depth });
      x = nx; y = ny;
    } else if (c === "+") {
      heading += angle;
    } else if (c === "-") {
      heading -= angle;
    } else if (c === "[") {
      stack.push([x, y, heading]);
      depthStack.push(depth);
      depth++;
      maxDepth = Math.max(maxDepth, depth);
    } else if (c === "]") {
      [x, y, heading] = stack.pop()!;
      depth = depthStack.pop()!;
    }
  }
  return { segments, maxDepth };
}

// ─── Fixed layout constants (scaled from 400×560 reference) ───────────────────
// These proportions are fixed — every cover has the same structure.
const LAYOUT = {
  // Reference dimensions (canvas native size for "lg")
  REF_W: 400,
  REF_H: 560,
  // Fixed zones (px at reference size)
  COLOR_BAR_H: 16,   // thin accent strip
  HEADER_H: 140,     // white header — NEVER changes
  BOTTOM_BAR_H: 24,  // black URL bar
  // get botanical height: REF_H - HEADER_H - BOTTOM_BAR_H = 396px
  // Typography
  TITLE_FONT_PX: 26,       // fixed title size
  TITLE_LINE_H: 34,        // 26 * 1.30 ≈ 34
  AUTHOR_FONT_PX: 16,
  AUTHOR_H: 20,
  TITLE_AUTHOR_GAP: 11,
  PADDING: 14,
  MAX_TITLE_WORDS: 6,      // truncate after this many words
};

/** Truncate title to at most MAX_TITLE_WORDS words, append " …" if cut. */
function truncateTitle(title: string, maxWords = LAYOUT.MAX_TITLE_WORDS): string {
  const words = title.split(/\s+/);
  if (words.length <= maxWords) return title;
  return words.slice(0, maxWords).join(" ") + " \u2026";
}

/** Word-wrap text into lines fitting maxW pixels using a canvas 2D context. */
function wordWrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxW && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Extract meaningful keywords from preview text ─────────────────────────────
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

// ─── Component ────────────────────────────────────────────────────────────────

interface GenerativeCoverProps {
  title: string;
  author?: string;
  previewText?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function GenerativeCover({
  title,
  author = "",
  previewText = "",
  size = "md",
  className,
}: GenerativeCoverProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  // Stable seed derived from title
  const seed = useMemo(() => hashString(title || "?"), [title]);
  const paletteIdx = seed % PALETTES.length;
  const palette = PALETTES[paletteIdx];

  // Keywords extracted once
  const keywords = useMemo(() => extractKeywords(previewText), [previewText]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const rng = makeRng(seed);

    // ── Scale all layout constants proportionally to canvas size ──
    const scaleW = W / LAYOUT.REF_W;
    const scaleH = H / LAYOUT.REF_H;

    const COLOR_BAR_H  = Math.round(LAYOUT.COLOR_BAR_H  * scaleH);
    const HEADER_H     = Math.round(LAYOUT.HEADER_H     * scaleH);
    const BOTTOM_BAR_H = Math.round(LAYOUT.BOTTOM_BAR_H * scaleH);
    const VIS_H        = H - HEADER_H - BOTTOM_BAR_H;

    const PADDING          = Math.round(LAYOUT.PADDING          * scaleW);
    const MAX_TEXT_W       = W - PADDING * 2;
    const TITLE_FONT_PX    = Math.round(LAYOUT.TITLE_FONT_PX    * scaleW);
    const TITLE_LINE_H     = Math.round(LAYOUT.TITLE_LINE_H     * scaleH);
    const AUTHOR_FONT_PX   = Math.round(LAYOUT.AUTHOR_FONT_PX   * scaleW);
    const AUTHOR_H         = Math.round(LAYOUT.AUTHOR_H         * scaleH);
    const TITLE_AUTHOR_GAP = Math.round(LAYOUT.TITLE_AUTHOR_GAP * scaleH);

    // ── Parse palette colors ──
    const bgTop    = parseRgb(palette[0]);
    const bgBottom = parseRgb(palette[1]);
    const brYoung  = parseRgb(palette[2]);
    const brOld    = parseRgb(palette[3]);

    // ── Truncate and wrap title ──
    const displayTitle = truncateTitle(title, LAYOUT.MAX_TITLE_WORDS);
    ctx.font = `bold ${TITLE_FONT_PX}px "Noto Serif", Georgia, serif`;
    const titleLines = wordWrap(ctx, displayTitle, MAX_TEXT_W);
    const actualLines = titleLines.filter(l => l.trim().length > 0);

    // ── Vertically center title+author block in the fixed header ──
    const textBlockH = actualLines.length * TITLE_LINE_H + TITLE_AUTHOR_GAP + AUTHOR_H;
    const availH = HEADER_H - COLOR_BAR_H;
    const minTopPad = Math.round(LAYOUT.PADDING * scaleH);
    const titleStartY = COLOR_BAR_H + Math.max(minTopPad, Math.round((availH - textBlockH) / 2));

    // ── Draw thin color bar at top ──
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, W, COLOR_BAR_H);

    // ── Draw white header block ──
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, COLOR_BAR_H, W, HEADER_H - COLOR_BAR_H);

    // Subtle separator line
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(0, HEADER_H - 1, W, 1);

    // ── Draw title lines ──
    ctx.fillStyle = "#111111";
    ctx.font = `bold ${TITLE_FONT_PX}px "Noto Serif", Georgia, serif`;
    ctx.textBaseline = "top";
    for (let i = 0; i < actualLines.length; i++) {
      ctx.fillText(actualLines[i], PADDING, titleStartY + i * TITLE_LINE_H);
    }

    // ── Draw author line ──
    const authorY = titleStartY + actualLines.length * TITLE_LINE_H + TITLE_AUTHOR_GAP;
    const displayAuthor = author.length <= 42 ? author : author.slice(0, 40) + " \u2026";
    ctx.fillStyle = "#555555";
    ctx.font = `${AUTHOR_FONT_PX}px "Noto Serif", Georgia, serif`;
    ctx.textBaseline = "top";
    ctx.fillText(displayAuthor, PADDING, authorY);

    // ── Botanical gradient background ──
    for (let py = HEADER_H; py < H - BOTTOM_BAR_H; py++) {
      const t = (py - HEADER_H) / Math.max(VIS_H, 1);
      const r = Math.round(bgTop[0] + t * (bgBottom[0] - bgTop[0]));
      const g = Math.round(bgTop[1] + t * (bgBottom[1] - bgTop[1]));
      const b = Math.round(bgTop[2] + t * (bgBottom[2] - bgTop[2]));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, py, W, 1);
    }

    // ── L-System fern ──
    const axiom = "X";
    const rules: Record<string, string> = { X: "F+[[X]-X]-F[-FX]+X", F: "FF" };
    const angleDeg = 22 + (seed % 10);
    const startAngle = 75 + (seed % 30);
    const step = 3.2 + (seed % 3) * 0.3;

    const lStr = lsystemExpand(axiom, rules, 5);
    const { segments, maxDepth } = lsystemSegments(lStr, startAngle, angleDeg, step);

    const allX = segments.flatMap(s => [s.x0, s.x1]);
    const allY = segments.flatMap(s => [s.y0, s.y1]);
    const minX = Math.min(...allX), maxX = Math.max(...allX);
    const minY = Math.min(...allY), maxY = Math.max(...allY);

    const scaleXf = (W - 20) / Math.max(maxX - minX, 1);
    const scaleYf = (VIS_H - 20) / Math.max(maxY - minY, 1);
    const scale = Math.min(scaleXf, scaleYf) * 0.82;

    const renderedW = (maxX - minX) * scale;
    const offsetX = (W - renderedW) / 2 - minX * scale;

    const transform = (px: number, py: number): [number, number] => {
      const tx = px * scale + offsetX;
      const ty = VIS_H - ((py - minY) * scale + 10);
      return [Math.round(tx), Math.round(ty + HEADER_H)];
    };

    for (const seg of segments) {
      const t = seg.depth / Math.max(maxDepth, 1);
      const r = Math.round(brYoung[0] + t * (brOld[0] - brYoung[0]));
      const g = Math.round(brYoung[1] + t * (brOld[1] - brYoung[1]));
      const b = Math.round(brYoung[2] + t * (brOld[2] - brYoung[2]));
      const [x0, y0] = transform(seg.x0, seg.y0);
      const [x1, y1] = transform(seg.x1, seg.y1);
      if (y0 < HEADER_H && y1 < HEADER_H) continue;
      if (y0 > H - BOTTOM_BAR_H && y1 > H - BOTTOM_BAR_H) continue;
      const lineW = Math.max(1, Math.round(2.5 - t * 1.8));
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // ── Keywords overlay — UPPERCASE, white, no shadow ──
    const placed: [number, number, number, number][] = [];

    const overlaps = (x: number, y: number, tw: number, th: number) => {
      for (const [rx, ry, rw, rh] of placed) {
        if (!(x + tw < rx - 8 || x > rx + rw + 8 || y + th < ry - 6 || y > ry + rh + 6)) {
          return true;
        }
      }
      return false;
    };

    ctx.textBaseline = "top";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    for (const word of keywords) {
      const fontSize = Math.round((11 + rng() * 11) * scaleW); // 11–22px scaled
      ctx.font = `bold ${fontSize}px "Noto Sans", Arial, sans-serif`;
      const metrics = ctx.measureText(word);
      const tw = Math.ceil(metrics.width);
      const th = fontSize;

      let placed_ = false;
      for (let attempt = 0; attempt < 300; attempt++) {
        const wx = Math.round(8 + rng() * Math.max(1, W - tw - 16));
        const wy = Math.round(HEADER_H + 8 + rng() * Math.max(1, H - BOTTOM_BAR_H - HEADER_H - th - 14));
        if (!overlaps(wx, wy, tw, th)) {
          placed.push([wx, wy, tw, th]);
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.fillText(word, wx, wy);
          placed_ = true;
          break;
        }
      }
      if (!placed_) {
        const wx = Math.round(8 + rng() * Math.max(1, W - tw - 16));
        const wy = Math.round(HEADER_H + 8 + rng() * Math.max(1, H - BOTTOM_BAR_H - HEADER_H - th - 14));
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(word, wx, wy);
      }
    }

    // ── Black bottom bar with URL ──
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, H - BOTTOM_BAR_H, W, BOTTOM_BAR_H);

    const urlFontSize = Math.round(11 * scaleW);
    ctx.font = `bold ${urlFontSize}px "Noto Sans", Arial, sans-serif`;
    ctx.fillStyle = "rgba(180,180,180,0.9)";
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.fillText("gutenberg-navigator.de", W - Math.round(10 * scaleW), H - BOTTOM_BAR_H / 2);
    ctx.textAlign = "left"; // reset

    setRendered(true);
  }, [title, author, keywords, seed, palette]);

  // Canvas dimensions based on size prop
  const dims = size === "sm"
    ? { w: 120, h: 168 }
    : size === "lg"
    ? { w: 400, h: 560 }
    : { w: 200, h: 280 };

  return (
    <div
      className={cn("relative w-full h-full overflow-hidden select-none", className)}
      aria-label={`Cover: ${title}`}
      role="img"
    >
      {/* Fallback background while canvas renders */}
      {!rendered && (
        <div
          className="absolute inset-0"
          style={{ background: palette[0] }}
        />
      )}
      <canvas
        ref={canvasRef}
        width={dims.w}
        height={dims.h}
        className="w-full h-full"
        style={{ display: "block", imageRendering: "auto" }}
      />
    </div>
  );
}
