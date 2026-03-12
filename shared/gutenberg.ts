/**
 * shared/gutenberg.ts
 *
 * Shared types and helpers for the Gutenberg Leser app.
 *
 * Data source: Project Gutenberg's official pg_catalog.csv
 *   https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv
 *
 * We respect all Project Gutenberg terms of use:
 *   - Metadata comes from the approved pg_catalog.csv (downloaded weekly)
 *   - EPUBs are downloaded via the approved rsync method
 *   - We never hotlink or deep-link to gutenberg.org for serving content
 */

// ─── Types matching the local `books` DB table (imported from pg_catalog.csv) ─

export interface LocalBook {
  gutenbergId: number;
  type: string;
  issued: string | null;
  title: string;
  language: string;
  /** Raw CSV string, e.g. "Kafka, Franz, 1883-1924; Brod, Max, 1884-1968" */
  authors: string | null;
  /** Semicolon-separated subjects, e.g. "Fiction; Metamorphosis -- Fiction" */
  subjects: string | null;
  /** Library of Congress Classification code */
  locc: string | null;
  /** Semicolon-separated bookshelves */
  bookshelves: string | null;
  importedAt: Date;
}

export interface BookListResult {
  books: LocalBook[];
  total: number;
  page: number;
  pages: number;
}

export interface BookSummaryResult {
  gutenbergId: number;
  shortSummary: string;
  longSummary: string;
  fromCache: boolean;
}

// ─── Author parsing ───────────────────────────────────────────────────────────

export interface ParsedAuthor {
  name: string;
  /** Display name with first name first */
  displayName: string;
  birthYear: number | null;
  deathYear: number | null;
}

/**
 * Parses the raw CSV authors string into structured author objects.
 * CSV format: "Lastname, Firstname, YYYY-YYYY; Lastname2, Firstname2, YYYY-YYYY"
 * Some entries have only a name, some have birth/death years appended.
 */
export function parseAuthors(authorsStr: string | null): ParsedAuthor[] {
  if (!authorsStr) return [];
  return authorsStr.split(";").map((raw) => {
    const part = raw.trim();
    // Try to extract years: "Kafka, Franz, 1883-1924" or "Kafka, Franz, 1883-"
    const yearMatch = part.match(/,\s*(\d{4})?-(\d{4})?$/);
    let name = part;
    let birthYear: number | null = null;
    let deathYear: number | null = null;
    if (yearMatch) {
      name = part.slice(0, part.lastIndexOf(",")).trim();
      birthYear = yearMatch[1] ? parseInt(yearMatch[1], 10) : null;
      deathYear = yearMatch[2] ? parseInt(yearMatch[2], 10) : null;
    }
    // Flip "Last, First" → "First Last"
    const nameParts = name.split(", ");
    const displayName = nameParts.length === 2
      ? `${nameParts[1]} ${nameParts[0]}`
      : name;
    return { name, displayName, birthYear, deathYear };
  }).filter((a) => a.name.length > 0);
}

export function getAuthorDisplay(book: LocalBook): string {
  const authors = parseAuthors(book.authors);
  if (authors.length === 0) return "Unbekannter Autor";
  return authors.map((a) => a.displayName).join(", ");
}

export function getAuthorYears(author: ParsedAuthor): string {
  if (author.birthYear && author.deathYear) return `(${author.birthYear}–${author.deathYear})`;
  if (author.birthYear) return `(* ${author.birthYear})`;
  return "";
}

// ─── Subject parsing ──────────────────────────────────────────────────────────

export function parseSubjects(subjectsStr: string | null): string[] {
  if (!subjectsStr) return [];
  return subjectsStr.split(";").map((s) => s.trim()).filter(Boolean);
}

export function parseBookshelves(bookshelvesStr: string | null): string[] {
  if (!bookshelvesStr) return [];
  return bookshelvesStr.split(";").map((s) => s.trim()).filter(Boolean);
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

/**
 * Returns our own cover endpoint URL, including title and author as query
 * parameters so the server can generate a typographic SVG fallback if no
 * real cover image is available.
 *
 * We never hotlink directly from gutenberg.org or openlibrary.org.
 */
export function getCoverUrl(book: LocalBook): string {
  const authors = parseAuthors(book.authors);
  const displayAuthor = authors[0]?.displayName ?? "";
  const params = new URLSearchParams({ title: book.title, author: displayAuthor });
  return `/api/covers/${book.gutenbergId}?${params.toString()}`;
}

/**
 * Cover URL by ID only — used when we only have the numeric ID stored
 * (e.g. in localStorage recent-books). No fallback metadata available here.
 */
export function getCoverUrlById(gutenbergId: number): string {
  return `/api/covers/${gutenbergId}`;
}

/**
 * Returns our own EPUB proxy endpoint URL.
 * The server serves the locally cached EPUB (downloaded via rsync).
 */
export function getEpubProxyUrl(gutenbergId: number): string {
  // The .epub extension is required: epub.js uses the URL file extension to
  // determine the input type (binary/epub/directory). Without it, epub.js
  // treats the URL as a directory and tries to load container.xml, which fails.
  return `/api/epubs/${gutenbergId}.epub`;
}

// ─── Subject translation map (English → German) ──────────────────────────────
// Gutenberg subjects from pg_catalog.csv are in English; we translate for display.

const SUBJECT_TRANSLATIONS: Record<string, string> = {
  // Genres & forms
  "Fiction": "Belletristik",
  "Drama": "Drama",
  "Poetry": "Lyrik",
  "Poems": "Gedichte",
  "Novel": "Roman",
  "Novels": "Romane",
  "Short stories": "Kurzgeschichten",
  "Short story": "Kurzgeschichte",
  "Essays": "Essays",
  "Satire": "Satire",
  "Fairy tales": "Märchen",
  "Fables": "Fabeln",
  "Legends": "Sagen",
  "Mythology": "Mythologie",
  "Adventure stories": "Abenteuergeschichten",
  "Adventure": "Abenteuer",
  "Romance": "Liebesroman",
  "Love stories": "Liebesgeschichten",
  "Detective fiction": "Kriminalroman",
  "Mystery fiction": "Kriminalroman",
  "Horror tales": "Horrorgeschichten",
  "Science fiction": "Science-Fiction",
  "Fantasy fiction": "Fantasy",
  "Historical fiction": "Historischer Roman",
  "Epistolary fiction": "Briefroman",
  "Humorous stories": "Humoristische Geschichten",
  "War stories": "Kriegsgeschichten",
  "Autobiographical fiction": "Autobiografischer Roman",
  "Bildungsromans": "Bildungsroman",
  // Subjects & themes
  "History": "Geschichte",
  "Philosophy": "Philosophie",
  "Science": "Wissenschaft",
  "Biography": "Biografie",
  "Autobiography": "Autobiografie",
  "Memoirs": "Memoiren",
  "Travel": "Reise",
  "Religion": "Religion",
  "Theology": "Theologie",
  "Ethics": "Ethik",
  "Logic": "Logik",
  "Psychology": "Psychologie",
  "Sociology": "Soziologie",
  "Politics": "Politik",
  "Economics": "Wirtschaft",
  "Law": "Recht",
  "Education": "Bildung",
  "Music": "Musik",
  "Art": "Kunst",
  "Architecture": "Architektur",
  "Nature": "Natur",
  "Animals": "Tiere",
  "Children's literature": "Kinderliteratur",
  "Children": "Kinder",
  "War": "Krieg",
  "Death": "Tod",
  "Love": "Liebe",
  "Family": "Familie",
  "Society": "Gesellschaft",
  "Identity": "Identität",
  "Morality": "Moral",
  "Classicism": "Klassizismus",
  "Romanticism": "Romantik",
  "Realism": "Realismus",
  "Expressionism": "Expressionismus",
  "Naturalism": "Naturalismus",
  "Modernism": "Moderne",
  "Enlightenment": "Aufklärung",
  "Baroque": "Barock",
  "Medieval": "Mittelalter",
  "Classical literature": "Klassische Literatur",
  "German literature": "Deutsche Literatur",
  "Austrian literature": "Österreichische Literatur",
  "Swiss literature": "Schweizer Literatur",
  "Correspondence": "Briefwechsel",
  "Letters": "Briefe",
  "Diaries": "Tagebücher",
  "Speeches": "Reden",
  "Translations": "Übersetzungen",
};

/**
 * Translate a Gutenberg subject string to German.
 * Handles compound subjects like "Germans -- Fiction" by translating each part.
 * Falls back to the original string if no translation is found.
 */
export function translateSubject(subject: string): string {
  const mainPart = subject.replace(/ -- .+$/, "").trim();
  if (SUBJECT_TRANSLATIONS[mainPart]) return SUBJECT_TRANSLATIONS[mainPart];
  const lower = mainPart.toLowerCase();
  const key = Object.keys(SUBJECT_TRANSLATIONS).find((k) => k.toLowerCase() === lower);
  if (key) return SUBJECT_TRANSLATIONS[key];
  for (const [en, de] of Object.entries(SUBJECT_TRANSLATIONS)) {
    if (mainPart.includes(en)) return de;
  }
  return mainPart;
}

// ─── Curated German filter topics ────────────────────────────────────────────

export const FILTER_TOPICS: { label: string; value: string }[] = [
  { label: "Belletristik", value: "Fiction" },
  { label: "Drama", value: "Drama" },
  { label: "Lyrik", value: "Poetry" },
  { label: "Roman", value: "Novel" },
  { label: "Kurzgeschichten", value: "Short stories" },
  { label: "Geschichte", value: "History" },
  { label: "Philosophie", value: "Philosophy" },
  { label: "Wissenschaft", value: "Science" },
  { label: "Biografie", value: "Biography" },
  { label: "Märchen", value: "Fairy tales" },
  { label: "Abenteuer", value: "Adventure" },
  { label: "Kriminalroman", value: "Detective" },
  { label: "Klassik", value: "Classical" },
  { label: "Romantik", value: "Romanticism" },
  { label: "Expressionismus", value: "Expressionism" },
  { label: "Realismus", value: "Realism" },
  { label: "Kinder", value: "Children" },
  { label: "Reise", value: "Travel" },
];
