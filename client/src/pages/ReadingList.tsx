import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useReadingProgress } from "@/hooks/useLocalStorage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  BookOpen,
  ArrowLeft,
  Search,
  Trash2,
  BookMarked,
  Clock,
  TrendingUp,
  LayoutGrid,
  List,
} from "lucide-react";
import type { ReadingProgress } from "@/hooks/useLocalStorage";

type SortKey = "lastRead" | "progress" | "title";
type ViewMode = "grid" | "list";

function ProgressRing({ pct }: { pct: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="44" height="44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
      <circle
        cx="22" cy="22" r={r} fill="none"
        stroke="currentColor" strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        className="text-amber-500"
      />
      <text x="22" y="26" textAnchor="middle" fontSize="9" fontWeight="600" fill="currentColor" className="fill-foreground">
        {pct}%
      </text>
    </svg>
  );
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Heute";
  if (diffDays === 1) return "Gestern";
  if (diffDays < 7) return `Vor ${diffDays} Tagen`;
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: diffDays > 365 ? "numeric" : undefined });
}

function BookGridCard({ entry, onRemove }: { entry: ReadingProgress; onRemove: () => void }) {
  return (
    <div className="group relative bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Cover */}
      <Link href={`/book/${entry.gutenbergId}`}>
        <div className="relative aspect-[2/3] bg-muted overflow-hidden cursor-pointer">
          <img
            src={entry.coverUrl ?? `/api/covers/${entry.gutenbergId}`}
            alt={entry.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          {/* Progress overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${entry.percentage}%` }}
            />
          </div>
        </div>
      </Link>

      {/* Info */}
      <div className="p-3 space-y-2">
        <Link href={`/book/${entry.gutenbergId}`}>
          <h3 className="font-medium text-sm leading-snug line-clamp-2 hover:text-amber-600 transition-colors cursor-pointer">
            {entry.title}
          </h3>
        </Link>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{formatDate(entry.lastReadAt)}</span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {entry.percentage}%
          </Badge>
        </div>
        <div className="flex gap-2 pt-1">
          <Link href={`/read/${entry.gutenbergId}`} className="flex-1">
            <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs h-7">
              <BookOpen className="w-3 h-3 mr-1" />
              Weiterlesen
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Aus Leseliste entfernen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Der Lesefortschritt für „{entry.title}" wird gelöscht. Das Buch bleibt in der Bibliothek verfügbar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove} className="bg-destructive hover:bg-destructive/90">
                  Entfernen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function BookListRow({ entry, onRemove }: { entry: ReadingProgress; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow">
      {/* Cover thumbnail */}
      <Link href={`/book/${entry.gutenbergId}`}>
        <div className="w-12 h-16 shrink-0 rounded-md overflow-hidden bg-muted cursor-pointer">
          <img
            src={entry.coverUrl ?? `/api/covers/${entry.gutenbergId}`}
            alt={entry.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform"
            loading="lazy"
          />
        </div>
      </Link>

      {/* Title + date */}
      <div className="flex-1 min-w-0">
        <Link href={`/book/${entry.gutenbergId}`}>
          <h3 className="font-medium text-sm leading-snug line-clamp-2 hover:text-amber-600 transition-colors cursor-pointer">
            {entry.title}
          </h3>
        </Link>
        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(entry.lastReadAt)}</p>
        {/* Progress bar */}
        <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden w-full max-w-xs">
          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${entry.percentage}%` }} />
        </div>
      </div>

      {/* Ring + actions */}
      <div className="flex items-center gap-3 shrink-0">
        <ProgressRing pct={entry.percentage} />
        <Link href={`/read/${entry.gutenbergId}`}>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-7 hidden sm:flex">
            <BookOpen className="w-3 h-3 mr-1" />
            Weiterlesen
          </Button>
        </Link>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Aus Leseliste entfernen?</AlertDialogTitle>
              <AlertDialogDescription>
                Der Lesefortschritt für „{entry.title}" wird gelöscht.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={onRemove} className="bg-destructive hover:bg-destructive/90">
                Entfernen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default function ReadingList() {
  const { getAllProgress, removeProgress } = useReadingProgress();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("lastRead");
  const [view, setView] = useState<ViewMode>("grid");

  const allEntries = getAllProgress();

  const filtered = useMemo(() => {
    let list = allEntries;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sort === "lastRead") return b.lastReadAt - a.lastReadAt;
      if (sort === "progress") return b.percentage - a.percentage;
      if (sort === "title") return a.title.localeCompare(b.title, "de");
      return 0;
    });
  }, [allEntries, search, sort]);

  // Stats
  const avgProgress = allEntries.length
    ? Math.round(allEntries.reduce((s, e) => s + e.percentage, 0) / allEntries.length)
    : 0;
  const finished = allEntries.filter(e => e.percentage >= 95).length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader
        searchQuery=""
        onSearchChange={() => {}}
        searchMode="title"
        onSearchModeChange={() => {}}
        view="grid"
        onViewChange={() => {}}
        darkMode={false}
        onToggleDark={() => {}}
      />

      <main className="flex-1 container max-w-6xl py-8 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/">
            <button className="hover:text-foreground transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Bibliothek
            </button>
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Leseliste</span>
        </div>

        {/* Page title + stats */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookMarked className="w-6 h-6 text-amber-500" />
              Meine Leseliste
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {allEntries.length} {allEntries.length === 1 ? "Buch" : "Bücher"} angelesen
            </p>
          </div>
          {allEntries.length > 0 && (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                <span>Ø {avgProgress}% gelesen</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-4 h-4 text-green-500" />
                <span>{finished} abgeschlossen</span>
              </div>
            </div>
          )}
        </div>

        {allEntries.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <BookOpen className="w-16 h-16 text-muted-foreground/30" />
            <h2 className="text-xl font-semibold text-muted-foreground">Noch keine Bücher angelesen</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Öffne ein Buch im Reader und dein Fortschritt wird hier automatisch gespeichert.
            </p>
            <Link href="/">
              <Button className="bg-amber-600 hover:bg-amber-500 text-white mt-2">
                Zur Bibliothek
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Bücher suchen…"
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
                  <SelectTrigger className="w-44 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lastRead">Zuletzt gelesen</SelectItem>
                    <SelectItem value="progress">Fortschritt</SelectItem>
                    <SelectItem value="title">Titel A–Z</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex border border-border rounded-md overflow-hidden">
                  <button
                    onClick={() => setView("grid")}
                    className={`p-2 transition-colors ${view === "grid" ? "bg-amber-600 text-white" : "text-muted-foreground hover:bg-muted"}`}
                    title="Rasteransicht"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setView("list")}
                    className={`p-2 transition-colors ${view === "list" ? "bg-amber-600 text-white" : "text-muted-foreground hover:bg-muted"}`}
                    title="Listenansicht"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Result count */}
            {search && (
              <p className="text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "Treffer" : "Treffer"} für „{search}"
              </p>
            )}

            {/* Book grid / list */}
            {filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Keine Bücher gefunden.</p>
            ) : view === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filtered.map(entry => (
                  <BookGridCard
                    key={entry.gutenbergId}
                    entry={entry}
                    onRemove={() => removeProgress(entry.gutenbergId)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(entry => (
                  <BookListRow
                    key={entry.gutenbergId}
                    entry={entry}
                    onRemove={() => removeProgress(entry.gutenbergId)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
