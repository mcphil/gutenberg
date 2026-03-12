import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BookOpen, Download, Sparkles, Tag, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookCard, BookCardSkeleton } from "@/components/BookCard";
import { trpc } from "@/lib/trpc";
import {
  getAuthorDisplay, parseAuthors, getAuthorYears, getCoverUrl,
  parseSubjects, parseBookshelves, translateSubject
} from "../../../shared/gutenberg";
import { useRecentBooks, useReadingProgress } from "@/hooks/useLocalStorage";

interface BookDetailProps {
  bookId: number;
}

export default function BookDetail({ bookId }: BookDetailProps) {
  const [, navigate] = useLocation();
  const [imgError, setImgError] = useState(false);
  const { addRecentBook } = useRecentBooks();
  const { getProgress } = useReadingProgress();

  const { data: book, isLoading } = trpc.books.byId.useQuery({ id: bookId });
  const { data: cachedSummary } = trpc.summaries.getCached.useQuery({ gutenbergId: bookId });
  const { data: relatedBooks, isLoading: relatedLoading } = trpc.books.related.useQuery(
    { gutenbergId: bookId, count: 4 },
    { enabled: !!book, staleTime: 10 * 60 * 1000 }
  );

  const progress = getProgress(bookId);

  // Track recently viewed
  useEffect(() => {
    if (book) {
      addRecentBook({
        gutenbergId: book.gutenbergId,
        title: book.title,
        authors: getAuthorDisplay(book),
        coverUrl: getCoverUrl(book),
      });
    }
  }, [book?.gutenbergId]);

  const summary = cachedSummary
    ? {
        shortSummary: cachedSummary.shortSummary ?? "",
        longSummary: cachedSummary.longSummary ?? "",
      }
    : null;

  if (isLoading) {
    return <BookDetailSkeleton />;
  }

  if (!book) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        <p>Buch nicht gefunden.</p>
        <Button variant="link" onClick={() => navigate("/")}>Zurück zur Übersicht</Button>
      </div>
    );
  }

  const coverUrl = getCoverUrl(book);
  const authors = parseAuthors(book.authors);
  const subjects = parseSubjects(book.subjects);
  const bookshelves = parseBookshelves(book.bookshelves);

  return (
    <div className="container py-6 max-w-4xl mx-auto">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Zurück zur Übersicht
      </Button>

      <div className="flex flex-col sm:flex-row gap-8">
        {/* Cover */}
        <div className="shrink-0 sm:w-48 md:w-56">
          <div className="rounded-lg overflow-hidden shadow-lg border border-border bg-muted" style={{ aspectRatio: "2/3" }}>
            {!imgError ? (
              <img
                src={coverUrl}
                alt={`Cover: ${book.title}`}
                className="w-full h-full object-contain"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full bg-muted flex flex-col items-center justify-center p-4">
                <BookOpen className="w-10 h-10 text-muted-foreground mb-2" />
                <p className="text-xs text-center text-muted-foreground line-clamp-4"
                   style={{ fontFamily: "Lora, Georgia, serif" }}>
                  {book.title}
                </p>
              </div>
            )}
          </div>

          {/* Reading progress */}
          {progress && (
            <div className="mt-3 p-2 bg-muted/60 rounded-md">
              <p className="text-xs text-muted-foreground mb-1">Lesefortschritt</p>
              <div className="w-full bg-border rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.round(progress.percentage * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(progress.percentage * 100)}%
              </p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1
            className="text-2xl md:text-3xl font-semibold text-foreground leading-tight mb-3"
            style={{ fontFamily: "Lora, Georgia, serif" }}
          >
            {book.title}
          </h1>

          {/* Authors */}
          {authors.length > 0 ? authors.map((author) => (
            <div key={author.name} className="flex items-center gap-2 text-muted-foreground mb-1">
              <User className="w-4 h-4 shrink-0" />
              <span className="text-sm">
                {author.displayName}{" "}
                <span className="text-xs">{getAuthorYears(author)}</span>
              </span>
            </div>
          )) : (
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <User className="w-4 h-4 shrink-0" />
              <span className="text-sm">Unbekannter Autor</span>
            </div>
          )}

          {/* NOTE: book.issued is the Gutenberg upload date, NOT the original publication year — do not display it */}

          {/* Subjects */}
          {subjects.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Themen</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">
                    {translateSubject(s)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Bookshelves */}
          {bookshelves.length > 0 && (
            <div className="mb-5">
              <div className="flex flex-wrap gap-1.5">
                {bookshelves.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Summary section */}
          <div className="mb-6">
            {summary?.longSummary ? (
              <div className="bg-accent/30 border border-border rounded-lg p-4 mb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">KI-Zusammenfassung</span>
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  {summary.longSummary}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Für dieses Buch ist noch keine Zusammenfassung verfügbar.
              </p>
            )}
          </div>

          {/* CTA */}
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              className="gap-2"
              onClick={() => navigate(`/read/${book.gutenbergId}`)}
            >
              <BookOpen className="w-5 h-5" />
              {progress ? "Weiterlesen" : "Jetzt lesen"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={() => window.open(`https://www.gutenberg.org/ebooks/${book.gutenbergId}`, "_blank")}
            >
              <Download className="w-5 h-5" />
              Auf Gutenberg.org
            </Button>
          </div>
        </div>
      </div>

      {/* Ähnliche Bücher */}
      {(relatedLoading || (relatedBooks && relatedBooks.length > 0)) && (
        <div className="mt-10 pt-8 border-t border-border">
          <h2
            className="text-lg font-semibold text-foreground mb-5"
            style={{ fontFamily: "Lora, Georgia, serif" }}
          >
            Ähnliche Bücher
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {relatedLoading
              ? Array.from({ length: 4 }).map((_, i) => <BookCardSkeleton key={i} />)
              : relatedBooks?.map((related) => (
                  <BookCard
                    key={related.gutenbergId}
                    book={related as any}
                    onClick={() => navigate(`/book/${related.gutenbergId}`)}
                  />
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────

function BookDetailSkeleton() {
  return (
    <div className="container py-6 max-w-4xl mx-auto">
      <div className="skeleton h-8 w-32 rounded mb-6" />
      <div className="flex flex-col sm:flex-row gap-8">
        <div className="skeleton shrink-0 sm:w-48 md:w-56 rounded-lg" style={{ aspectRatio: "2/3" }} />
        <div className="flex-1 space-y-3">
          <div className="skeleton h-8 w-3/4 rounded" />
          <div className="skeleton h-4 w-1/2 rounded" />
          <div className="skeleton h-4 w-1/3 rounded" />
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-6 w-20 rounded-full" />)}
          </div>
          <div className="skeleton h-24 w-full rounded mt-4" />
          <div className="skeleton h-12 w-40 rounded mt-4" />
        </div>
      </div>
    </div>
  );
}
