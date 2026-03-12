import { useState } from "react";
import { BookOpen, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LocalBook } from "../../../shared/gutenberg";
import { getAuthorDisplay, getCoverUrl, parseSubjects, translateSubject } from "../../../shared/gutenberg";

interface BookCardProps {
  book: LocalBook;
  shortSummary?: string;
  onClick?: () => void;
  compact?: boolean;
}

export function BookCard({ book, shortSummary, onClick, compact = false }: BookCardProps) {
  const [imgError, setImgError] = useState(false);
  const coverUrl = getCoverUrl(book);
  const author = getAuthorDisplay(book);

  return (
    <div
      className="book-card cursor-pointer group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      aria-label={`${book.title} von ${author}`}
    >
      {/* Cover */}
      <div className="relative overflow-hidden bg-muted" style={{ aspectRatio: "2/3" }}>
        {!imgError ? (
          <img
            src={coverUrl}
            alt={`Cover: ${book.title}`}
            className="absolute inset-0 w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <CoverFallback title={book.title} />
        )}
        {/* Download counts not available in pg_catalog.csv */}
      </div>

      {/* Info */}
      <div className={compact ? "p-2" : "p-3"}>
        <h3
          className={`font-semibold text-card-foreground leading-tight mb-1 line-clamp-2 ${
            compact ? "text-xs" : "text-sm"
          }`}
          style={{ fontFamily: "Lora, Georgia, serif" }}
        >
          {book.title}
        </h3>
        <div className="flex items-center gap-1 text-muted-foreground mb-2">
          <User className="w-3 h-3 shrink-0" />
          <p className={`line-clamp-1 ${compact ? "text-xs" : "text-xs"}`}>{author}</p>
        </div>

        {!compact && shortSummary && (
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
            {shortSummary}
          </p>
        )}

          {!compact && parseSubjects(book.subjects).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {parseSubjects(book.subjects).slice(0, 2).map((s) => (
              <Badge key={s} variant="secondary" className="text-xs px-1.5 py-0 h-4 truncate max-w-[120px]">
                {translateSubject(s)}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CoverFallback({ title }: { title: string }) {
  const t = title || "?";
  const hue = Math.abs(t.charCodeAt(0) * 7 + (t.charCodeAt(1) || 0) * 13) % 360;
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center p-3"
      style={{ background: `oklch(0.75 0.08 ${hue})` }}
    >
      <BookOpen className="w-8 h-8 text-white/70 mb-2" />
      <p className="text-white text-xs text-center font-medium leading-tight line-clamp-4"
         style={{ fontFamily: "Lora, Georgia, serif" }}>
        {title}
      </p>
    </div>
  );
}

function formatDownloads(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─── Skeleton ────────────────────────────────────────────────

export function BookCardSkeleton() {
  return (
    <div className="book-card">
      <div className="skeleton" style={{ aspectRatio: "2/3" }} />
      <div className="p-3 space-y-2">
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-4/5 rounded" />
      </div>
    </div>
  );
}
