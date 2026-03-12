/**
 * Typographic Fallback Cover Generator
 *
 * Produces a book-cover-proportioned SVG (400×600) for books that have no
 * cover image on Project Gutenberg.  The design is intentionally minimal and
 * typographic — inspired by early 20th-century German publisher aesthetics
 * (think Insel-Verlag, Reclam, S. Fischer).
 *
 * Colour palette: one of eight carefully chosen muted tones, deterministically
 * selected by hashing the book title so the same book always gets the same
 * colour across page loads and devices.
 */

// ─── Colour palette ───────────────────────────────────────────
// Eight muted, book-cover-appropriate colours (background / foreground pairs)
const PALETTES: Array<{ bg: string; fg: string; accent: string }> = [
  { bg: "#2C3E50", fg: "#ECF0F1", accent: "#BDC3C7" }, // Mitternachtsblau
  { bg: "#4A3728", fg: "#F5ECD7", accent: "#C8A97E" }, // Altes Leder
  { bg: "#1A3A2A", fg: "#E8F5E9", accent: "#81C784" }, // Dunkelgrün
  { bg: "#3D2B1F", fg: "#FFF8F0", accent: "#D4A574" }, // Tabak
  { bg: "#2E2E4E", fg: "#E8E8F5", accent: "#9FA8DA" }, // Indigo
  { bg: "#4A2040", fg: "#F9E8F5", accent: "#CE93D8" }, // Pflaume
  { bg: "#1C3A4A", fg: "#E0F4FF", accent: "#80DEEA" }, // Schieferblau
  { bg: "#3A3A2A", fg: "#F5F5E8", accent: "#C5C58A" }, // Olivgrau
];

/** Deterministic hash of a string → integer */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Pick a palette deterministically from the title */
function pickPalette(title: string) {
  return PALETTES[hashString(title) % PALETTES.length]!;
}

// ─── Text helpers ─────────────────────────────────────────────

/** Escape XML special characters */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Wrap text into lines of at most `maxChars` characters, breaking on spaces.
 * Returns at most `maxLines` lines; the last line gets an ellipsis if truncated.
 */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars - 1) + "…" : word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);

  // Truncate last line if we still have too many
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1]!.slice(0, maxChars - 1) + "…";
  }
  return lines;
}

// ─── SVG builder ─────────────────────────────────────────────

const W = 400;
const H = 600;

/**
 * Generate a typographic book cover SVG.
 *
 * @param title   Book title (may be long)
 * @param author  Author name(s)
 * @returns       SVG string (UTF-8, no XML declaration)
 */
export function generateFallbackCoverSvg(title: string, author: string): string {
  const palette = pickPalette(title);

  // Title: up to 4 lines of 20 chars each, 32px serif
  const titleLines = wrapText(title, 20, 4);
  // Author: up to 2 lines of 24 chars each, 18px
  const authorLines = wrapText(author, 24, 2);

  // Vertical layout (all Y positions are absolute from top)
  const topBorderY = 40;
  const bottomBorderY = H - 40;
  const innerTop = 60;
  const innerBottom = H - 60;

  // Ornamental divider lines
  const divider1Y = innerTop + 30;   // below top ornament
  const divider2Y = innerBottom - 30; // above bottom ornament

  // Title block: centred vertically in the middle two-thirds of the cover
  const titleBlockTop = H * 0.28;
  const titleLineHeight = 44;
  const titleBlockHeight = titleLines.length * titleLineHeight;
  const titleStartY = titleBlockTop + (H * 0.38 - titleBlockHeight) / 2;

  // Author block: anchored near the bottom
  const authorStartY = divider2Y - 20 - authorLines.length * 26;

  // Small decorative "Gutenberg Navigator" label at the very top
  const labelY = topBorderY + 22;

  // ── Ornament path (simple floral/diamond motif) ──────────
  // A small diamond with four petals, centred at (cx, cy)
  function ornament(cx: number, cy: number, size = 8): string {
    const s = size;
    return `
      <g transform="translate(${cx},${cy})">
        <polygon points="0,${-s} ${s * 0.5},0 0,${s} ${-s * 0.5},0"
                 fill="${palette.accent}" opacity="0.9"/>
        <line x1="${-s * 1.8}" y1="0" x2="${-s * 0.7}" y2="0"
              stroke="${palette.accent}" stroke-width="1" opacity="0.7"/>
        <line x1="${s * 0.7}" y1="0" x2="${s * 1.8}" y2="0"
              stroke="${palette.accent}" stroke-width="1" opacity="0.7"/>
      </g>`;
  }

  // ── Title tspan elements ──────────────────────────────────
  const titleTspans = titleLines
    .map(
      (line, i) =>
        `<tspan x="${W / 2}" dy="${i === 0 ? 0 : titleLineHeight}">${esc(line)}</tspan>`
    )
    .join("\n        ");

  // ── Author tspan elements ─────────────────────────────────
  const authorTspans = authorLines
    .map(
      (line, i) =>
        `<tspan x="${W / 2}" dy="${i === 0 ? 0 : 26}">${esc(line)}</tspan>`
    )
    .join("\n        ");

  return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${palette.bg}"/>

  <!-- Subtle texture overlay (diagonal lines) -->
  <defs>
    <pattern id="tex" width="4" height="4" patternUnits="userSpaceOnUse"
             patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="4"
            stroke="${palette.fg}" stroke-width="0.3" opacity="0.06"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#tex)"/>

  <!-- Outer border frame -->
  <rect x="${topBorderY - 20}" y="${topBorderY - 20}"
        width="${W - (topBorderY - 20) * 2}" height="${H - (topBorderY - 20) * 2}"
        fill="none" stroke="${palette.accent}" stroke-width="1.2" opacity="0.5"/>

  <!-- Inner border frame -->
  <rect x="${innerTop - 10}" y="${innerTop - 10}"
        width="${W - (innerTop - 10) * 2}" height="${H - (innerTop - 10) * 2}"
        fill="none" stroke="${palette.accent}" stroke-width="0.6" opacity="0.35"/>

  <!-- Top label: "Gutenberg Navigator" -->
  <text x="${W / 2}" y="${labelY}"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="10" letter-spacing="3"
        fill="${palette.accent}" opacity="0.7"
        text-anchor="middle" dominant-baseline="middle">
    GUTENBERG NAVIGATOR
  </text>

  <!-- Divider line 1 with ornament -->
  <line x1="${innerTop}" y1="${divider1Y}"
        x2="${W - innerTop}" y2="${divider1Y}"
        stroke="${palette.accent}" stroke-width="0.8" opacity="0.5"/>
  ${ornament(W / 2, divider1Y)}

  <!-- Title -->
  <text x="${W / 2}" y="${titleStartY}"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="32" font-weight="normal"
        fill="${palette.fg}"
        text-anchor="middle" dominant-baseline="hanging"
        letter-spacing="0.5">
        ${titleTspans}
  </text>

  <!-- Divider line 2 with ornament -->
  <line x1="${innerTop}" y1="${divider2Y}"
        x2="${W - innerTop}" y2="${divider2Y}"
        stroke="${palette.accent}" stroke-width="0.8" opacity="0.5"/>
  ${ornament(W / 2, divider2Y)}

  <!-- Author -->
  <text x="${W / 2}" y="${authorStartY}"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="18" font-style="italic"
        fill="${palette.accent}"
        text-anchor="middle" dominant-baseline="hanging"
        letter-spacing="0.3">
        ${authorTspans}
  </text>

</svg>`;
}
