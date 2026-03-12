import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  BookOpen, ChevronUp, ChevronDown, X, Sparkles, Loader2,
  Download, Tag, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  getAuthorDisplay, getCoverUrl, getEpubUrl, translateSubject,
  type GutenbergBook
} from "../../../shared/gutenberg";

interface BrowseModeProps {
  onClose: () => void;
}

type CardState = "entering-from-bottom" | "entering-from-top" | "active" | "exiting-to-top" | "exiting-to-bottom";

export default function BrowseMode({ onClose }: BrowseModeProps) {
  const [, navigate] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [books, setBooks] = useState<GutenbergBook[]>([]);
  const [cardState, setCardState] = useState<CardState>("active");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [direction, setDirection] = useState<"up" | "down">("up");

  // Touch tracking
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);

  const { data, isFetching } = trpc.books.list.useQuery(
    { page, sort: "popular" },
    { staleTime: 10 * 60 * 1000 }
  );

  // Accumulate books across pages
  useEffect(() => {
    if (data?.results) {
      setBooks((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        const newBooks = data.results.filter((b) => !existingIds.has(b.id));
        return [...prev, ...newBooks];
      });
    }
  }, [data]);

  // Pre-fetch next page when near end
  useEffect(() => {
    if (books.length > 0 && currentIndex >= books.length - 5 && data?.next) {
      setPage((p) => p + 1);
    }
  }, [currentIndex, books.length, data?.next]);

  const goTo = useCallback(
    (dir: "up" | "down") => {
      if (isTransitioning) return;
      const nextIndex = dir === "up" ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex < 0 || nextIndex >= books.length) return;

      setDirection(dir);
      setIsTransitioning(true);
      setCardState(dir === "up" ? "exiting-to-top" : "exiting-to-bottom");

      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setCardState(dir === "up" ? "entering-from-bottom" : "entering-from-top");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setCardState("active");
            setIsTransitioning(false);
          });
        });
      }, 380);
    },
    [isTransitioning, currentIndex, books.length]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") goTo("up");
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") goTo("down");
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goTo, onClose]);

  // Wheel navigation
  const wheelAccum = useRef(0);
  const wheelTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      wheelAccum.current += e.deltaY;
      clearTimeout(wheelTimeout.current);
      wheelTimeout.current = setTimeout(() => {
        if (Math.abs(wheelAccum.current) > 40) {
          goTo(wheelAccum.current > 0 ? "up" : "down");
        }
        wheelAccum.current = 0;
      }, 50);
    },
    [goTo]
  );

  // Touch navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === null) return;
      const dy = touchStartY.current - e.changedTouches[0].clientY;
      const dt = Date.now() - touchStartTime.current;
      const velocity = Math.abs(dy) / dt;
      if (Math.abs(dy) > 50 || velocity > 0.3) {
        goTo(dy > 0 ? "up" : "down");
      }
      touchStartY.current = null;
    },
    [goTo]
  );

  const currentBook = books[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 bg-background overflow-hidden"
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: "none" }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-background/90 to-transparent">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Zurück</span>
        </Button>
        <div className="text-xs text-muted-foreground">
          {books.length > 0 ? `${currentIndex + 1} / ${data?.count ?? books.length}` : ""}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Main card */}
      {currentBook ? (
        <BrowseCard
          book={currentBook}
          state={cardState}
          onRead={() => navigate(`/read/${currentBook.id}`)}
          onDetail={() => navigate(`/book/${currentBook.id}`)}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Navigation arrows */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-md"
          onClick={() => goTo("down")}
          disabled={currentIndex === 0 || isTransitioning}
          aria-label="Vorheriges Buch"
        >
          <ChevronUp className="w-5 h-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-md"
          onClick={() => goTo("up")}
          disabled={currentIndex >= books.length - 1 || isTransitioning}
          aria-label="Nächstes Buch"
        >
          <ChevronDown className="w-5 h-5" />
        </Button>
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {Array.from({ length: Math.min(7, books.length) }).map((_, i) => {
          const dotIndex = Math.max(0, Math.min(books.length - 7, currentIndex - 3)) + i;
          return (
            <div
              key={dotIndex}
              className={`rounded-full transition-all duration-200 ${
                dotIndex === currentIndex
                  ? "w-4 h-2 bg-primary"
                  : "w-2 h-2 bg-muted-foreground/40"
              }`}
            />
          );
        })}
      </div>

      {/* Swipe hint — shown briefly */}
      <SwipeHint />
    </div>
  );
}

// ─── Browse Card ─────────────────────────────────────────────

interface BrowseCardProps {
  book: GutenbergBook;
  state: CardState;
  onRead: () => void;
  onDetail: () => void;
}

function BrowseCard({ book, state, onRead, onDetail }: BrowseCardProps) {
  const [imgError, setImgError] = useState(false);
  const [summaryRequested, setSummaryRequested] = useState(false);
  const coverUrl = getCoverUrl(book);
  const author = getAuthorDisplay(book);
  const epubUrl = getEpubUrl(book);

  const { data: cachedSummary } = trpc.summaries.getCached.useQuery({ gutenbergId: book.id });
  const generateSummary = trpc.summaries.generate.useMutation();

  // Only use AI-generated or cached summaries — never the English Gutenberg fallback
  const shortSummary =
    generateSummary.data?.shortSummary ||
    cachedSummary?.shortSummary ||
    null;

  const handleGetSummary = () => {
    setSummaryRequested(true);
    generateSummary.mutate({
      gutenbergId: book.id,
      title: book.title,
      authors: book.authors,
      subjects: book.subjects,
      existingSummary: book.summaries?.[0],
      type: "short",
    });
  };

  return (
    <div className={`browse-card ${state}`}>
      {/* Full-height layout: cover + info */}
      <div className="flex flex-col h-full">
        {/* Cover — takes ~55% of height */}
        <div
          className="relative flex-shrink-0 overflow-hidden bg-muted"
          style={{ height: "55vh" }}
        >
          {!imgError ? (
            <img
              src={coverUrl}
              alt={`Cover: ${book.title}`}
              className="w-full h-full object-contain bg-muted"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8">
              <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
              <p
                className="text-xl text-center font-medium text-foreground"
                style={{ fontFamily: "Lora, Georgia, serif" }}
              >
                {book.title}
              </p>
            </div>
          )}
          {/* Gradient overlay at bottom of cover */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* Info panel — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-16 pt-2 max-w-2xl mx-auto w-full">
          <h2
            className="text-xl sm:text-2xl font-semibold text-foreground leading-tight mb-1"
            style={{ fontFamily: "Lora, Georgia, serif" }}
          >
            {book.title}
          </h2>
          <p className="text-sm text-muted-foreground mb-3">{author}</p>

          {/* Summary */}
          {shortSummary ? (
            <p className="text-sm leading-relaxed text-foreground/80 mb-4">
              {shortSummary}
            </p>
          ) : (
            <div className="mb-4">
              {generateSummary.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Zusammenfassung wird generiert…
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleGetSummary}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Kurzzusammenfassung
                </Button>
              )}
            </div>
          )}

          {/* Subjects */}
          {book.subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {book.subjects.slice(0, 4).map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {translateSubject(s)}
                </Badge>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-5">
            <span className="flex items-center gap-1">
              <Download className="w-3.5 h-3.5" />
              {book.download_count.toLocaleString("de-DE")} Downloads
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {epubUrl && (
              <Button className="flex-1 gap-2" onClick={onRead}>
                <BookOpen className="w-4 h-4" />
                Lesen
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={onDetail}>
              Mehr Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Swipe Hint ──────────────────────────────────────────────

function SwipeHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 pointer-events-none animate-pulse">
      <ChevronUp className="w-5 h-5 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">Wischen zum Blättern</p>
      <ChevronDown className="w-5 h-5 text-muted-foreground" />
    </div>
  );
}
