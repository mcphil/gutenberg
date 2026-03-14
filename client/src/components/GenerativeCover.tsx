/**
 * GenerativeCover — deterministisches SVG-Buchcover
 *
 * Erzeugt aus Titel + Autor ein konsistentes, elegantes Cover.
 * Kein Zufall: dasselbe Buch erhält immer dasselbe Cover.
 * Inspiriert von Penguin Classics / Insel-Bücherei — klare Typografie,
 * geometrische Muster, zurückhaltende Farbpaletten.
 */

import React from "react";

// ─── Farbpaletten ──────────────────────────────────────────────────────────────
// Jede Palette: [bg, accent, text, stripe]
const PALETTES = [
  // Klassisch Blau (Penguin-Stil)
  ["#1a2744", "#c8a96e", "#f0e8d6", "#243460"],
  // Tiefes Grün
  ["#1c3a2e", "#d4a853", "#f5eed8", "#254d3d"],
  // Bordeaux
  ["#4a1525", "#c9a96e", "#f5ead8", "#5e1c30"],
  // Schiefergrau
  ["#2c3340", "#b8956a", "#f0e8d8", "#363f50"],
  // Preußisch Blau
  ["#1b3a5c", "#e8c47a", "#f5eed8", "#234876"],
  // Dunkeloliv
  ["#2d3a1e", "#d4b86a", "#f5eed8", "#3a4a26"],
  // Aubergine
  ["#2d1b3d", "#c9a96e", "#f5ead8", "#3a2450"],
  // Petrol
  ["#1a3840", "#c8b46e", "#f0ead8", "#234a52"],
  // Umbra
  ["#3a2c1e", "#d4a853", "#f5ead8", "#4a3826"],
  // Indigo
  ["#1e2a4a", "#d4b86a", "#f5eed8", "#263660"],
  // Moosgrün
  ["#263d22", "#c9b46e", "#f5eed8", "#304d2a"],
  // Mahagoni
  ["#3d1e1e", "#c9a96e", "#f5ead8", "#4e2626"],
];

// ─── Muster-Typen ─────────────────────────────────────────────────────────────
type PatternType = "lines" | "diamonds" | "dots" | "waves" | "chevrons" | "grid" | "circles" | "triangles";
const PATTERNS: PatternType[] = ["lines", "diamonds", "dots", "waves", "chevrons", "grid", "circles", "triangles"];

// ─── Deterministische Hash-Funktion ───────────────────────────────────────────
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length <= maxChars) {
      current = (current + " " + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4); // max 4 Zeilen
}

// ─── Muster-Renderer ──────────────────────────────────────────────────────────
function renderPattern(type: PatternType, accent: string, stripe: string, seed: number): React.ReactNode {
  const op = 0.18 + (seed % 7) * 0.02;
  const id = `p${seed}`;

  switch (type) {
    case "lines":
      return (
        <>
          <defs>
            <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform={`rotate(${30 + (seed % 5) * 15})`}>
              <line x1="0" y1="0" x2="0" y2="12" stroke={accent} strokeWidth="1.5" strokeOpacity={op * 1.4} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${id})`} />
        </>
      );

    case "diamonds":
      return (
        <>
          <defs>
            <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
              <polygon points="10,2 18,10 10,18 2,10" fill="none" stroke={accent} strokeWidth="1" strokeOpacity={op * 1.2} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${id})`} />
        </>
      );

    case "dots":
      return (
        <>
          <defs>
            <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="8" cy="8" r="1.8" fill={accent} fillOpacity={op * 1.5} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${id})`} />
        </>
      );

    case "waves":
      return (
        <>
          <defs>
            <pattern id={id} width="40" height="16" patternUnits="userSpaceOnUse">
              <path d="M0 8 Q10 2 20 8 Q30 14 40 8" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity={op * 1.3} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${id})`} />
        </>
      );

    case "chevrons":
      return (
        <>
          <defs>
            <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
              <polyline points="0,10 10,2 20,10" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity={op * 1.3} />
              <polyline points="0,20 10,12 20,20" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity={op * 1.3} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${id})`} />
        </>
      );

    case "grid":
      return (
        <>
          <defs>
            <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="20" y2="0" stroke={accent} strokeWidth="0.8" strokeOpacity={op} />
              <line x1="0" y1="0" x2="0" y2="20" stroke={accent} strokeWidth="0.8" strokeOpacity={op} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${id})`} />
        </>
      );

    case "circles":
      return (
        <>
          <defs>
            <pattern id={id} width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="15" cy="15" r="10" fill="none" stroke={accent} strokeWidth="1" strokeOpacity={op * 1.2} />
              <circle cx="15" cy="15" r="5" fill="none" stroke={accent} strokeWidth="0.8" strokeOpacity={op} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${id})`} />
        </>
      );

    case "triangles":
      return (
        <>
          <defs>
            <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
              <polygon points="12,2 22,22 2,22" fill="none" stroke={accent} strokeWidth="1" strokeOpacity={op * 1.2} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${id})`} />
        </>
      );

    default:
      return null;
  }
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
interface GenerativeCoverProps {
  title: string;
  author?: string;
  /** Aspect ratio container class — defaults to 2/3 book ratio */
  className?: string;
  /** Size hint for font scaling */
  size?: "sm" | "md" | "lg";
}

export function GenerativeCover({ title, author, className, size = "md" }: GenerativeCoverProps) {
  const seed = hash((title || "") + (author || ""));
  const palette = PALETTES[seed % PALETTES.length];
  const [bg, accent, textColor, stripe] = palette;
  const patternType = PATTERNS[(seed >> 4) % PATTERNS.length];

  // Typografische Größen je nach size-Prop
  const titleFontSize = size === "sm" ? 13 : size === "lg" ? 22 : 16;
  const authorFontSize = size === "sm" ? 9 : size === "lg" ? 13 : 10;
  const titleLines = wrapText(title || "", size === "sm" ? 14 : 18);

  // Ornament-Variante (0–3)
  const ornament = seed % 4;

  return (
    <div className={className} style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg
        viewBox="0 0 200 300"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", display: "block" }}
        aria-label={`Cover: ${title}`}
      >
        {/* Hintergrund */}
        <rect width="200" height="300" fill={bg} />

        {/* Muster-Overlay */}
        {renderPattern(patternType, accent, stripe, seed)}

        {/* Oberer Rahmenstreifen */}
        <rect x="0" y="0" width="200" height="28" fill={stripe} />
        <rect x="0" y="28" width="200" height="2" fill={accent} fillOpacity="0.8" />

        {/* Unterer Rahmenstreifen */}
        <rect x="0" y="270" width="200" height="2" fill={accent} fillOpacity="0.8" />
        <rect x="0" y="272" width="200" height="28" fill={stripe} />

        {/* Seitenlinien */}
        <rect x="10" y="0" width="1.5" height="300" fill={accent} fillOpacity="0.3" />
        <rect x="188.5" y="0" width="1.5" height="300" fill={accent} fillOpacity="0.3" />

        {/* Ornament / Dekor-Element in der Mitte */}
        {ornament === 0 && (
          // Klassischer Kreis-Ornament
          <>
            <circle cx="100" cy="148" r="42" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5" />
            <circle cx="100" cy="148" r="36" fill="none" stroke={accent} strokeWidth="0.8" strokeOpacity="0.3" />
            <circle cx="100" cy="148" r="4" fill={accent} fillOpacity="0.5" />
          </>
        )}
        {ornament === 1 && (
          // Rauten-Ornament
          <>
            <polygon points="100,106 140,148 100,190 60,148" fill="none" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5" />
            <polygon points="100,118 128,148 100,178 72,148" fill="none" stroke={accent} strokeWidth="0.8" strokeOpacity="0.3" />
            <polygon points="100,138 110,148 100,158 90,148" fill={accent} fillOpacity="0.4" />
          </>
        )}
        {ornament === 2 && (
          // Kreuz-Ornament (Insel-Bücherei-Stil)
          <>
            <line x1="100" y1="108" x2="100" y2="188" stroke={accent} strokeWidth="1" strokeOpacity="0.4" />
            <line x1="60" y1="148" x2="140" y2="148" stroke={accent} strokeWidth="1" strokeOpacity="0.4" />
            <circle cx="100" cy="148" r="20" fill="none" stroke={accent} strokeWidth="1.2" strokeOpacity="0.45" />
            <circle cx="100" cy="148" r="3" fill={accent} fillOpacity="0.5" />
          </>
        )}
        {ornament === 3 && (
          // Sternförmiges Ornament
          <>
            {[0, 45, 90, 135].map((angle) => (
              <line
                key={angle}
                x1={100 + Math.cos((angle * Math.PI) / 180) * 40}
                y1={148 + Math.sin((angle * Math.PI) / 180) * 40}
                x2={100 - Math.cos((angle * Math.PI) / 180) * 40}
                y2={148 - Math.sin((angle * Math.PI) / 180) * 40}
                stroke={accent}
                strokeWidth="1"
                strokeOpacity="0.4"
              />
            ))}
            <circle cx="100" cy="148" r="22" fill="none" stroke={accent} strokeWidth="1.2" strokeOpacity="0.45" />
            <circle cx="100" cy="148" r="4" fill={accent} fillOpacity="0.5" />
          </>
        )}

        {/* Dünne horizontale Trennlinie über dem Titel */}
        <line x1="20" y1="208" x2="180" y2="208" stroke={accent} strokeWidth="0.8" strokeOpacity="0.5" />

        {/* Titel-Text */}
        {titleLines.map((line, i) => (
          <text
            key={i}
            x="100"
            y={220 + i * (titleFontSize * 1.35)}
            textAnchor="middle"
            fill={textColor}
            fontSize={titleFontSize}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontWeight="400"
            letterSpacing="0.5"
          >
            {line}
          </text>
        ))}

        {/* Autor-Text im unteren Streifen */}
        {author && (
          <text
            x="100"
            y="285"
            textAnchor="middle"
            fill={accent}
            fontSize={authorFontSize}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontWeight="400"
            letterSpacing="1"
          >
            {author.length > 28 ? author.slice(0, 26) + "…" : author}
          </text>
        )}

        {/* Kleines Label im oberen Streifen */}
        <text
          x="100"
          y="18"
          textAnchor="middle"
          fill={accent}
          fontSize="7"
          fontFamily="Georgia, 'Times New Roman', serif"
          letterSpacing="2"
          fontWeight="400"
        >
          GUTENBERG NAVIGATOR
        </text>
      </svg>
    </div>
  );
}
