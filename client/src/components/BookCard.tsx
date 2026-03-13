import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { BookOpen, User, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import type { LocalBook } from "../../../shared/gutenberg";
import { getAuthorDisplay, getCoverUrl, parseSubjects, translateSubject, parseAuthors, isCopyrightProtectedDE } from "../../../shared/gutenberg";

interface BookCardProps {
  book: LocalBook;
  shortSummary?: string;
  onClick?: () => void;
  compact?: boolean;
}

export function BookCard({ book, shortSummary: propSummary, onClick, compact = false }: BookCardProps) {
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, navigate] = useLocation();
  const coverUrl = getCoverUrl(book);
  const author = getAuthorDisplay(book);
  const subjects = parseSubjects(book.subjects);
  const parsedAuthors = parseAuthors(book.authors);

  const handleMouseEnter = useCallback(() => {
    hoverTimer.current = setTimeout(() => setHovered(true), 150);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHovered(false);
  }, []);

  // Fetch summary on first hover, cached indefinitely
  const { data: cachedSummary } = trpc.summaries.getCached.useQuery(
    { gutenbergId: book.gutenbergId },
    { enabled: hovered, staleTime: Infinity }
  );

  const shortSummary = propSummary ?? cachedSummary?.shortSummary ?? null;
  const isProtected = isCopyrightProtectedDE(book.authors);

  return (
    <div
      className="book-card cursor-pointer group relative"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      aria-label={`${book.title} von ${author}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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

        {/* Hover overlay — summary + tags, anchored to bottom ~2/3 of cover */}
        <div
          className={`absolute inset-0 transition-opacity duration-200 ${
            hovered ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.88) 40%, rgba(0,0,0,0.55) 65%, transparent 100%)",
          }}
        >
          <div className="absolute bottom-0 left-0 right-0 p-3" style={{ maxHeight: "67%" }}>
            {isProtected && (
              <div className="flex items-center gap-1 mb-2">
                <Lock className="w-3 h-3 text-amber-400/80" />
                <span className="text-amber-400/80 text-xs">Urheberrechtlich geschützt (DE)</span>
              </div>
            )}
            {shortSummary ? (
              <p className="text-white/90 text-xs leading-relaxed overflow-hidden" style={{
                display: "-webkit-box",
                WebkitLineClamp: isProtected ? 4 : 6,
                WebkitBoxOrient: "vertical",
              }}>
                {shortSummary}
              </p>
            ) : (
              <p className="text-white/40 text-xs italic">Keine Zusammenfassung</p>
            )}
            {subjects.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {subjects.slice(0, 3).map((s) => (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="text-xs px-1.5 py-0 h-4 bg-white/20 text-white border-0"
                  >
                    {translateSubject(s)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card footer — title, author, year */}
      <div className={compact ? "p-2" : "p-3"}>
        <h3
          className={`font-semibold text-card-foreground leading-tight mb-0.5 line-clamp-2 ${
            compact ? "text-xs" : "text-sm"
          }`}
          style={{ fontFamily: "Lora, Georgia, serif" }}
        >
          {book.title}
        </h3>
        {/* NOTE: book.issued is the Gutenberg upload date, NOT the original publication year — do not display it */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <User className="w-3 h-3 shrink-0" />
          {parsedAuthors.length > 0 ? (
            <button
              className="line-clamp-1 text-xs text-left hover:text-foreground hover:underline transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/author/${encodeURIComponent(parsedAuthors[0].name)}`);
              }}
              title={`Alle Werke von ${parsedAuthors[0].displayName}`}
            >
              {author}
            </button>
          ) : (
            <p className="line-clamp-1 text-xs">{author}</p>
          )}
        </div>
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
      <p
        className="text-white text-xs text-center font-medium leading-tight line-clamp-4"
        style={{ fontFamily: "Lora, Georgia, serif" }}
      >
        {title}
      </p>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────

export function BookCardSkeleton() {
  return (
    <div className="book-card">
      <div className="skeleton" style={{ aspectRatio: "2/3" }} />
      <div className="p-3 space-y-2">
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}
