import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { ReactReader, ReactReaderStyle } from "react-reader";
import type { Rendition } from "epubjs";
import {
  ArrowLeft, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight,
  Maximize2, Minimize2,
  Type, AlignJustify, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { useReadingProgress, useBookmarks, useReaderPreferences } from "@/hooks/useLocalStorage";
import { getEpubProxyUrl, getCoverUrlById, isCopyrightProtectedDE } from "../../../shared/gutenberg";

interface ReaderProps {
  bookId: number;
}

type ReaderTheme = "light" | "sepia" | "dark";

const THEME_STYLES: Record<ReaderTheme, {
  bg: string;
  scrollBg: string;
  text: string;
  label: string;
}> = {
  light: { bg: "#FEFDFB", scrollBg: "#EAE5DC", text: "#2D2416", label: "Hell" },
  sepia: { bg: "#F4ECD8", scrollBg: "#DDD3BC", text: "#3B2F1E", label: "Sepia" },
  dark:  { bg: "#242220", scrollBg: "#111110", text: "#E8E0D4", label: "Dunkel" },
};

export default function Reader({ bookId }: ReaderProps) {
  const [, navigate] = useLocation();
  const { prefs, updatePref } = useReaderPreferences();
  const { saveProgress, getProgress } = useReadingProgress();
  const { addBookmark, getBookmarksForBook, removeBookmark } = useBookmarks();

  // location is only used for initial positioning; in scroll mode we don't
  // feed it back from the relocated event to avoid the jump-back loop.
  const [location, setLocation] = useState<string | number>(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const [bookCover, setBookCover] = useState("");

  const renditionRef = useRef<Rendition | null>(null);
  const locationRef = useRef<string | number>(0);
  // Prevents the scroll-restore from running more than once per mount
  const scrollRestoredRef = useRef(false);
  // Debounce timer for scroll-position saving
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isScrollMode = prefs.readingMode === "scroll";

  const { data: book } = trpc.books.byId.useQuery({ id: bookId });

  // Load saved position once on mount
  useEffect(() => {
    const saved = getProgress(bookId);
    if (saved?.cfi) {
      setLocation(saved.cfi);
      locationRef.current = saved.cfi;
    }
    // Reset restore flag when bookId changes
    scrollRestoredRef.current = false;
  }, [bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (book) {
      setBookTitle(book.title);
      setBookCover(getCoverUrlById(bookId));
      // § 64 UrhG: redirect to book detail if still under copyright in Germany
      if (isCopyrightProtectedDE(book.authors, new Date().getFullYear(), book.copyrightProtectedUntil)) {
        navigate(`/book/${bookId}`);
      }
    }
  }, [book, bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build CSS injected into the EPUB iframe
  const getEpubStyles = useCallback(() => {
    const theme = THEME_STYLES[prefs.theme];
    const fontFamily =
      prefs.fontFamily === "serif"
        ? "'Merriweather', 'Georgia', serif"
        : "'Inter', 'system-ui', sans-serif";
    const isScroll = prefs.readingMode === "scroll";

    return {
      body: {
        background: theme.bg,
        color: theme.text,
        "font-family": fontFamily,
        "font-size": `${prefs.fontSize}px !important`,
        "line-height": `${prefs.lineHeight} !important`,
        "max-width": isScroll ? "100ch" : `${prefs.maxWidth}px`,
        margin: "0 auto",
        padding: isScroll ? "3rem 2rem 6rem" : "2rem 1.5rem",
        "box-shadow": isScroll ? "0 0 0 1px rgba(0,0,0,0.06), 0 2px 24px rgba(0,0,0,0.08)" : "none",
      },
      html: isScroll ? { background: theme.scrollBg } : {},
      p: {
        "font-size": `${prefs.fontSize}px !important`,
        "line-height": `${prefs.lineHeight} !important`,
        "margin-bottom": "1em",
        "text-align": "justify",
        hyphens: "auto",
      },
      h1: { "font-size": `${prefs.fontSize * 1.6}px !important`, "margin-bottom": "0.75em", "font-family": "'Lora', 'Georgia', serif" },
      h2: { "font-size": `${prefs.fontSize * 1.35}px !important`, "margin-bottom": "0.6em", "font-family": "'Lora', 'Georgia', serif" },
      h3: { "font-size": `${prefs.fontSize * 1.15}px !important`, "margin-bottom": "0.5em" },
      a: { color: prefs.theme === "dark" ? "#C8A97E" : "#7B4F2E" },
    };
  }, [prefs]);

  const applyStyles = useCallback(
    (rendition: Rendition) => {
      rendition.themes.default(getEpubStyles());
    },
    [getEpubStyles]
  );

  const handleRendition = useCallback(
    (rendition: Rendition) => {
      renditionRef.current = rendition;
      applyStyles(rendition);

      rendition.book.ready.then(() => {
        rendition.book.locations.generate(1024).catch(() => {});
      }).catch(() => {});

      rendition.on("relocated", (loc: { start: { cfi: string; percentage: number } }) => {
        const cfi = loc.start.cfi;
        const pct = loc.start.percentage ?? 0;
        locationRef.current = cfi;

        // In scroll mode: do NOT call setLocation — that would cause ReactReader
        // to jump back to the CFI on every scroll step.
        // In paginated mode: update location so prev/next arrows work correctly.
        if (!isScrollMode) {
          setCurrentPage(Math.round(pct * 100));
          saveProgress(bookId, cfi, pct, bookTitle, bookCover);
        }

        const bms = getBookmarksForBook(bookId);
        setIsBookmarked(bms.some((b) => b.cfi === cfi));
      });

      // Scroll mode: attach scroll listener once after first render
      if (isScrollMode) {
        const onRendered = () => {
          try {
            const contents = rendition.getContents();
            const doc = (contents as unknown as Array<{ document: Document }>)?.[0]?.document;
            const scrollEl = doc?.scrollingElement ?? doc?.documentElement;
            if (!scrollEl) return;

            // Restore saved scrollTop exactly once
            if (!scrollRestoredRef.current) {
              scrollRestoredRef.current = true;
              const saved = getProgress(bookId);
              if (saved?.scrollTop && saved.scrollTop > 0) {
                setTimeout(() => {
                  scrollEl.scrollTop = saved.scrollTop!;
                }, 200);
              }
            }

            // Throttled scroll → save progress every 2 s
            const onScroll = () => {
              if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current);
              scrollSaveTimerRef.current = setTimeout(() => {
                const st = scrollEl.scrollTop;
                const cfi = typeof locationRef.current === "string" ? locationRef.current : "";
                const pct = scrollEl.scrollHeight > 0 ? st / scrollEl.scrollHeight : 0;
                setCurrentPage(Math.round(pct * 100));
                saveProgress(bookId, cfi, pct, bookTitle, bookCover, st);
              }, 2000);
            };

            // Remove any previously attached listener before adding a new one
            scrollEl.removeEventListener("scroll", onScroll);
            scrollEl.addEventListener("scroll", onScroll, { passive: true });
          } catch {
            // ignore cross-origin or timing errors
          }
        };

        rendition.on("rendered", onRendered);
      }
    },
    [applyStyles, bookId, bookTitle, bookCover, saveProgress, getBookmarksForBook, isScrollMode, getProgress]
  );

  // Re-apply styles when preferences change (font, theme, size…)
  useEffect(() => {
    if (renditionRef.current) {
      applyStyles(renditionRef.current);
    }
  }, [prefs, applyStyles]);

  // In paginated mode: locationChanged feeds back into state for prev/next nav
  // In scroll mode: we only update the ref, never the state, to prevent jumps
  const handleLocationChange = useCallback((loc: string | number) => {
    locationRef.current = loc;
    if (!isScrollMode) {
      setLocation(loc);
    }
  }, [isScrollMode]);

  const handleToggleBookmark = useCallback(() => {
    const cfi = typeof locationRef.current === "string" ? locationRef.current : "";
    if (!cfi) return;
    const bms = getBookmarksForBook(bookId);
    const existing = bms.find((b) => b.cfi === cfi);
    if (existing) {
      removeBookmark(existing.id);
      setIsBookmarked(false);
    } else {
      addBookmark(bookId, cfi, `Seite ~${currentPage}%`);
      setIsBookmarked(true);
    }
  }, [bookId, currentPage, addBookmark, removeBookmark, getBookmarksForBook]);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleToggleMode = useCallback(() => {
    // Reset restore flag so the new mode can restore its own position
    scrollRestoredRef.current = false;
    updatePref("readingMode", prefs.readingMode === "scroll" ? "paginated" : "scroll");
  }, [prefs.readingMode, updatePref]);

  const epubUrl = getEpubProxyUrl(bookId);
  const theme = THEME_STYLES[prefs.theme];
  const isScroll = prefs.readingMode === "scroll";
  const outerBg = isScroll ? theme.scrollBg : theme.bg;

  if (!epubUrl && book) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-muted-foreground">
        <p>Kein EPUB für dieses Buch verfügbar.</p>
        <Button variant="outline" onClick={() => navigate(`/book/${bookId}`)}>
          Zurück zur Buchdetailseite
        </Button>
      </div>
    );
  }

  const readerStyle: typeof ReactReaderStyle = {
    ...ReactReaderStyle,
    readerArea: {
      ...ReactReaderStyle.readerArea,
      background: outerBg,
      transition: "background 0.3s ease",
    },
    container: {
      ...ReactReaderStyle.container,
      background: outerBg,
    },
    titleArea: {
      display: "none",
    },
    tocArea: {
      ...ReactReaderStyle.tocArea,
      background: prefs.theme === "dark" ? "#252320" : "#F5F0E8",
    },
    tocButtonExpanded: {
      ...ReactReaderStyle.tocButtonExpanded,
      background: prefs.theme === "dark" ? "#252320" : "#F5F0E8",
    },
    tocButton: {
      ...ReactReaderStyle.tocButton,
      color: theme.text,
    },
    arrow: {
      ...ReactReaderStyle.arrow,
      color: isScroll ? "transparent" : theme.text,
      pointerEvents: isScroll ? "none" : "auto",
    } as React.CSSProperties,
    arrowHover: {
      ...ReactReaderStyle.arrowHover,
      color: isScroll ? "transparent" : (prefs.theme === "dark" ? "#C8A97E" : "#7B4F2E"),
    } as React.CSSProperties,
  };

  return (
    <div
      className="flex flex-col"
      style={{ height: "100dvh", background: outerBg, color: theme.text }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b shrink-0"
        style={{
          background: prefs.theme === "dark" ? "#252320" : "#F5F0E8",
          borderColor: prefs.theme === "dark" ? "#3A3630" : "#E0D8CC",
        }}
      >
        <Button
          variant="ghost" size="icon" className="h-8 w-8 shrink-0"
          style={{ color: theme.text }}
          onClick={() => navigate(`/book/${bookId}`)}
          aria-label="Zurück"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        {/* Prev arrow (paginated only) */}
        {!isScroll && (
          <Button
            variant="ghost" size="icon" className="h-8 w-8 shrink-0"
            style={{ color: theme.text }}
            onClick={() => renditionRef.current?.prev()}
            aria-label="Vorherige Seite"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}

        <p
          className="flex-1 text-sm font-medium truncate"
          style={{ fontFamily: "Lora, Georgia, serif", color: theme.text }}
        >
          {bookTitle || "Lädt…"}
        </p>

        <span className="text-xs shrink-0" style={{ color: `${theme.text}99` }}>
          {currentPage}%
        </span>

        {/* Next arrow (paginated only) */}
        {!isScroll && (
          <Button
            variant="ghost" size="icon" className="h-8 w-8 shrink-0"
            style={{ color: theme.text }}
            onClick={() => renditionRef.current?.next()}
            aria-label="Nächste Seite"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}

        {/* Mode toggle */}
        <Button
          variant="ghost" size="icon" className="h-8 w-8 shrink-0"
          style={{ color: theme.text }}
          onClick={handleToggleMode}
          title={isScroll ? "Zu Blätter-Modus wechseln" : "Zu Scroll-Modus wechseln"}
          aria-label={isScroll ? "Zu Blätter-Modus wechseln" : "Zu Scroll-Modus wechseln"}
        >
          {isScroll ? <BookOpen className="w-4 h-4" /> : <AlignJustify className="w-4 h-4" />}
        </Button>

        {/* Bookmark */}
        <Button
          variant="ghost" size="icon" className="h-8 w-8 shrink-0"
          style={{ color: theme.text }}
          onClick={handleToggleBookmark}
          aria-label={isBookmarked ? "Lesezeichen entfernen" : "Lesezeichen setzen"}
        >
          {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </Button>

        {/* Settings */}
        <Popover open={showSettings} onOpenChange={setShowSettings}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost" size="icon" className="h-8 w-8 shrink-0"
              style={{ color: theme.text }}
              aria-label="Leseeinstellungen"
            >
              <Type className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4" align="end">
            <ReaderSettings prefs={prefs} updatePref={updatePref} />
          </PopoverContent>
        </Popover>

        {/* Fullscreen */}
        <Button
          variant="ghost" size="icon" className="h-8 w-8 shrink-0 hidden sm:flex"
          style={{ color: theme.text }}
          onClick={handleFullscreen}
          aria-label={isFullscreen ? "Vollbild beenden" : "Vollbild"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 shrink-0" style={{ background: prefs.theme === "dark" ? "#3A3630" : "#E0D8CC" }}>
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${currentPage}%`,
            background: prefs.theme === "dark" ? "#C8A97E" : "#7B4F2E",
          }}
        />
      </div>

      {/* EPUB Reader */}
      <div className="flex-1 min-h-0">
        {epubUrl && (
          <ReactReader
            key={prefs.readingMode}
            url={epubUrl}
            location={location}
            locationChanged={handleLocationChange}
            getRendition={handleRendition}
            readerStyles={readerStyle}
            epubOptions={{
              flow: isScroll ? "scrolled-doc" : "paginated",
              // Do NOT use manager:"continuous" — it causes instability in react-reader
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Reader Settings Panel ───────────────────────────────────

interface ReaderSettingsProps {
  prefs: ReturnType<typeof useReaderPreferences>["prefs"];
  updatePref: ReturnType<typeof useReaderPreferences>["updatePref"];
}

function ReaderSettings({ prefs, updatePref }: ReaderSettingsProps) {
  const isScroll = prefs.readingMode === "scroll";

  return (
    <div className="space-y-5">
      <h3 className="font-semibold text-sm">Leseeinstellungen</h3>

      {/* Theme */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Hintergrund</p>
        <div className="flex gap-2">
          {(["light", "sepia", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => updatePref("theme", t)}
              className={`flex-1 py-1.5 rounded text-xs font-medium border transition-all ${
                prefs.theme === t ? "ring-2 ring-primary" : ""
              }`}
              style={{
                background: THEME_STYLES[t].bg,
                color: THEME_STYLES[t].text,
                borderColor: THEME_STYLES[t].text + "33",
              }}
            >
              {THEME_STYLES[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Font family */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Schrift</p>
        <div className="flex gap-2">
          {(["serif", "sans"] as const).map((f) => (
            <button
              key={f}
              onClick={() => updatePref("fontFamily", f)}
              className={`flex-1 py-1.5 rounded text-xs border transition-all ${
                prefs.fontFamily === f ? "ring-2 ring-primary bg-primary/10" : "bg-muted"
              }`}
              style={{ fontFamily: f === "serif" ? "Merriweather, Georgia, serif" : "Inter, system-ui, sans-serif" }}
            >
              {f === "serif" ? "Serif" : "Sans-Serif"}
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Schriftgröße</p>
          <span className="text-xs text-muted-foreground">{prefs.fontSize}px</span>
        </div>
        <Slider
          min={14} max={24} step={1}
          value={[prefs.fontSize]}
          onValueChange={([v]) => updatePref("fontSize", v)}
        />
      </div>

      {/* Line height */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Zeilenabstand</p>
          <span className="text-xs text-muted-foreground">{prefs.lineHeight.toFixed(2)}</span>
        </div>
        <Slider
          min={1.4} max={2.0} step={0.05}
          value={[prefs.lineHeight]}
          onValueChange={([v]) => updatePref("lineHeight", v)}
        />
      </div>

      {/* Max width — only meaningful in paginated mode */}
      {!isScroll && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Textbreite</p>
            <span className="text-xs text-muted-foreground">{prefs.maxWidth}px</span>
          </div>
          <Slider
            min={600} max={900} step={20}
            value={[prefs.maxWidth]}
            onValueChange={([v]) => updatePref("maxWidth", v)}
          />
        </div>
      )}
    </div>
  );
}
