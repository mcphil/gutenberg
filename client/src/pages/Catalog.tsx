import { useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { BookCard, BookCardSkeleton } from "@/components/BookCard";
import { FilterPanel } from "@/components/FilterPanel";
import { ChevronLeft, ChevronRight, Sparkles, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAuthorDisplay, translateSubject, type LocalBook } from "../../../shared/gutenberg";

interface CatalogProps {
  view: "grid" | "list";
  searchQuery: string;
}

type SortBy = "popular" | "ascending" | "descending" | "random";

/** Read all catalog params from the current URL search string */
function useCatalogParams() {
  const search = useSearch();
  const params = new URLSearchParams(search);

  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const sortBy = (params.get("sort") ?? "random") as SortBy;
  const selectedSubject = params.get("topic") ?? "";
  const selectedTag = params.get("subject") ?? "";

  return { page, sortBy, selectedSubject, selectedTag, params };
}

export default function Catalog({ view, searchQuery }: CatalogProps) {
  const [, navigate] = useLocation();
  const { page, sortBy, selectedSubject, selectedTag } = useCatalogParams();

  /** Push a new URL that merges the given param changes, resetting page to 1 unless explicitly set */
  const setParams = useCallback(
    (updates: Record<string, string | null>, resetPage = true) => {
      // Start from the current URL params so we don't lose unrelated params
      const current = new URLSearchParams(window.location.search);
      if (resetPage) current.set("page", "1");
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          current.delete(key);
        } else {
          current.set(key, value);
        }
      }
      // Remove page=1 from URL to keep it clean
      if (current.get("page") === "1") current.delete("page");
      const qs = current.toString();
      navigate(qs ? `/?${qs}` : "/", { replace: false });
    },
    [navigate]
  );

  const handleSortChange = useCallback(
    (v: SortBy) => setParams({ sort: v === "random" ? null : v }),
    [setParams]
  );

  const handleSubjectChange = useCallback(
    (s: string) => setParams({ topic: s || null }),
    [setParams]
  );

  const handleTagRemove = useCallback(
    () => setParams({ subject: null }),
    [setParams]
  );

  const handlePageChange = useCallback(
    (newPage: number) => setParams({ page: String(newPage) }, false),
    [setParams]
  );

  const { data, isLoading, isFetching } = trpc.books.list.useQuery(
    {
      page,
      search: searchQuery || undefined,
      topic: selectedSubject || undefined,
      subject: selectedTag || undefined,
      sort: sortBy,
    },
    { staleTime: 5 * 60 * 1000 }
  );

  const books = data?.books ?? [];
  const totalCount = data?.total ?? 0;
  const totalPages = data?.pages ?? 0;

  const handleBookClick = useCallback(
    (book: LocalBook) => navigate(`/book/${book.gutenbergId}`),
    [navigate]
  );

  const skeletonCount = view === "grid" ? 25 : 8;

  return (
    <div>
      {/* Active subject tag banner */}
      {selectedTag && (
        <div className="flex items-center gap-2 py-2 px-1 mb-1">
          <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Thema:</span>
          <Badge variant="secondary" className="text-xs gap-1">
            {translateSubject(selectedTag)}
            <button
              onClick={handleTagRemove}
              className="ml-0.5 hover:text-destructive transition-colors"
              aria-label="Filter entfernen"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        </div>
      )}

      <FilterPanel
        sortBy={sortBy}
        onSortChange={handleSortChange}
        selectedSubject={selectedSubject}
        onSubjectChange={handleSubjectChange}
        totalCount={totalCount}
        isLoading={isLoading}
      />

      {/* Book grid / list */}
      <div className={`py-6 ${view === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4" : "flex flex-col gap-3"}`}>
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
            onClick={() => handlePageChange(Math.max(1, page - 1))}
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
            onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
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
  const author = getAuthorDisplay(book);
  // shortSummary is included in the book list response via LEFT JOIN (no extra query needed)
  const shortSummary = book.shortSummary ?? null;

  return (
    <div
      className="book-card flex gap-3 p-3 cursor-pointer group transition-colors duration-150"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {/* Mini cover */}
      <div className="shrink-0 w-14 rounded overflow-hidden aspect-book">
        <figure className="w-full h-full m-0">
          <img
            src={`/api/covers/${book.gutenbergId}`}
            alt={`Cover von ${book.title}`}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            width={56}
            height={84}
          />
        </figure>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3
          className="font-semibold text-sm leading-tight mb-0.5 line-clamp-2 font-lora"
        >
          {book.title}
        </h3>
        <p className="text-xs text-muted-foreground mb-1.5">{author}</p>
        {/* NOTE: book.issued is the Gutenberg upload date, NOT the original publication year — do not display it */}

        {/* Summary — fades in on hover */}
        {shortSummary && (
          <div className="overflow-hidden max-h-0 opacity-0 group-hover:max-h-20 group-hover:opacity-100 transition-all duration-200">
            <div className="flex items-start gap-1 pt-1">
              <Sparkles className="w-3 h-3 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground/75 leading-relaxed line-clamp-3">
                {shortSummary}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ListRowSkeleton() {
  return (
    <div className="book-card flex gap-3 p-3">
      <div className="skeleton shrink-0 w-14 rounded aspect-book" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-full rounded" />
      </div>
    </div>
  );
}
