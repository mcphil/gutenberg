/**
 * GenerativeCover — deterministic book cover based on the original CoverFallback design.
 *
 * Design principle:
 *  - Background: oklch(0.72 0.10 {hue}) — a muted, elegant colour derived from the title
 *  - Subtle texture: a repeating diagonal line pattern in a slightly lighter shade
 *  - Top label: "GUTENBERG NAVIGATOR" in small-caps, spaced tracking
 *  - Centre ornament: an open-book SVG icon
 *  - Bottom: title in Lora serif, author in a lighter weight below
 *
 * The hue is derived deterministically from the title string so the same book
 * always gets the same colour, but different books get visually distinct covers.
 */

import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface GenerativeCoverProps {
  title: string;
  author?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Returns an oklch hue (0–360) derived from the title */
function titleHue(title: string): number {
  const t = title || "?";
  // Use a wider spread so adjacent titles differ visually
  return hashString(t) % 360;
}

/** Lightness offset for the texture lines (+0.06 above base) */
function textureLightness(hue: number): number {
  // Slightly lighter than the base for a subtle embossed look
  return 0.78;
}

export function GenerativeCover({ title, author, size = "md", className }: GenerativeCoverProps) {
  const hue = titleHue(title);
  const bgColor = `oklch(0.72 0.10 ${hue})`;
  const textureColor = `oklch(${textureLightness(hue)} 0.10 ${hue})`;
  const shadowColor = `oklch(0.42 0.10 ${hue})`;

  // Icon size by cover size
  const iconSize = size === "sm" ? 16 : size === "lg" ? 32 : 24;
  const titleClamp = size === "sm" ? "line-clamp-3" : "line-clamp-4";
  const titleSize = size === "sm" ? "text-[9px]" : size === "lg" ? "text-sm" : "text-xs";
  const authorSize = size === "sm" ? "text-[7px]" : size === "lg" ? "text-xs" : "text-[9px]";
  const labelSize = size === "sm" ? "text-[5px]" : size === "lg" ? "text-[8px]" : "text-[6px]";
  const padding = size === "sm" ? "px-1.5 py-1.5" : size === "lg" ? "px-4 py-4" : "px-2.5 py-2.5";

  // Unique pattern id per title to avoid SVG id collisions
  const patternId = `cover-pattern-${hashString(title) % 99999}`;

  return (
    <div
      className={cn("relative w-full h-full flex flex-col overflow-hidden select-none", className)}
      style={{ background: bgColor }}
      aria-label={`Cover: ${title}`}
      role="img"
    >
      {/* Diagonal line texture */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width="8"
            height="8"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke={textureColor} strokeWidth="0.8" strokeOpacity="0.45" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>

      {/* Top border line */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "rgba(255,255,255,0.25)" }} />
      {/* Bottom border line */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "rgba(0,0,0,0.20)" }} />

      {/* Content */}
      <div className={cn("relative z-10 flex flex-col h-full", padding)}>
        {/* Top label */}
        <p
          className={cn("font-semibold tracking-widest uppercase text-white/60 mb-auto", labelSize)}
          style={{ fontFamily: "system-ui, sans-serif", letterSpacing: "0.18em" }}
        >
          Gutenberg Navigator
        </p>

        {/* Centre icon */}
        <div className="flex justify-center my-auto">
          <BookOpen
            style={{ width: iconSize, height: iconSize, color: "rgba(255,255,255,0.65)" }}
            strokeWidth={1.5}
          />
        </div>

        {/* Bottom: title + author */}
        <div className="mt-auto">
          {/* Thin separator */}
          <div className="w-8 h-px mb-1.5" style={{ background: "rgba(255,255,255,0.40)" }} />
          <p
            className={cn("font-semibold text-white leading-tight", titleSize, titleClamp)}
            style={{ fontFamily: "Lora, Georgia, serif", textShadow: `0 1px 3px ${shadowColor}` }}
          >
            {title}
          </p>
          {author && (
            <p
              className={cn("text-white/70 mt-0.5 leading-tight line-clamp-1", authorSize)}
              style={{ fontFamily: "Lora, Georgia, serif" }}
            >
              {author}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
