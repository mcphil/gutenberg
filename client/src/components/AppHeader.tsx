import { BookOpen, Grid3X3, List, Shuffle, Sun, Moon, Search, X, FileSearch, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useCallback, useState } from "react";
import { useReadingProgress } from "@/hooks/useLocalStorage";

export type SearchMode = "title" | "fulltext";

interface AppHeaderProps {
  view: "grid" | "list" | "browse";
  onViewChange: (v: "grid" | "list" | "browse") => void;
  darkMode: boolean;
  onToggleDark: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchMode: SearchMode;
  onSearchModeChange: (mode: SearchMode) => void;
}

export function AppHeader({
  view,
  onViewChange,
  darkMode,
  onToggleDark,
  searchQuery,
  onSearchChange,
  searchMode,
  onSearchModeChange,
}: AppHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { getAllProgress } = useReadingProgress();
  const readingCount = getAllProgress().length;

  const handleSearchToggle = useCallback(() => {
    if (searchOpen && searchQuery) {
      onSearchChange("");
    }
    setSearchOpen((v) => !v);
  }, [searchOpen, searchQuery, onSearchChange]);

  const isFullText = searchMode === "fulltext";

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container">
        <div className="flex items-center gap-3 h-14">
          {/* Logo */}
          <a
            href="/"
            className="flex items-center gap-2 text-foreground hover:text-primary transition-colors shrink-0"
            onClick={(e) => { e.preventDefault(); onViewChange("grid"); }}
          >
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-semibold text-base hidden sm:block font-lora">
              Gutenberg Navigator
            </span>
          </a>

          {/* Search bar — expands on mobile */}
          <div className={`flex-1 transition-all duration-200 ${searchOpen ? "block" : "hidden sm:block"}`}>
            <div className="relative max-w-lg flex items-center gap-1">
              {/* Mode toggle button */}
              <button
                onClick={() => onSearchModeChange(isFullText ? "title" : "fulltext")}
                title={isFullText ? "Volltext-Suche aktiv — klicken für Titelsuche" : "Titelsuche aktiv — klicken für Volltext-Suche"}
                className={`shrink-0 h-9 w-9 flex items-center justify-center rounded-md border transition-colors ${
                  isFullText
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/60 text-muted-foreground border-transparent hover:border-border hover:text-foreground"
                }`}
                aria-label={isFullText ? "Zur Titelsuche wechseln" : "Zur Volltextsuche wechseln"}
              >
                {isFullText ? <FileSearch className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </button>

              {/* Input */}
              <div className="relative flex-1">
                <Input
                  type="search"
                  placeholder={isFullText ? "Im Buchtext suchen…" : "Titel, Autor, Thema suchen…"}
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="h-9 bg-muted/60 border-transparent focus:bg-background focus:border-border pr-8"
                  autoFocus={searchOpen}
                />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {/* Mobile search toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden h-9 w-9"
              onClick={handleSearchToggle}
              aria-label="Suche"
            >
              {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </Button>

            {/* View toggles */}
            <div className="hidden sm:flex items-center border border-border rounded-md overflow-hidden">
              <ViewButton
                active={view === "grid"}
                onClick={() => onViewChange("grid")}
                label="Rasteransicht"
              >
                <Grid3X3 className="w-4 h-4" />
              </ViewButton>
              <ViewButton
                active={view === "list"}
                onClick={() => onViewChange("list")}
                label="Listenansicht"
              >
                <List className="w-4 h-4" />
              </ViewButton>
              <ViewButton
                active={view === "browse"}
                onClick={() => onViewChange("browse")}
                label="Browse-Modus"
              >
                <Shuffle className="w-4 h-4" />
              </ViewButton>
            </div>

            {/* Mobile view toggle — cycle */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden h-9 w-9"
              onClick={() => {
                const next = view === "grid" ? "list" : view === "list" ? "browse" : "grid";
                onViewChange(next);
              }}
              aria-label="Ansicht wechseln"
            >
              {view === "grid" ? <Grid3X3 className="w-4 h-4" /> : view === "list" ? <List className="w-4 h-4" /> : <Shuffle className="w-4 h-4" />}
            </Button>

            {/* Reading list link */}
            {readingCount > 0 && (
              <Link href="/leseliste">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 relative"
                  aria-label={`Leseliste (${readingCount} Bücher)`}
                  title={`Leseliste (${readingCount} Bücher)`}
                >
                  <BookMarked className="w-4 h-4" />
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {readingCount > 99 ? "99+" : readingCount}
                  </span>
                </Button>
              </Link>
            )}

            {/* Dark mode */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onToggleDark}
              aria-label={darkMode ? "Helles Design" : "Dunkles Design"}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`h-8 w-8 flex items-center justify-center transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
