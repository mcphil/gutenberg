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
import ScrollReader from "@/components/ScrollReader";

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
  light: { bg: "#FEFDFB", scrollBg: "#FEFDFB", text: "#2D2416", label: "Hell" },
  sepia: { bg: "#F4ECD8", scrollBg: "#F4ECD8", text: "#3B2F1E", label: "Sepia" },
  dark:  { bg: "#242220", scrollBg: "#242220", text: "#E8E0D4", label: "Dunkel" },
};

export default function Reader({ bookId }: ReaderProps) {
  const [, navigate] = useLocation();
  const { prefs, updatePref } = useReaderPreferences();
  const { saveProgress, getProgress } = useReadingProgress();
  const { addBookmark, getBookmarksForBook, removeBookmark } = useBookmarks();

  const [location, setLocation] = useState<string | number>(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const [bookCover, setBookCover] = useState("");

  const renditionRef = useRef<Rendition | null>(null);
  const locationRef = useRef<string | number>(0);

  const isScrollMode = prefs.readingMode === "scroll";

  const { data: book } = trpc.books.byId.useQuery({ id: bookId });

  // Saved position for initial load
  const savedProgress = getProgress(bookId);
  const initialCfi = savedProgress?.cfi ?? undefined;
  const initialScrollTop = savedProgress?.scrollTop ?? 0;

  // Load saved position once on mount (for paginated mode)
  useEffect(() => {
    const saved = getProgress(bookId);
    if (saved?.cfi) {
      setLocation(saved.cfi);
      locationRef.current = saved.cfi;
    }
  }, [bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (book) {
      setBookTitle(book.title);
      setBookCover(getCoverUrlById(bookId));
      if (isCopyrightProtectedDE(book.authors, new Date().getFullYear(), book.copyrightProtectedUntil)) {
        navigate(`/book/${bookId}`);
      }
    }
  }, [book, bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Paginated mode: epub styles ──────────────────────────────
  const getPaginatedStyles = useCallback(() => {
    const theme = THEME_STYLES[prefs.theme];
    const fontFamily =
      prefs.fontFamily === "serif"
        ? "'Merriweather', 'Georgia', serif"
        : "'Inter', 'system-ui', sans-serif";

    return {
      body: {
        background: theme.bg,
        color: theme.text,
        "font-family": fontFamily,
        "font-size": `${prefs.fontSize}px !important`,
        "line-height": `${prefs.lineHeight} !important`,
        "max-width": `${prefs.maxWidth}px`,
        margin: "0 auto",
        padding: "2rem 1.5rem",
      },
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

  const applyPaginatedStyles = useCallback(
    (rendition: Rendition) => {
      rendition.themes.default(getPaginatedStyles());
    },
    [getPaginatedStyles]
  );

  // ── Paginated mode: rendition callback ───────────────────────
  const handlePaginatedRendition = useCallback(
    (rendition: Rendition) => {
      renditionRef.current = rendition;
      applyPaginatedStyles(rendition);

      rendition.book.ready.then(() => {
        rendition.book.locations.generate(1024).catch(() => {});
      }).catch(() => {});

      rendition.on("relocated", (loc: { start: { cfi: string; percentage: number } }) => {
        const cfi = loc.start.cfi;
        const pct = loc.start.percentage ?? 0;
        locationRef.current = cfi;
        setCurrentPage(Math.round(pct * 100));
        saveProgress(bookId, cfi, pct, bookTitle, bookCover);
        const bms = getBookmarksForBook(bookId);
        setIsBookmarked(bms.some((b) => b.cfi === cfi));
      });
    },
    [applyPaginatedStyles, bookId, bookTitle, bookCover, saveProgress, getBookmarksForBook]
  );

  // Re-apply paginated styles when prefs change
  useEffect(() => {
    if (!isScrollMode && renditionRef.current) {
      applyPaginatedStyles(renditionRef.current);
    }
  }, [prefs, applyPaginatedStyles, isScrollMode]);

  const handlePaginatedLocationChange = useCallback((loc: string | number) => {
    locationRef.current = loc;
    setLocation(loc);
  }, []);

  // ── Scroll mode callbacks ────────────────────────────────────
  const handleScrollRendition = useCallback((rendition: Rendition) => {
    renditionRef.current = rendition;
  }, []);

  const handleScrollProgress = useCallback(
    (cfi: string, pct: number, scrollTop: number) => {
      setCurrentPage(Math.round(pct * 100));
      saveProgress(bookId, cfi, pct, bookTitle, bookCover, scrollTop);
    },
    [bookId, bookTitle, bookCover, saveProgress]
  );

  const handleScrollLocated = useCallback(
    (cfi: string) => {
      locationRef.current = cfi;
      const bms = getBookmarksForBook(bookId);
      setIsBookmarked(bms.some((b) => b.cfi === cfi));
    },
    [bookId, getBookmarksForBook]
  );

  // ── Common actions ───────────────────────────────────────────
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
    updatePref("readingMode", prefs.readingMode === "scroll" ? "paginated" : "scroll");
  }, [prefs.readingMode, updatePref]);

  const epubUrl = getEpubProxyUrl(bookId);
  const theme = THEME_STYLES[prefs.theme];

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

  // Paginated mode: ReactReader styles
  const readerStyle: typeof ReactReaderStyle = {
    ...ReactReaderStyle,
    readerArea: {
      ...ReactReaderStyle.readerArea,
      background: theme.bg,
      transition: "background 0.3s ease",
    },
    container: {
      ...ReactReaderStyle.container,
      background: theme.bg,
    },
    titleArea: { display: "none" },
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
      color: theme.text,
    } as React.CSSProperties,
    arrowHover: {
      ...ReactReaderStyle.arrowHover,
      color: prefs.theme === "dark" ? "#C8A97E" : "#7B4F2E",
    } as React.CSSProperties,
  };

  return (
    <div
      className={`flex flex-col reader-container reader-theme-${prefs.theme}`}
      style={{ height: "100dvh", background: theme.bg }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0 reader-toolbar">
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 shrink-0 reader-icon-btn"
          onClick={() => navigate(`/book/${bookId}`)}
          aria-label="Zurück"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        {/* Prev arrow (paginated only) */}
        {!isScrollMode && (
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 shrink-0 reader-icon-btn"
            onClick={() => renditionRef.current?.prev()}
            aria-label="Vorherige Seite"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}

        <p className="flex-1 text-sm font-medium truncate font-lora reader-text">
          {bookTitle || "Lädt…"}
        </p>

        <span className="text-xs shrink-0 reader-text-muted">
          {currentPage}%
        </span>

        {/* Next arrow (paginated only) */}
        {!isScrollMode && (
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 shrink-0 reader-icon-btn"
            onClick={() => renditionRef.current?.next()}
            aria-label="Nächste Seite"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}

        {/* Mode toggle */}
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 shrink-0 reader-icon-btn"
          onClick={handleToggleMode}
          title={isScrollMode ? "Zu Blätter-Modus wechseln" : "Zu Scroll-Modus wechseln"}
          aria-label={isScrollMode ? "Zu Blätter-Modus wechseln" : "Zu Scroll-Modus wechseln"}
        >
          {isScrollMode ? <BookOpen className="w-4 h-4" /> : <AlignJustify className="w-4 h-4" />}
        </Button>

        {/* Bookmark */}
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 shrink-0 reader-icon-btn"
          onClick={handleToggleBookmark}
          aria-label={isBookmarked ? "Lesezeichen entfernen" : "Lesezeichen setzen"}
        >
          {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </Button>

        {/* Settings */}
        <Popover open={showSettings} onOpenChange={setShowSettings}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 shrink-0 reader-icon-btn"
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
          variant="ghost" size="icon"
          className="h-8 w-8 shrink-0 hidden sm:flex reader-icon-btn"
          onClick={handleFullscreen}
          aria-label={isFullscreen ? "Vollbild beenden" : "Vollbild"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 shrink-0 reader-progress-track">
        <div
          className="h-full transition-all duration-500 reader-progress-fill"
          style={{ width: `${currentPage}%` }}
        />
      </div>

      {/* EPUB content area */}
      {epubUrl && (
        isScrollMode ? (
          // ── Scroll mode: continuous vertical scroll via epub.js directly ──
          <ScrollReader
            key={`scroll-${bookId}`}
            url={epubUrl}
            initialCfi={initialCfi}
            initialScrollTop={initialScrollTop}
            fontSize={prefs.fontSize}
            lineHeight={prefs.lineHeight}
            fontFamily={prefs.fontFamily}
            themeColors={{ bg: theme.bg, text: theme.text }}
            onProgress={handleScrollProgress}
            onRendition={handleScrollRendition}
            onLocated={handleScrollLocated}
          />
        ) : (
          // ── Paginated mode: ReactReader with left/right navigation ──
          <div className="flex-1 min-h-0">
            <ReactReader
              key={`paginated-${bookId}`}
              url={epubUrl}
              location={location}
              locationChanged={handlePaginatedLocationChange}
              getRendition={handlePaginatedRendition}
              readerStyles={readerStyle}
              epubOptions={{ flow: "paginated" }}
            />
          </div>
        )
      )}
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
