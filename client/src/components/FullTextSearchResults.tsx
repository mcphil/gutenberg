/**
 * FullTextSearchResults
 *
 * Displays the results of a full-text EPUB search.
 * Each result shows: book cover, title, author, chapter name, and a
 * context snippet with the search term highlighted.
 */

import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { BookOpen, FileText, Loader2, SearchX } from "lucide-react";
import { useMemo } from "react";

interface Props {
  query: string;
}

/** Highlight all occurrences of `term` in `text` with <mark> */
function HighlightedSnippet({ text, term }: { text: string; term: string }) {
  if (!term || term.length < 2) return <span>{text}</span>;

  const parts: { str: string; highlight: boolean }[] = [];
  const lower = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  let cursor = 0;

  while (cursor < text.length) {
    const idx = lower.indexOf(lowerTerm, cursor);
    if (idx === -1) {
      parts.push({ str: text.slice(cursor), highlight: false });
      break;
    }
    if (idx > cursor) {
      parts.push({ str: text.slice(cursor, idx), highlight: false });
    }
    parts.push({ str: text.slice(idx, idx + term.length), highlight: true });
    cursor = idx + term.length;
  }

  return (
    <span>
      {parts.map((p, i) =>
        p.highlight ? (
          <mark
            key={i}
            className="bg-primary/20 text-foreground rounded-sm px-0.5 font-medium"
          >
            {p.str}
          </mark>
        ) : (
          <span key={i}>{p.str}</span>
        )
      )}
    </span>
  );
}

export function FullTextSearchResults({ query }: Props) {
  const [, navigate] = useLocation();

  // Debounce: only fire when query is at least 2 chars
  const debouncedQuery = query.trim();
  const enabled = debouncedQuery.length >= 2;

  const { data, isLoading, isError } = trpc.books.fullTextSearch.useQuery(
    { query: debouncedQuery },
    {
      enabled,
      staleTime: 5 * 60 * 1000, // cache 5 min
      placeholderData: (prev) => prev,
    }
  );

  const results = data?.results ?? [];

  // Group results by book for a cleaner display
  const grouped = useMemo(() => {
    const map = new Map<number, { title: string; authors: string; matches: typeof results }>();
    for (const r of results) {
      if (!map.has(r.gutenbergId)) {
        map.set(r.gutenbergId, { title: r.title, authors: r.authors, matches: [] });
      }
      map.get(r.gutenbergId)!.matches.push(r);
    }
    return Array.from(map.entries());
  }, [results]);

  if (!enabled) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Durchsuche {"\u00e4"}hnliche B{"\u00fc"}cher…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <SearchX className="w-8 h-8" />
        <p className="text-sm">Suche fehlgeschlagen. Bitte erneut versuchen.</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <SearchX className="w-10 h-10 opacity-40" />
        <p className="text-sm font-medium">Keine Treffer für „{query}"</p>
        <p className="text-xs opacity-70">
          Die Volltextsuche durchsucht nur lokal gecachte Bücher ({"\u00e4"}hnlich wie ein Offline-Archiv).
        </p>
      </div>
    );
  }

  return (
    <div className="py-4">
      {/* Result count */}
      <p className="text-xs text-muted-foreground mb-4 px-1">
        {results.length} Treffer in {grouped.length} {grouped.length === 1 ? "Buch" : "B\u00fcchern"} für „{query}"
      </p>

      <div className="space-y-6">
        {grouped.map(([gutenbergId, { title, authors, matches }]) => (
          <div key={gutenbergId} className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Book header */}
            <button
              onClick={() => navigate(`/book/${gutenbergId}`)}
              className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left border-b border-border"
            >
              <div className="w-10 shrink-0 rounded overflow-hidden aspect-book">
                <img
                  src={`/api/covers/${gutenbergId}`}
                  alt={`Cover von ${title}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  width={80}
                  height={120}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-foreground font-lora line-clamp-1">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{authors}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {matches.length} {matches.length === 1 ? "Treffer" : "Treffer"}
              </span>
            </button>

            {/* Matches */}
            <div className="divide-y divide-border">
              {matches.map((match, idx) => (
                <button
                  key={idx}
                  onClick={() => navigate(`/read/${gutenbergId}`)}
                  className="w-full text-left p-4 hover:bg-muted/30 transition-colors group"
                >
                  {/* Chapter label */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground font-medium truncate">
                      {match.chapter}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      Lesen
                    </span>
                  </div>
                  {/* Snippet */}
                  <p className="text-sm text-foreground/80 leading-relaxed font-serif">
                    <HighlightedSnippet text={match.snippet} term={query} />
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Note about coverage */}
      <p className="text-xs text-muted-foreground/60 text-center mt-6 px-4">
        Die Volltextsuche ist auf lokal gecachte Bücher beschr{"\u00e4"}nkt.
        Weitere B{"\u00fc"}cher werden beim ersten {"\u00d6"}ffnen automatisch hinzugef{"\u00fc"}gt.
      </p>
    </div>
  );
}
