import { useParams, useLocation } from "wouter";
import { ArrowLeft, BookOpen, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { getAuthorYears, parseAuthors } from "../../../shared/gutenberg";
import type { LocalBook } from "../../../shared/gutenberg";
import { BookCard } from "@/components/BookCard";

export default function AuthorPage() {
  const params = useParams<{ name: string }>();
  const [, navigate] = useLocation();

  // The author name comes URL-encoded from the link
  const authorName = decodeURIComponent(params.name ?? "");

  const { data: books, isLoading } = trpc.books.byAuthor.useQuery(
    { authorName },
    { enabled: authorName.length > 0 }
  );

  // Parse the first book's author entry to get birth/death years for the header
  const firstBook = books?.[0];
  const parsedAuthors = firstBook ? parseAuthors(firstBook.authors) : [];
  // Find the matching author entry (by last name match)
  const matchedAuthor = parsedAuthors.find((a) =>
    a.name.toLowerCase().includes(authorName.split(",")[0]?.toLowerCase() ?? "")
  ) ?? parsedAuthors[0];

  const authorYears = matchedAuthor ? getAuthorYears(matchedAuthor) : "";
  const displayName = matchedAuthor?.displayName ?? authorName;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => window.history.back()}
            aria-label="Zurück"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <h1 className="text-lg font-semibold truncate">{displayName}</h1>
              {authorYears && (
                <span className="text-sm text-muted-foreground shrink-0">{authorYears}</span>
              )}
            </div>
            {!isLoading && books && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {books.length} {books.length === 1 ? "Werk" : "Werke"} in der Bibliothek
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[2/3] rounded-lg bg-muted mb-2" />
                <div className="h-3 bg-muted rounded w-3/4 mb-1" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : !books || books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
            <BookOpen className="w-12 h-12 opacity-30" />
            <p className="text-lg">Keine Bücher für diesen Autor gefunden.</p>
            <Button variant="outline" onClick={() => navigate("/")}>
              Zurück zum Katalog
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {books.map((book) => (
              <BookCard
                key={book.gutenbergId}
                book={book as unknown as LocalBook}
                onClick={() => navigate(`/book/${book.gutenbergId}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
