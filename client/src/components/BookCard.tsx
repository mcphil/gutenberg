import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { User, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import type { LocalBook } from "../../../shared/gutenberg";
import { getAuthorDisplay, parseSubjects, translateSubject, parseAuthors, isCopyrightProtectedDE } from "../../../shared/gutenberg";
import { GenerativeCover } from "@/components/GenerativeCover";

interface BookCardProps {
  book: LocalBook;
  shortSummary?: string;
  onClick?: () => void;
  compact?: boolean;
}

export function BookCard({ book, shortSummary: propSummary, onClick, compact = false }: BookCardProps) {
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, navigate] = useLocation();
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
  const isProtected = isCopyrightProtectedDE(book.authors, new Date().getFullYear(), book.copyrightProtectedUntil);

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
      <div className="relative overflow-hidden" style={{ aspectRatio: "2/3" }}>
        <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-105">
          <GenerativeCover title={book.title} author={author} size={compact ? "sm" : "md"} className="absolute inset-0" />
        </div>

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
