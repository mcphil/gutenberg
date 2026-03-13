import { useState, useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import Catalog from "./Catalog";
import BrowseMode from "./BrowseMode";
import { useAppPreferences } from "@/hooks/useLocalStorage";
import { BookOpen, Clock, Shuffle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useReadingProgress } from "@/hooks/useLocalStorage";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const [, navigate] = useLocation();
  const { appPrefs, updateAppPref } = useAppPreferences();
  const [view, setView] = useState<"grid" | "list" | "browse">(appPrefs.defaultView);
  const [searchQuery, setSearchQuery] = useState("");
  const { getAllProgress, removeProgress } = useReadingProgress();
  const { data: countData } = trpc.books.count.useQuery();
  const bookCount = countData ?? 2420;
  // Sync dark mode to <html>>
  useEffect(() => {
    if (appPrefs.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [appPrefs.darkMode]);

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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        view={view}
        onViewChange={handleViewChange}
        darkMode={appPrefs.darkMode}
        onToggleDark={handleToggleDark}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="container">
        {/* Hero / Welcome — only shown when no search */}
        {!searchQuery && (
          <div className="py-10 text-center border-b border-border mb-2">
            <div className="flex items-center justify-center gap-2 mb-3">
              <BookOpen className="w-7 h-7 text-primary" />
              <h1
                className="text-2xl sm:text-3xl font-semibold text-foreground"
                style={{ fontFamily: "Lora, Georgia, serif" }}
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

        {/* Continue reading */}
        {recentProgress.length > 0 && !searchQuery && (
          <div className="py-5 border-b border-border mb-2">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Weiterlesen
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pt-3 pb-2 px-1 -mx-1">
              {recentProgress.map((p) => (
                <div key={p.gutenbergId} className="shrink-0 relative group/card" style={{ minWidth: 220 }}>
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
                    {p.coverUrl && (
                      <div className="w-10 shrink-0 rounded overflow-hidden bg-muted" style={{ aspectRatio: "2/3" }}>
                        <img
                          src={p.coverUrl}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium line-clamp-2 text-foreground"
                         style={{ fontFamily: "Lora, Georgia, serif" }}>
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

        <Catalog view={view as "grid" | "list"} searchQuery={searchQuery} />
      </main>
    </div>
  );
}
