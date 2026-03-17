import { useState, useEffect, useCallback } from "react";
import { AppHeader, SearchMode } from "@/components/AppHeader";
import Catalog from "./Catalog";
import BrowseMode from "./BrowseMode";
import { useAppPreferences } from "@/hooks/useLocalStorage";
import { BookOpen, Clock, Shuffle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useSearch } from "wouter";
import { useReadingProgress } from "@/hooks/useLocalStorage";
import { trpc } from "@/lib/trpc";
import { FullTextSearchResults } from "@/components/FullTextSearchResults";

export default function Home() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { appPrefs, updateAppPref } = useAppPreferences();
  const [view, setView] = useState<"grid" | "list" | "browse">(appPrefs.defaultView);
  const { getAllProgress, removeProgress } = useReadingProgress();
  const { data: countData } = trpc.books.count.useQuery();
  const bookCount = countData ?? 2420;

  // Read searchQuery from URL (?q=...) so it persists across navigation
  const searchQuery = new URLSearchParams(search).get("q") ?? "";

  // Search mode: "title" (default) or "fulltext"
  // Stored in URL as ?mode=fulltext to persist across navigation
  const rawMode = new URLSearchParams(search).get("mode");
  const searchMode: SearchMode = rawMode === "fulltext" ? "fulltext" : "title";

  const handleSearchChange = useCallback((q: string) => {
    const current = new URLSearchParams(window.location.search);
    if (q) {
      current.set("q", q);
    } else {
      current.delete("q");
    }
    // Reset page when search changes
    current.delete("page");
    const qs = current.toString();
    navigate(qs ? `/?${qs}` : "/", { replace: true });
  }, [navigate]);

  const handleSearchModeChange = useCallback((mode: SearchMode) => {
    const current = new URLSearchParams(window.location.search);
    if (mode === "fulltext") {
      current.set("mode", "fulltext");
    } else {
      current.delete("mode");
    }
    // Clear search when switching modes to avoid confusion
    current.delete("q");
    current.delete("page");
    const qs = current.toString();
    navigate(qs ? `/?${qs}` : "/", { replace: true });
  }, [navigate]);

  // Sync dark mode to <html>
  useEffect(() => {
    if (appPrefs.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [appPrefs.darkMode]);

  // Set homepage title and keywords for SEO
  useEffect(() => {
    document.title = "Gutenberg Navigator — Klassiker kostenlos lesen";
    let metaKw = document.querySelector<HTMLMetaElement>('meta[name="keywords"]');
    if (!metaKw) {
      metaKw = document.createElement('meta');
      metaKw.name = 'keywords';
      document.head.appendChild(metaKw);
    }
    metaKw.content = "Gutenberg, deutschsprachige Klassiker, kostenlos lesen, EPUB, Literatur, Goethe, Schiller, Kafka, gemeinfreie Bücher";
  }, []);

  const handleViewChange = (v: "grid" | "list" | "browse") => {
    setView(v);
    if (v !== "browse") {
      updateAppPref("defaultView", v as "grid" | "list");
    }
  };

  const handleToggleDark = () => {
    updateAppPref("darkMode", !appPrefs.darkMode);
  };

  const recentProgress = getAllProgress().slice(0, 3);

  if (view === "browse") {
    return <BrowseMode onClose={() => handleViewChange("grid")} />;
  }

  const isFullTextMode = searchMode === "fulltext";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        view={view}
        onViewChange={handleViewChange}
        darkMode={appPrefs.darkMode}
        onToggleDark={handleToggleDark}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchMode={searchMode}
        onSearchModeChange={handleSearchModeChange}
      />

      <main className="container">
        {/* Hero / Welcome — only shown when no search and not in fulltext mode */}
        {!searchQuery && !isFullTextMode && (
          <div className="py-10 text-center border-b border-border mb-2">
            <div className="flex items-center justify-center gap-2 mb-3">
              <BookOpen className="w-7 h-7 text-primary" />
              <h1
                className="text-2xl sm:text-3xl font-semibold text-foreground font-lora"
              >
                Gutenberg Navigator
              </h1>
            </div>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-5">
              Erkunde {bookCount.toLocaleString("de-DE")} deutschsprachige Werke aus der Gutenberg.org Bibliothek
            </p>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleViewChange("browse")}
            >
              <Shuffle className="w-4 h-4" />
              Browse-Modus starten
            </Button>
          </div>
        )}

        {/* Continue reading — only in title mode without active search */}
        {recentProgress.length > 0 && !searchQuery && !isFullTextMode && (
          <div className="py-5 border-b border-border mb-2">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Weiterlesen
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pt-3 pb-2 px-1 -mx-1">
              {recentProgress.map((p) => (
                <div key={p.gutenbergId} className="shrink-0 relative group/card home-carousel-card">
                  {/* Delete button — appears on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProgress(p.gutenbergId);
                    }}
                    className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                    title="Aus der Liste entfernen"
                    aria-label="Aus Weiterlesen entfernen"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => navigate(`/read/${p.gutenbergId}`)}
                    className="w-full flex items-center gap-3 bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors text-left"
                  >
                    <div className="w-10 shrink-0 rounded overflow-hidden aspect-book">
                      <img
                        src={`/api/covers/${p.gutenbergId}`}
                        alt={`Cover von ${p.title}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        width={80}
                        height={120}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium line-clamp-2 text-foreground font-lora">
                        {p.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="flex-1 bg-border rounded-full h-1">
                          <div
                            className="bg-primary h-1 rounded-full"
                            style={{ width: `${Math.round(p.percentage * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {Math.round(p.percentage * 100)}%
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full-text search mode */}
        {isFullTextMode ? (
          <>
            {searchQuery ? (
              <FullTextSearchResults query={searchQuery} />
            ) : (
              <div className="py-16 text-center text-muted-foreground">
                <p className="text-sm font-medium mb-1">Volltext-Suche aktiv</p>
                <p className="text-xs opacity-70">
                  Gib einen Begriff ein, um im Inhalt gecachter Bücher zu suchen.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* SEO: H2 heading for the catalog section */}
            {!searchQuery && (
              <h2 className="sr-only">
                Deutschsprachige Klassiker — über 2.400 gemeinfreie Werke kostenlos lesen
              </h2>
            )}
            {searchQuery && (
              <h2 className="sr-only">
                Suchergebnisse für „{searchQuery}"
              </h2>
            )}
            <Catalog view={view as "grid" | "list"} searchQuery={searchQuery} />
          </>
        )}
      </main>
    </div>
  );
}
