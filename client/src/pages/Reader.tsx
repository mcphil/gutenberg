import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { ReactReader, ReactReaderStyle } from "react-reader";
import type { Contents, Rendition } from "epubjs";
import {
  ArrowLeft, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, Minus, Plus, Settings,
  Type, AlignJustify, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { useReadingProgress, useBookmarks, useReaderPreferences } from "@/hooks/useLocalStorage";
import { getEpubProxyUrl, getCoverUrlById } from "../../../shared/gutenberg";

interface ReaderProps {
  bookId: number;
}

type ReaderTheme = "light" | "sepia" | "dark";

const THEME_STYLES: Record<ReaderTheme, {
  bg: string;       // column / page background
  scrollBg: string; // outer margin background in scroll mode (slightly darker)
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

  const [location, setLocation] = useState<string | number>(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const [bookCover, setBookCover] = useState("");

  const renditionRef = useRef<Rendition | null>(null);
  const locationRef = useRef<string | number>(0);
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScrollMode = prefs.readingMode === "scroll";

  const { data: book } = trpc.books.byId.useQuery({ id: bookId });

  // Load saved position
  useEffect(() => {
    const saved = getProgress(bookId);
    if (saved?.cfi) {
      setLocation(saved.cfi);
      locationRef.current = saved.cfi;
    }
  }, [bookId]);

  // Helper: get the scrollable document element inside the EPUB iframe
  const getScrollDoc = useCallback((): Element | null => {
    try {
      const contents = renditionRef.current?.getContents();
      const doc = (contents as unknown as Array<{ document: Document }>)?.[0]?.document;
      return doc?.scrollingElement ?? doc?.documentElement ?? null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (book) {
      setBookTitle(book.title);
      setBookCover(getCoverUrlById(bookId));
    }
  }, [book, bookId]);

  // Build the CSS applied inside the EPUB iframe
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
        // 100ch centres the column; in paginated mode use the user-defined maxWidth
        "max-width": isScroll ? "100ch" : `${prefs.maxWidth}px`,
        margin: "0 auto",
        padding: isScroll ? "3rem 2rem 6rem" : "2rem 1.5rem",
        // Subtle box-shadow gives the column a card-like lift in scroll mode
        "box-shadow": isScroll ? "0 0 0 1px rgba(0,0,0,0.06), 0 2px 24px rgba(0,0,0,0.08)" : "none",
      },
      // Outer html element gets the darker margin colour in scroll mode
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

      rendition.on("relocated", (location: { start: { cfi: string; percentage: number }; atEnd: boolean }) => {
        const cfi = location.start.cfi;
        const pct = location.start.percentage ?? 0;
        locationRef.current = cfi;
        setCurrentPage(Math.round(pct * 100));
        // In scroll mode we capture scrollTop after a short delay so the
        // browser has finished rendering the new position
        if (isScrollMode) {
          setTimeout(() => {
            const scrollEl = getScrollDoc();
            const st = scrollEl?.scrollTop ?? 0;
            saveProgress(bookId, cfi, pct, bookTitle, bookCover, st);
          }, 120);
        } else {
          saveProgress(bookId, cfi, pct, bookTitle, bookCover);
        }
        const bms = getBookmarksForBook(bookId);
        setIsBookmarked(bms.some((b) => b.cfi === cfi));
      });

      // In scroll mode: also attach a throttled scroll listener for finer
      // position granularity (saves every 2 s while scrolling)
      rendition.on("rendered", () => {
        if (!isScrollMode) return;
        try {
          const contents = rendition.getContents();
          const doc = (contents as unknown as Array<{ document: Document }>)?.[0]?.document;
          const scrollEl = doc?.scrollingElement ?? doc?.documentElement;
          if (!scrollEl) return;

          // Restore saved scrollTop after the first render
          const saved = getProgress(bookId);
          if (saved?.scrollTop && saved.scrollTop > 0) {
            setTimeout(() => { scrollEl.scrollTop = saved.scrollTop!; }, 150);
          }

          const onScroll = () => {
            if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current);
            scrollSaveTimerRef.current = setTimeout(() => {
              const st = scrollEl.scrollTop;
              const cfi = typeof locationRef.current === "string" ? locationRef.current : "";
              if (!cfi) return;
              // Estimate percentage from scrollTop / scrollHeight
              const pct = scrollEl.scrollHeight > 0
                ? st / scrollEl.scrollHeight
                : 0;
              setCurrentPage(Math.round(pct * 100));
              saveProgress(bookId, cfi, pct, bookTitle, bookCover, st);
            }, 2000);
          };
          scrollEl.addEventListener("scroll", onScroll, { passive: true });
        } catch {
          // ignore
        }
      });
    },
    [applyStyles, bookId, bookTitle, bookCover, saveProgress, getBookmarksForBook, isScrollMode, getScrollDoc, getProgress]
  );

  // Re-apply styles when preferences change
  useEffect(() => {
    if (renditionRef.current) {
      applyStyles(renditionRef.current);
    }
  }, [prefs, applyStyles]);

  const handleLocationChange = useCallback((loc: string | number) => {
    setLocation(loc);
    locationRef.current = loc;
  }, []);

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
    // Reset location to current CFI so the new mode opens at the same position
    const cfi = locationRef.current;
    if (cfi) {
      setTimeout(() => setLocation(cfi), 50);
    }
  }, [prefs.readingMode, updatePref]);

  const epubUrl = getEpubProxyUrl(bookId);
  const theme = THEME_STYLES[prefs.theme];
  const isScroll = prefs.readingMode === "scroll";

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

  // In scroll mode the outer container uses the darker margin colour;
  // the lighter column bg is applied inside the EPUB iframe via getEpubStyles()
  const outerBg = isScroll ? theme.scrollBg : theme.bg;

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
    // Hide prev/next arrows in scroll mode — navigation is via scrolling
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
      {/* Reader toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b shrink-0"
        style={{
          background: prefs.theme === "dark" ? "#252320" : "#F5F0E8",
          borderColor: prefs.theme === "dark" ? "#3A3630" : "#E0D8CC",
        }}
      >
        {/* Back */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          style={{ color: theme.text }}
          onClick={() => navigate(`/book/${bookId}`)}
          aria-label="Zurück"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        {/* Title */}
        <p
          className="flex-1 text-sm font-medium truncate"
          style={{ fontFamily: "Lora, Georgia, serif", color: theme.text }}
        >
          {bookTitle || "Lädt…"}
        </p>

        {/* Progress */}
        <span className="text-xs shrink-0" style={{ color: `${theme.text}99` }}>
          {currentPage}%
        </span>

        {/* Mode toggle: Scroll ↔ Paginated */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          style={{ color: theme.text }}
          onClick={handleToggleMode}
          title={isScroll ? "Zu Blätter-Modus wechseln" : "Zu Scroll-Modus wechseln"}
          aria-label={isScroll ? "Zu Blätter-Modus wechseln" : "Zu Scroll-Modus wechseln"}
        >
          {isScroll ? <BookOpen className="w-4 h-4" /> : <AlignJustify className="w-4 h-4" />}
        </Button>

        {/* Bookmark */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
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
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
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
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 hidden sm:flex"
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
            key={prefs.readingMode}  // force remount when mode changes
            url={epubUrl}
            location={location}
            locationChanged={handleLocationChange}
            getRendition={handleRendition}
            readerStyles={readerStyle}
            epubOptions={{
              flow: isScroll ? "scrolled-doc" : "paginated",
              manager: isScroll ? "continuous" : "default",
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
      <div>
        <label className="text-xs text-muted-foreground font-medium mb-2 block">Design</label>
        <div className="flex gap-2">
          {(["light", "sepia", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => updatePref("theme", t)}
              className={`flex-1 h-8 rounded text-xs font-medium border-2 transition-all ${
                prefs.theme === t ? "border-primary" : "border-transparent"
              }`}
              style={{
                background: THEME_STYLES[t].bg,
                color: THEME_STYLES[t].text,
              }}
            >
              {THEME_STYLES[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Font family */}
      <div>
        <label className="text-xs text-muted-foreground font-medium mb-2 block">Schriftart</label>
        <div className="flex gap-2">
          <button
            onClick={() => updatePref("fontFamily", "serif")}
            className={`flex-1 h-8 rounded text-sm border-2 transition-all ${
              prefs.fontFamily === "serif" ? "border-primary bg-primary/10" : "border-border"
            }`}
            style={{ fontFamily: "Merriweather, Georgia, serif" }}
          >
            Serif
          </button>
          <button
            onClick={() => updatePref("fontFamily", "sans")}
            className={`flex-1 h-8 rounded text-sm border-2 transition-all ${
              prefs.fontFamily === "sans" ? "border-primary bg-primary/10" : "border-border"
            }`}
            style={{ fontFamily: "Inter, system-ui, sans-serif" }}
          >
            Sans-serif
          </button>
        </div>
      </div>

      {/* Font size */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground font-medium">Schriftgröße</label>
          <span className="text-xs font-mono">{prefs.fontSize}px</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => updatePref("fontSize", Math.max(12, prefs.fontSize - 1))}
          >
            <Minus className="w-3 h-3" />
          </Button>
          <Slider
            value={[prefs.fontSize]}
            min={12}
            max={26}
            step={1}
            className="flex-1"
            onValueChange={([v]) => updatePref("fontSize", v)}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => updatePref("fontSize", Math.min(26, prefs.fontSize + 1))}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Line height */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground font-medium">Zeilenabstand</label>
          <span className="text-xs font-mono">{prefs.lineHeight.toFixed(2)}</span>
        </div>
        <Slider
          value={[prefs.lineHeight]}
          min={1.3}
          max={2.0}
          step={0.05}
          className="w-full"
          onValueChange={([v]) => updatePref("lineHeight", v)}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Eng</span>
          <span>Weit</span>
        </div>
      </div>

      {/* Max width — only relevant in paginated mode */}
      {!isScroll && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-muted-foreground font-medium">Textbreite</label>
            <span className="text-xs font-mono">{prefs.maxWidth}px</span>
          </div>
          <Slider
            value={[prefs.maxWidth]}
            min={500}
            max={900}
            step={20}
            className="w-full"
            onValueChange={([v]) => updatePref("maxWidth", v)}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Schmal</span>
            <span>Breit</span>
          </div>
        </div>
      )}

      {/* Scroll mode info */}
      {isScroll && (
        <p className="text-xs text-muted-foreground border border-border rounded p-2 leading-relaxed">
          Scroll-Modus: optimale Lesebreite (660 px) — einspaltig auf allen Geräten.
        </p>
      )}
    </div>
  );
}
