import { BookOpen, Grid3X3, List, Shuffle, Sun, Moon, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCallback, useState } from "react";

interface AppHeaderProps {
  view: "grid" | "list" | "browse";
  onViewChange: (v: "grid" | "list" | "browse") => void;
  darkMode: boolean;
  onToggleDark: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function AppHeader({
  view,
  onViewChange,
  darkMode,
  onToggleDark,
  searchQuery,
  onSearchChange,
}: AppHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSearchToggle = useCallback(() => {
    if (searchOpen && searchQuery) {
      onSearchChange("");
    }
    setSearchOpen((v) => !v);
  }, [searchOpen, searchQuery, onSearchChange]);

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
            <span
              className="font-semibold text-base hidden sm:block"
              style={{ fontFamily: "Lora, Georgia, serif" }}
            >
              Gutenberg Leser
            </span>
          </a>

          {/* Search bar — expands on mobile */}
          <div className={`flex-1 transition-all duration-200 ${searchOpen ? "block" : "hidden sm:block"}`}>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Titel, Autor, Thema suchen…"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 h-9 bg-muted/60 border-transparent focus:bg-background focus:border-border"
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
