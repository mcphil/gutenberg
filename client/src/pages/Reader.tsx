import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { ReactReader, ReactReaderStyle } from "react-reader";
import type { Contents, Rendition } from "epubjs";
import {
  ArrowLeft, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, Minus, Plus, Settings, Sun, Coffee, Moon,
  Type
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { useReadingProgress, useBookmarks, useReaderPreferences } from "@/hooks/useLocalStorage";
import {
  getEpubProxyUrl, getCoverUrl, getCoverUrlById
} from "../../../shared/gutenberg";

interface ReaderProps {
  bookId: number;
}

type ReaderTheme = "light" | "sepia" | "dark";

const THEME_STYLES: Record<ReaderTheme, { bg: string; text: string; label: string }> = {
  light: { bg: "#FEFDFB", text: "#2D2416", label: "Hell" },
  sepia: { bg: "#F4ECD8", text: "#3B2F1E", label: "Sepia" },
  dark:  { bg: "#1C1A18", text: "#E8E0D4", label: "Dunkel" },
};

export default function Reader({ bookId }: ReaderProps) {
  const [, navigate] = useLocation();
  const { prefs, updatePref } = useReaderPreferences();
  const { saveProgress, getProgress } = useReadingProgress();
  const { addBookmark, getBookmarksForBook, removeBookmark } = useBookmarks();

  const [location, setLocation] = useState<string | number>(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const [bookCover, setBookCover] = useState("");

  const renditionRef = useRef<Rendition | null>(null);
  const locationRef = useRef<string | number>(0);

  const { data: book } = trpc.books.byId.useQuery({ id: bookId });

  // Load saved position
  useEffect(() => {
    const saved = getProgress(bookId);
    if (saved?.cfi) {
      setLocation(saved.cfi);
      locationRef.current = saved.cfi;
    }
  }, [bookId]);

  useEffect(() => {
    if (book) {
      setBookTitle(book.title);
      // Always use our own cover endpoint — never store a gutenberg.org URL
      setBookCover(getCoverUrlById(bookId));
    }
  }, [book, bookId]);

  // Apply reader theme and font settings to rendition
  const applyStyles = useCallback(
    (rendition: Rendition) => {
      const theme = THEME_STYLES[prefs.theme];
      const fontFamily =
        prefs.fontFamily === "serif"
          ? "'Merriweather', 'Georgia', serif"
          : "'Inter', 'system-ui', sans-serif";

      rendition.themes.default({
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
      });
    },
    [prefs]
  );

  const handleRendition = useCallback(
    (rendition: Rendition) => {
      renditionRef.current = rendition;
      applyStyles(rendition);

      rendition.on("relocated", (location: { start: { cfi: string; percentage: number }; atEnd: boolean }) => {
        const cfi = location.start.cfi;
        const pct = location.start.percentage;
        locationRef.current = cfi;
        setCurrentPage(Math.round(pct * 100));

        // Save progress
        saveProgress(bookId, cfi, pct, bookTitle, bookCover);

        // Check if current location is bookmarked
        const bms = getBookmarksForBook(bookId);
        setIsBookmarked(bms.some((b) => b.cfi === cfi));
      });
    },
    [applyStyles, bookId, bookTitle, bookCover, saveProgress, getBookmarksForBook]
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

  // Use our own EPUB proxy endpoint — never stream directly from gutenberg.org
  const epubUrl = book ? getEpubProxyUrl(book) : null;
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
    },
    arrowHover: {
      ...ReactReaderStyle.arrowHover,
      color: prefs.theme === "dark" ? "#C8A97E" : "#7B4F2E",
    },
  };

  return (
    <div
      className="flex flex-col"
      style={{ height: "100dvh", background: theme.bg, color: theme.text }}
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
              <Settings className="w-4 h-4" />
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
          className="h-full transition-all duration-300"
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
            url={epubUrl}
            location={location}
            locationChanged={handleLocationChange}
            getRendition={handleRendition}
            readerStyles={readerStyle}
            epubOptions={{
              flow: "paginated",
              manager: "default",
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

      {/* Max width */}
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
    </div>
  );
}
