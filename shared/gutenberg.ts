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

/**
 * Returns our own cover endpoint URL, including title and author as query
 * parameters so the server can generate a typographic SVG fallback if no
 * real cover image is available.
 *
 * We never hotlink directly from gutenberg.org or openlibrary.org.
 */
export function getCoverUrl(book: GutenbergBook): string {
  const authorName = book.authors[0]?.name ?? "";
  // Gutenberg stores names as "Surname, Firstname" — flip for display
  const parts = authorName.split(", ");
  const displayAuthor = parts.length === 2 ? `${parts[1]} ${parts[0]}` : authorName;
  const params = new URLSearchParams({ title: book.title, author: displayAuthor });
  return `/api/covers/${book.id}?${params.toString()}`;
}

/**
 * Cover URL by ID only — used when we only have the numeric ID stored
 * (e.g. in localStorage recent-books). No fallback metadata available here.
 */
export function getCoverUrlById(gutenbergId: number): string {
  return `/api/covers/${gutenbergId}`;
}

/**
 * Returns the raw Gutendex EPUB URL for a book (if available).
 * Use getEpubProxyUrl() in the frontend instead — this is only for passing
 * the known URL to the server as a hint.
 */
export function getEpubUrl(book: GutenbergBook): string | null {
  return book.formats["application/epub+zip"] || null;
}

/**
 * Returns our own EPUB proxy endpoint URL.
 * The server downloads the EPUB on first request and caches it locally —
 * we never stream directly from gutenberg.org.
 *
 * The ?url= parameter passes the known Gutendex EPUB URL as a hint so the
 * server can try it first before falling back to constructed candidate URLs.
 */
export function getEpubProxyUrl(book: GutenbergBook): string | null {
  const rawUrl = getEpubUrl(book);
  if (!rawUrl) return null; // No EPUB available for this book
  const params = new URLSearchParams({ url: rawUrl });
  return `/api/epubs/${book.id}?${params.toString()}`;
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

// ─── Subject translation map (English → German) ──────────────
// Gutendex subjects are always in English; we translate for display.

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
  // Strip the " -- subtype" suffix pattern (e.g. "Germans -- Fiction" → "Germans")
  const mainPart = subject.replace(/ -- .+$/, "").trim();

  // Direct lookup
  if (SUBJECT_TRANSLATIONS[mainPart]) return SUBJECT_TRANSLATIONS[mainPart];

  // Case-insensitive lookup
  const lower = mainPart.toLowerCase();
  const key = Object.keys(SUBJECT_TRANSLATIONS).find((k) => k.toLowerCase() === lower);
  if (key) return SUBJECT_TRANSLATIONS[key];

  // Partial match for compound subjects
  for (const [en, de] of Object.entries(SUBJECT_TRANSLATIONS)) {
    if (mainPart.includes(en)) return de;
  }

  // Return original if no translation found
  return mainPart;
}

// ─── Curated German filter topics ────────────────────────────
// These map display labels to Gutendex topic query values.

export const FILTER_TOPICS: { label: string; value: string }[] = [
  { label: "Belletristik", value: "fiction" },
  { label: "Drama", value: "drama" },
  { label: "Lyrik", value: "poetry" },
  { label: "Roman", value: "novel" },
  { label: "Kurzgeschichten", value: "short stories" },
  { label: "Geschichte", value: "history" },
  { label: "Philosophie", value: "philosophy" },
  { label: "Wissenschaft", value: "science" },
  { label: "Biografie", value: "biography" },
  { label: "Märchen", value: "fairy tales" },
  { label: "Abenteuer", value: "adventure" },
  { label: "Kriminalroman", value: "detective" },
  { label: "Klassik", value: "classical" },
  { label: "Romantik", value: "romanticism" },
  { label: "Expressionismus", value: "expressionism" },
  { label: "Realismus", value: "realism" },
  { label: "Kinder", value: "children" },
  { label: "Reise", value: "travel" },
];
