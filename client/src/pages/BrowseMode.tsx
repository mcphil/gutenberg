import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  BookOpen, ChevronUp, ChevronDown, X, Sparkles, Loader2,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  getAuthorDisplay, getCoverUrl, parseSubjects, translateSubject,
  type LocalBook, isCopyrightProtectedDE
} from "../../../shared/gutenberg";

interface BrowseModeProps {
  onClose: () => void;
}

type CardState = "entering-from-bottom" | "entering-from-top" | "active" | "exiting-to-top" | "exiting-to-bottom";

export default function BrowseMode({ onClose }: BrowseModeProps) {
  const [, navigate] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [books, setBooks] = useState<LocalBook[]>([]);
  const [cardState, setCardState] = useState<CardState>("active");
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Rubber-band state: dragY = current drag offset in px
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);
  const isDragging = useRef(false);

  const { data, isFetching } = trpc.books.list.useQuery(
    { page, sort: "popular" },
    { staleTime: 10 * 60 * 1000 }
  );

  // Accumulate books across pages
  useEffect(() => {
    if (data?.books) {
      setBooks((prev) => {
        const existingIds = new Set(prev.map((b) => b.gutenbergId));
        const newBooks = data.books.filter((b) => !existingIds.has(b.gutenbergId));
        return [...prev, ...newBooks];
      });
    }
  }, [data]);

  // Pre-fetch next page when near end
  useEffect(() => {
    if (books.length > 0 && currentIndex >= books.length - 5 && data?.page && data?.pages && data.page < data.pages) {
      setPage((p) => p + 1);
    }
  }, [currentIndex, books.length, data]);

  const goTo = useCallback(
    (dir: "up" | "down") => {
      if (isTransitioning) return;
      const nextIndex = dir === "up" ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex < 0 || nextIndex >= books.length) return;

      setIsTransitioning(true);
      setDragY(0);
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
      }, 340);
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

  // Touch: rubber-band drag + swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || touchStartY.current === null || isTransitioning) return;
    const dy = touchStartY.current - e.touches[0].clientY;
    // Rubber-band: dampen the drag with a sqrt curve so it feels elastic
    const damped = Math.sign(dy) * Math.sqrt(Math.abs(dy)) * 4;
    setDragY(-damped);
  }, [isTransitioning]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === null) return;
      isDragging.current = false;
      const dy = touchStartY.current - e.changedTouches[0].clientY;
      const dt = Date.now() - touchStartTime.current;
      const velocity = Math.abs(dy) / dt;

      if (Math.abs(dy) > 50 || velocity > 0.3) {
        goTo(dy > 0 ? "up" : "down");
      } else {
        // Snap back with spring animation
        setDragY(0);
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
      onTouchMove={handleTouchMove}
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
          {books.length > 0 ? `${currentIndex + 1} / ${data?.total ?? books.length}` : ""}
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
          dragY={dragY}
          onRead={() => navigate(`/read/${currentBook.gutenbergId}`)}
          onDetail={() => navigate(`/book/${currentBook.gutenbergId}`)}
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

      {/* Swipe hint */}
      <SwipeHint />
    </div>
  );
}

// ─── Browse Card ─────────────────────────────────────────────

interface BrowseCardProps {
  book: LocalBook;
  state: CardState;
  dragY: number;
  onRead: () => void;
  onDetail: () => void;
}

function BrowseCard({ book, state, dragY, onRead, onDetail }: BrowseCardProps) {
  const [imgError, setImgError] = useState(false);
  const coverUrl = getCoverUrl(book);
  const author = getAuthorDisplay(book);
  const subjects = parseSubjects(book.subjects);
  const isProtected = isCopyrightProtectedDE(book.authors);

  const { data: cachedSummary } = trpc.summaries.getCached.useQuery({ gutenbergId: book.gutenbergId });
  const shortSummary = cachedSummary?.shortSummary ?? null;

  // Rubber-band: only apply dragY when in "active" state (not during transition)
  const isActive = state === "active";
  const extraTransform = isActive && dragY !== 0 ? ` translateY(${dragY}px)` : "";
  const rubberTransition = isActive && dragY === 0
    ? "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.34s ease"
    : isActive
    ? "none"
    : undefined;

  return (
    <div
      className={`browse-card ${state}`}
      style={
        isActive
          ? { transform: `translateY(0)${extraTransform}`, transition: rubberTransition ?? undefined }
          : undefined
      }
    >
      {/*
        Responsive layout:
        - Portrait / narrow (< ~640px wide OR aspect < 1): cover top, text bottom (flex-col)
        - Landscape / wide (>= 640px AND aspect >= 1): cover left, text right (flex-row)
        We use a CSS custom property trick via a container query-like approach with
        @media (orientation: landscape) and min-width.
      */}
      <div className="browse-inner">
        {/* Cover */}
        <div className="browse-cover">
          {!imgError ? (
            <img
              src={coverUrl}
              alt={`Cover: ${book.title}`}
              className="w-full h-full object-contain drop-shadow-xl"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-muted rounded-lg">
              <BookOpen className="w-12 h-12 text-muted-foreground mb-3" />
              <p
                className="text-base text-center font-medium text-foreground"
                style={{ fontFamily: "Lora, Georgia, serif" }}
              >
                {book.title}
              </p>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="browse-info">
          <h2
            className="text-xl sm:text-2xl font-semibold text-foreground leading-tight mb-1"
            style={{ fontFamily: "Lora, Georgia, serif" }}
          >
            {book.title}
          </h2>
          <p className="text-sm text-muted-foreground mb-3">{author}</p>

          {shortSummary ? (
            <div className="flex items-start gap-1.5 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm leading-relaxed text-foreground/80 line-clamp-5">
                {shortSummary}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic mb-4">
              Noch keine Zusammenfassung verfügbar.
            </p>
          )}

          {subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {subjects.slice(0, 4).map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {translateSubject(s)}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            {isProtected ? (
              <Button variant="outline" className="flex-1" onClick={onDetail}>
                Mehr Details
              </Button>
            ) : (
              <>
                <Button className="flex-1 gap-2" onClick={onRead}>
                  <BookOpen className="w-4 h-4" />
                  Lesen
                </Button>
                <Button variant="outline" className="flex-1" onClick={onDetail}>
                  Details
                </Button>
              </>
            )}
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
