// Shared types for Gutendex API responses

export interface GutenbergAuthor {
  name: string;
  birth_year: number | null;
  death_year: number | null;
}

export interface GutenbergFormats {
  "application/epub+zip"?: string;
  "text/html"?: string;
  "image/jpeg"?: string;
  "text/plain; charset=utf-8"?: string;
  "application/x-mobipocket-ebook"?: string;
  [key: string]: string | undefined;
}

export interface GutenbergBook {
  id: number;
  title: string;
  authors: GutenbergAuthor[];
  summaries: string[];
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  copyright: boolean | null;
  media_type: string;
  formats: GutenbergFormats;
  download_count: number;
  // Derived helpers
  coverUrl?: string;
  epubUrl?: string;
}

export interface GutendexResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutenbergBook[];
}

export interface BookSummaryResult {
  gutenbergId: number;
  shortSummary: string;
  longSummary: string;
  fromCache: boolean;
}

export function getCoverUrl(book: GutenbergBook): string {
  return (
    book.formats["image/jpeg"] ||
    `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.cover.medium.jpg`
  );
}

export function getEpubUrl(book: GutenbergBook): string | null {
  return book.formats["application/epub+zip"] || null;
}

export function getAuthorDisplay(book: GutenbergBook): string {
  if (!book.authors || book.authors.length === 0) return "Unbekannter Autor";
  return book.authors
    .map((a) => {
      // Gutenberg stores names as "Last, First" — reverse for display
      const parts = a.name.split(", ");
      return parts.length === 2 ? `${parts[1]} ${parts[0]}` : a.name;
    })
    .join(", ");
}

export function getAuthorYears(author: GutenbergAuthor): string {
  if (author.birth_year && author.death_year) return `(${author.birth_year}–${author.death_year})`;
  if (author.birth_year) return `(* ${author.birth_year})`;
  return "";
}
