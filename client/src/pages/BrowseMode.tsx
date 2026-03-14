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
  getAuthorDisplay, parseSubjects, translateSubject,
  type LocalBook, isCopyrightProtectedDE
} from "../../../shared/gutenberg";

interface BrowseModeProps {
  onClose: () => void;
}

export default function BrowseMode({ onClose }: BrowseModeProps) {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const [books, setBooks] = useState<LocalBook[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Prevent the scroll-listener from fighting programmatic scrolls
  const programmaticScroll = useRef(false);

  const { data } = trpc.books.list.useQuery(
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
    if (
      books.length > 0 &&
      currentIndex >= books.length - 5 &&
      data?.page && data?.pages && data.page < data.pages
    ) {
      setPage((p) => p + 1);
    }
  }, [currentIndex, books.length, data]);

  // Scroll to a specific index programmatically
  const scrollToIndex = useCallback((idx: number) => {
    const container = scrollRef.current;
    if (!container) return;
    programmaticScroll.current = true;
    container.scrollTo({ top: idx * container.clientHeight, behavior: "smooth" });
    setCurrentIndex(idx);
    // Release lock after animation
    setTimeout(() => { programmaticScroll.current = false; }, 600);
  }, []);

  // Track current index from native scroll position
  const handleScroll = useCallback(() => {
    if (programmaticScroll.current) return;
    const container = scrollRef.current;
    if (!container) return;
    const idx = Math.round(container.scrollTop / container.clientHeight);
    setCurrentIndex(idx);
  }, []);

  // Keyboard navigation
  const goTo = useCallback((dir: "up" | "down") => {
    const next = dir === "up" ? currentIndex + 1 : currentIndex - 1;
    if (next < 0 || next >= books.length) return;
    scrollToIndex(next);
  }, [currentIndex, books.length, scrollToIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") goTo("up");
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") goTo("down");
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goTo, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-hidden flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-background/90 to-transparent pointer-events-none">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5 pointer-events-auto">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Zurück</span>
        </Button>
        <div className="text-xs text-muted-foreground">
          {books.length > 0 ? `${currentIndex + 1} / ${data?.total ?? books.length}` : ""}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="pointer-events-auto">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Scroll-snap container — each child is exactly 100vh */}
      {books.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="browse-scroll-container"
          onScroll={handleScroll}
        >
          {books.map((book, i) => (
            <BrowseSlide
              key={book.gutenbergId}
              book={book}
              onRead={() => navigate(`/read/${book.gutenbergId}`)}
              onDetail={() => navigate(`/book/${book.gutenbergId}`)}
              isVisible={Math.abs(i - currentIndex) <= 1}
            />
          ))}
        </div>
      )}

      {/* Navigation arrows */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-md"
          onClick={() => goTo("down")}
          disabled={currentIndex === 0}
          aria-label="Vorheriges Buch"
        >
          <ChevronUp className="w-5 h-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-md"
          onClick={() => goTo("up")}
          disabled={currentIndex >= books.length - 1}
          aria-label="Nächstes Buch"
        >
          <ChevronDown className="w-5 h-5" />
        </Button>
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 pointer-events-none">
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

// ─── Individual slide ─────────────────────────────────────────

interface BrowseSlideProps {
  book: LocalBook;
  onRead: () => void;
  onDetail: () => void;
  isVisible: boolean;
}

function BrowseSlide({ book, onRead, onDetail, isVisible }: BrowseSlideProps) {
  const slideRef = useRef<HTMLDivElement>(null);
  const [opacity, setOpacity] = useState(1);
  const author = getAuthorDisplay(book);
  const subjects = parseSubjects(book.subjects);
  const isProtected = isCopyrightProtectedDE(book.authors, new Date().getFullYear(), book.copyrightProtectedUntil);

  // shortSummary is now included in the book list response via LEFT JOIN (no extra query needed)
  const shortSummary = book.shortSummary ?? null;

  // Fade based on how much of the slide is visible
  useEffect(() => {
    const el = slideRef.current;
    if (!el) return;
    // Use many threshold steps for a smooth fade curve
    const thresholds = Array.from({ length: 21 }, (_, i) => i / 20);
    const observer = new IntersectionObserver(
      ([entry]) => {
        // ratio 1.0 = fully visible (opaque), 0.0 = fully hidden (transparent)
        // We start fading at 0.85 so the effect is subtle but noticeable
        const ratio = entry.intersectionRatio;
        const fade = ratio >= 0.85 ? 1 : ratio / 0.85;
        setOpacity(fade);
      },
      {
        root: el.parentElement, // the scroll container
        threshold: thresholds,
      }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={slideRef} className="browse-slide" style={{ opacity, transition: "opacity 0.15s ease" }}>
      <div className="browse-inner">
        {/* Cover */}
        <div className="browse-cover">
          <figure className="m-0 drop-shadow-xl">
            <img
              src={`/api/covers/${book.gutenbergId}`}
              alt={`Cover von ${book.title}`}
              className="block rounded"
              loading="eager"
              decoding="async"
              width={400}
              height={560}
            />
          </figure>
        </div>

        {/* Info */}
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
