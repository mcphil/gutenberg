import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { BookCard, BookCardSkeleton } from "@/components/BookCard";
import { FilterPanel } from "@/components/FilterPanel";
import { ChevronLeft, ChevronRight, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthorDisplay, getCoverUrl, type LocalBook } from "../../../shared/gutenberg";

interface CatalogProps {
  view: "grid" | "list";
  searchQuery: string;
}

export default function Catalog({ view, searchQuery }: CatalogProps) {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"popular" | "ascending" | "descending">("popular");
  const [selectedSubject, setSelectedSubject] = useState("");

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [searchQuery, sortBy, selectedSubject]);

  const { data, isLoading, isFetching } = trpc.books.list.useQuery(
    { page, search: searchQuery || undefined, topic: selectedSubject || undefined, sort: sortBy },
    { staleTime: 5 * 60 * 1000 }
  );

  const books = data?.books ?? [];
  const totalCount = data?.total ?? 0;
  const totalPages = data?.pages ?? 0;

  const handleBookClick = useCallback(
    (book: LocalBook) => navigate(`/book/${book.gutenbergId}`),
    [navigate]
  );

  const skeletonCount = view === "grid" ? 32 : 8;

  return (
    <div>
      <FilterPanel
        sortBy={sortBy}
        onSortChange={setSortBy}
        selectedSubject={selectedSubject}
        onSubjectChange={setSelectedSubject}
        totalCount={totalCount}
        isLoading={isLoading}
      />

      {/* Book grid / list */}
      <div className={`py-6 ${view === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" : "flex flex-col gap-3"}`}>
        {isLoading || isFetching
          ? Array.from({ length: skeletonCount }).map((_, i) =>
              view === "grid" ? (
                <BookCardSkeleton key={i} />
              ) : (
                <ListRowSkeleton key={i} />
              )
            )
          : books.map((book) =>
              view === "grid" ? (
                <BookCard
                  key={book.gutenbergId}
                  book={book}
                  onClick={() => handleBookClick(book)}
                />
              ) : (
                <ListRow key={book.gutenbergId} book={book} onClick={() => handleBookClick(book)} />
              )
            )}
      </div>

      {/* Empty state */}
      {!isLoading && books.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium mb-2">Keine Bücher gefunden</p>
          <p className="text-sm">Versuche einen anderen Suchbegriff oder Filter.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Zurück
          </Button>
          <span className="text-sm text-muted-foreground">
            Seite {page} von {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isFetching}
          >
            Weiter
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── List Row ────────────────────────────────────────────────

function ListRow({ book, onClick }: { book: LocalBook; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const coverUrl = getCoverUrl(book);
  const author = getAuthorDisplay(book);

  const { data: cachedSummary } = trpc.summaries.getCached.useQuery(
    { gutenbergId: book.gutenbergId },
    { enabled: hovered, staleTime: Infinity }
  );

  const shortSummary = cachedSummary?.shortSummary ?? null;

  return (
    <div
      className="book-card flex gap-3 p-3 cursor-pointer group transition-colors duration-150"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Mini cover */}
      <div className="shrink-0 w-14 rounded overflow-hidden bg-muted" style={{ aspectRatio: "2/3" }}>
        {!imgError ? (
          <img
            src={coverUrl}
            alt={`Cover: ${book.title}`}
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <BookOpen className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3
          className="font-semibold text-sm leading-tight mb-0.5 line-clamp-2"
          style={{ fontFamily: "Lora, Georgia, serif" }}
        >
          {book.title}
        </h3>
        <p className="text-xs text-muted-foreground mb-1.5">{author}</p>
        {book.issued && (
          <p className="text-xs text-muted-foreground mb-1.5">
            {book.issued.substring(0, 4)}
          </p>
        )}

        {/* Summary — fades in on hover */}
        <div
          className={`overflow-hidden transition-all duration-200 ${
            hovered && shortSummary ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="flex items-start gap-1 pt-1">
            <Sparkles className="w-3 h-3 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/75 leading-relaxed line-clamp-3">
              {shortSummary}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListRowSkeleton() {
  return (
    <div className="book-card flex gap-3 p-3">
      <div className="skeleton shrink-0 w-14 rounded" style={{ aspectRatio: "2/3" }} />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-full rounded" />
      </div>
    </div>
  );
}
