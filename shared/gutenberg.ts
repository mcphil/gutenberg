/**
 * shared/gutenberg.ts
 *
 * Shared types and helpers for the Gutenberg Navigator app.
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
  /**
   * Explicit copyright override for Germany (§ 64 UrhG).
   * null  = use automatic heuristic.
   * 0     = definitively public domain.
   * YYYY  = protected until end of that year.
   */
  copyrightProtectedUntil: number | null;
  /**
   * Pre-generated short summary (German). Included in list queries via LEFT JOIN
   * on book_summaries so covers render correct keywords without extra requests.
   */
  shortSummary?: string | null;
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
 *
 * Gutenberg CSV format examples:
 *   "Kafka, Franz, 1883-1924"
 *   "Berger, Alfred von [Contributor]"
 *   "Gomperz, Theodor [Translator]"
 *   "Aristotele"
 *
 * We extract the optional [Role] annotation first, then strip birth/death
 * years, then flip "Lastname, Firstname" → "Firstname Lastname", and finally
 * re-attach the role so the display reads "Firstname Lastname [Role]".
 */
export function parseAuthors(authorsStr: string | null): ParsedAuthor[] {
  if (!authorsStr) return [];
  return authorsStr.split(";").map((raw) => {
    let part = raw.trim();

    // 1. Extract optional [Role] annotation (e.g. "[Contributor]", "[Translator]")
    const roleMatch = part.match(/(\s*\[[^\]]+\])$/);
    const roleAnnotation = roleMatch ? roleMatch[1].trimStart() : "";
    if (roleMatch) {
      part = part.slice(0, part.length - roleMatch[1].length).trim();
    }

    // 2. Extract birth/death years: "Kafka, Franz, 1883-1924" or "Kafka, Franz, 1883-"
    const yearMatch = part.match(/,\s*(\d{4})?-(\d{4})?$/);
    let name = part;
    let birthYear: number | null = null;
    let deathYear: number | null = null;
    if (yearMatch) {
      name = part.slice(0, part.lastIndexOf(",")).trim();
      birthYear = yearMatch[1] ? parseInt(yearMatch[1], 10) : null;
      deathYear = yearMatch[2] ? parseInt(yearMatch[2], 10) : null;
    }

    // 3. Flip "Lastname, Firstname" → "Firstname Lastname"
    const nameParts = name.split(", ");
    const flippedName = nameParts.length === 2
      ? `${nameParts[1]} ${nameParts[0]}`
      : name;

    // 4. Re-attach role annotation after the name
    const displayName = roleAnnotation
      ? `${flippedName} ${roleAnnotation}`
      : flippedName;

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

// ─── Subject & Bookshelf translations (EN → DE) ─────────────────────────────
//
// Gutenberg.org stores all metadata in English. We translate on the fly in the
// UI layer so the raw DB values remain unchanged (easier to re-import).

/** Exact-match translations for bookshelves (most are "Category: *" prefixed). */
const BOOKSHELF_TRANSLATIONS: Record<string, string> = {
  // Category: prefixed
  "Category: German Literature": "Deutsche Literatur",
  "Category: Novels": "Romane",
  "Category: History - European": "Geschichte – Europa",
  "Category: Plays/Films/Dramas": "Drama & Theater",
  "Category: Philosophy & Ethics": "Philosophie & Ethik",
  "Category: Short Stories": "Kurzgeschichten",
  "Category: Biographies": "Biografien",
  "Category: Poetry": "Lyrik",
  "Category: Historical Novels": "Historische Romane",
  "Category: History - Modern (1750+)": "Geschichte – Neuzeit (1750+)",
  "Category: Travel Writing": "Reisebeschreibungen",
  "Category: Mythology, Legends & Folklore": "Mythologie, Sagen & Folklore",
  "Category: Humour": "Humor & Satire",
  "Category: Adventure": "Abenteuer",
  "Category: Essays, Letters & Speeches": "Essays, Briefe & Reden",
  "Category: Archaeology & Anthropology": "Archäologie & Anthropologie",
  "Category: Children & Young Adult Reading": "Kinder- & Jugendliteratur",
  "Category: Art": "Kunst",
  "Category: History - Other": "Geschichte – Sonstiges",
  "Category: Classics of Literature": "Literarische Klassiker",
  "Category: Science - Biology": "Naturwissenschaft – Biologie",
  "Category: Russian Literature": "Russische Literatur",
  "Category: Religion/Spirituality": "Religion & Spiritualität",
  "Category: Science-Fiction & Fantasy": "Science-Fiction & Fantasy",
  "Category: History - Warfare": "Geschichte – Kriegsgeschichte",
  "Category: Romance": "Liebesromane",
  "Category: Nature/Gardening/Animals": "Natur, Garten & Tiere",
  "Category: Psychiatry/Psychology": "Psychiatrie & Psychologie",
  "Category: History - Early Modern (c. 1450-1750)": "Geschichte – Frühe Neuzeit (1450–1750)",
  "Category: Language & Communication": "Sprache & Kommunikation",
  "Category: How To ...": "Ratgeber",
  "Category: Health & Medicine": "Gesundheit & Medizin",
  "Category: History - Ancient": "Geschichte – Antike",
  "Category: Encyclopedias/Dictionaries/Reference": "Lexika & Nachschlagewerke",
  "Category: Teaching & Education": "Pädagogik & Bildung",
  "Category: British Literature": "Britische Literatur",
  "Category: Science - Earth/Agricultural/Farming": "Naturwissenschaft – Erd- & Agrarwissenschaften",
  "Category: French Literature": "Französische Literatur",
  "Category: Engineering & Technology": "Ingenieurwesen & Technik",
  "Category: Science - Physics": "Naturwissenschaft – Physik",
  "Category: Environmental Issues": "Umwelt & Ökologie",
  "Category: Sociology": "Soziologie",
  "Category: History - Religious": "Geschichte – Religionsgeschichte",
  "Category: History - Medieval/Middle Ages": "Geschichte – Mittelalter",
  "Category: American Literature": "Amerikanische Literatur",
  "Category: History - British": "Geschichte – Britische Geschichte",
  "Category: Architecture": "Architektur",
  "Category: Science - Chemistry/Biochemistry": "Naturwissenschaft – Chemie & Biochemie",
  "Category: Music": "Musik",
  "Category: Economics": "Wirtschaft",
  "Category: Gender & Sexuality Studies": "Gender & Sexualität",
  "Category: Mathematics": "Mathematik",
  "Category: Law & Criminology": "Recht & Kriminologie",
  "Category: Business/Management": "Wirtschaft & Management",
  "Category: Politics": "Politik",
  "Category: Crime, Thrillers and Mystery": "Krimi & Thriller",
  "Category: History - Royalty": "Geschichte – Adel & Monarchie",
  "Category: Sexuality & Erotica": "Erotik",
  "Category: History - American": "Geschichte – Amerikanische Geschichte",
  "Category: Drugs/Alcohol/Pharmacology": "Pharmakologie & Sucht",
  "Category: Parenthood & Family Relations": "Familie & Erziehung",
  "Category: Journals": "Zeitschriften & Journale",
  "Category: Cooking & Drinking": "Kochen & Trinken",
  "Category: Reports & Conference Proceedings": "Berichte & Konferenzen",
  "Category: Literature - Other": "Literatur – Sonstiges",
  "Category: History - Schools & Universities": "Geschichte – Bildungsgeschichte",
  "Category: Journalism/Media/Writing": "Journalismus & Medien",
  "Category: Fashion": "Mode",
  "Category: Sports/Hobbies": "Sport & Hobbys",
  "Category: Nutrition": "Ernährung",
  "Category: Research Methods/Statistics/Information Sys": "Forschungsmethoden & Statistik",
  // Non-prefixed
  "Nobel Prizes in Literature": "Nobelpreisträger Literatur",
  "German Language Books": "Deutschsprachige Bücher",
  "Harvard Classics": "Harvard Classics",
  "Children's Literature": "Kinderliteratur",
  "Best Books Ever Listings": "Beste Bücher aller Zeiten",
  "Banned Books from Anne Haight's list": "Verbotene Bücher",
  "Philosophy": "Philosophie",
  "Mathematics": "Mathematik",
  "Opera": "Oper",
  "Physics": "Physik",
  "Anthropology": "Anthropologie",
  "Art": "Kunst",
  "Judaism": "Judentum",
  "Music": "Musik",
  "World War I": "Erster Weltkrieg",
  "Language Education": "Sprachbildung",
  "Erotic Fiction": "Erotische Literatur",
  "One Act Plays": "Einakter",
  "Children's Picture Books": "Bilderbücher",
  "Folklore": "Folklore",
  "Microbiology": "Mikrobiologie",
  "Botany": "Botanik",
  "Sociology": "Soziologie",
  "Women in Science, Technology, Engineering, and Mathematics": "Frauen in MINT",
  "Christianity": "Christentum",
  "Atheism": "Atheismus",
  "Christmas": "Weihnachten",
  "United Kingdom": "Vereinigtes Königreich",
  "Italy": "Italien",
  "United States": "Vereinigte Staaten",
  "South Africa": "Südafrika",
  "Historical Fiction": "Historische Romane",
  "Geology": "Geologie",
  "Classical Antiquity": "Klassische Antike",
  "Crime Fiction": "Kriminalliteratur",
  "Biology": "Biologie",
  "Zoology": "Zoologie",
  "Psychology": "Psychologie",
  "Children's Myths, Fairy Tales, etc.": "Märchen & Sagen",
  "Horticulture": "Gartenbau",
  "Greece": "Griechenland",
  "Physiology": "Physiologie",
  "Argentina": "Argentinien",
  "Cookbooks and Cooking": "Kochbücher",
  "Mycology": "Mykologie",
  "Precursors of Science Fiction": "Vorläufer der Science-Fiction",
  "Esperanto": "Esperanto",
  "Humor": "Humor",
  "Africa": "Afrika",
  "Germany": "Deutschland",
};

/** Prefix/pattern translations for subjects (applied in order). */
const SUBJECT_TRANSLATIONS: Array<[RegExp | string, string]> = [
  // Exact matches first
  ["Fiction", "Belletristik"],
  ["Poetry", "Lyrik"],
  ["Drama", "Drama"],
  ["Autobiographies", "Autobiografien"],
  ["Psychoanalysis", "Psychoanalyse"],
  ["Philosophy", "Philosophie"],
  ["Satire", "Satire"],
  ["Aesthetics", "Ästhetik"],
  ["Ethnology", "Ethnologie"],
  ["Mathematics", "Mathematik"],
  ["Science fiction", "Science-Fiction"],
  ["Comedy plays", "Komödien"],
  ["Historical fiction", "Historische Romane"],
  ["Love stories", "Liebesgeschichten"],
  ["Adventure stories", "Abenteuergeschichten"],
  ["Fairy tales", "Märchen"],
  ["Didactic fiction", "Lehrhafte Literatur"],
  ["Psychological fiction", "Psychologische Romane"],
  ["Bildungsromans", "Bildungsromane"],
  ["Tragedies (Drama)", "Tragödien"],
  // Regex patterns for compound subjects
  [/^German fiction/, "Deutsche Prosa"],
  [/^Short stories, German/, "Deutsche Kurzgeschichten"],
  [/^Short stories, Austrian/, "Österreichische Kurzgeschichten"],
  [/^Short stories/, "Kurzgeschichten"],
  [/^German poetry/, "Deutsche Lyrik"],
  [/^German drama/, "Deutsches Drama"],
  [/^German literature/, "Deutsche Literatur"],
  [/^German wit and humor/, "Deutscher Humor"],
  [/^Austrian fiction/, "Österreichische Prosa"],
  [/^Children's stories, German/, "Deutsche Kindergeschichten"],
  [/^Children's poetry, German/, "Deutsche Kinderlyrik"],
  [/^Russian fiction.*Translations into German/, "Russische Prosa (Übersetzung)"],
  [/^Russian fiction/, "Russische Prosa"],
  [/^Philosophy, German/, "Deutsche Philosophie"],
  [/^Fairy tales.*Germany/, "Deutsche Märchen"],
  [/^Nature conservation.*Germany/, "Naturschutz in Deutschland"],
  [/^Saxony.*Periodicals/, "Sachsen – Periodika"],
  [/^Germany.*Fiction/, "Deutschland – Belletristik"],
  [/^Germany, Northern.*Fiction/, "Norddeutschland – Belletristik"],
  [/^Italy.*Fiction/, "Italien – Belletristik"],
  [/^Switzerland.*Fiction/, "Schweiz – Belletristik"],
  [/^Norway.*Fiction/, "Norwegen – Belletristik"],
  [/^Russia.*Fiction/, "Russland – Belletristik"],
  [/^South America.*Description and travel/, "Südamerika – Reisebeschreibungen"],
  [/^United States.*Description and travel/, "USA – Reisebeschreibungen"],
  [/^Voyages around the world/, "Weltreisen"],
  [/^Man-woman relationships.*Fiction/, "Liebesbeziehungen – Belletristik"],
  [/^Speeches, addresses/, "Reden & Ansprachen"],
  [/^World War, 1914-1918.*Fiction/, "Erster Weltkrieg – Belletristik"],
  [/^Great Britain.*History.*James II/, "Großbritannien – Geschichte (Jakob II.)"],
  [/^Great Britain.*History.*William and Mary/, "Großbritannien – Geschichte (Wilhelm & Maria)"],
  [/^English language.*Dictionaries.*German/, "Englisch-Deutsch Wörterbuch"],
  [/^German language.*Dictionaries.*English/, "Deutsch-Englisch Wörterbuch"],
  // Catholic Church subject
  [/^Catholic Church/, "Katholische Kirche"],
];

/** Translate a single subject or bookshelf string to German. */
function translateTag(raw: string): string {
  // 1. Check exact bookshelf match
  if (BOOKSHELF_TRANSLATIONS[raw]) return BOOKSHELF_TRANSLATIONS[raw];
  // 2. Check subject translations (exact string or regex)
  for (const [pattern, translation] of SUBJECT_TRANSLATIONS) {
    if (typeof pattern === "string" ? raw === pattern : pattern.test(raw)) {
      return translation;
    }
  }
  // 3. Return original if no translation found
  return raw;
}

/** @deprecated Use translateTag via parseSubjects/parseBookshelves instead */
export const translateSubject = translateTag;

// ─── Subject parsing ──────────────────────────────────────────────────────────

export function parseSubjects(subjectsStr: string | null): string[] {
  if (!subjectsStr) return [];
  return subjectsStr.split(";").map((s) => translateTag(s.trim())).filter(Boolean);
}

export function parseBookshelves(bookshelvesStr: string | null): string[] {
  if (!bookshelvesStr) return [];
  return bookshelvesStr.split(";").map((s) => translateTag(s.trim())).filter(Boolean);
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

// ─── German copyright check (§ 64 UrhG) ────────────────────────────────────

/**
 * Returns true if the book is still under copyright in Germany.
 *
 * German law (§ 64 UrhG): copyright expires 70 years after the author's death.
 * A book is protected if ANY primary author died within the last 70 years.
 *
 * Conservative rule for unknown death years:
 *   - If no death year is found for any author, we treat the book as
 *     PROTECTED (unknown = potentially still in copyright).
 *   - Editors/Translators/Contributors in [Role] brackets are excluded from
 *     the check — only the primary author(s) matter.
 *
 * @param authorsStr  Raw CSV authors string from the books table
 * @param referenceYear  Year to check against (defaults to current year)
 */
export function isCopyrightProtectedDE(
  authorsStr: string | null,
  referenceYear: number = new Date().getFullYear(),
  copyrightProtectedUntil?: number | null
): boolean {
  // ── 1. Explicit database override ────────────────────────────────────────
  if (copyrightProtectedUntil !== undefined && copyrightProtectedUntil !== null) {
    if (copyrightProtectedUntil === 0) return false;          // explicitly public domain
    return referenceYear <= copyrightProtectedUntil;          // protected until year X
  }

  // ── 2. No authors string → conservative: assume protected ────────────────
  if (!authorsStr) return true;

  const authors = parseAuthors(authorsStr);

  // Only consider primary authors (no [Translator], [Editor], [Contributor] etc.)
  const primaryAuthors = authors.filter(
    (a) => !a.displayName.match(/\[(Translator|Editor|Contributor|Illustrator|Compiler|Annotator|Commentator|Adapter|Arranger|Foreword|Introduction|Preface)\]/i)
  );

  if (primaryAuthors.length === 0) return true;

  for (const author of primaryAuthors) {
    if (author.deathYear !== null) {
      // Known death year: standard 70-year rule
      if (referenceYear - author.deathYear < 70) return true;
    } else if (author.birthYear !== null) {
      // No death year but birth year known:
      // If born before 1880, assume they died before 1956 → public domain
      // If born 1880+, we cannot safely assume → conservative: protected
      if (author.birthYear >= 1880) return true;
      // else: ancient enough, fall through to public domain
    } else {
      // No dates at all: check if the name looks like an ancient/classical author
      // (heuristic: if the raw author string contains no year digits at all,
      //  and the name matches known ancient patterns, treat as public domain)
      const hasAnyYear = /\d{3,4}/.test(authorsStr);
      if (!hasAnyYear) {
        // Completely undated — could be ancient (Aristoteles) or could be modern
        // anonymous. We treat as public domain only if the name appears in our
        // known-ancient list; otherwise conservative.
        const ancientNames = [
          "aristotel", "homer", "plato", "platon", "sokrates", "cicero",
          "virgil", "vergil", "ovid", "horaz", "tacitus", "caesar",
          "sophokles", "euripides", "aischylos", "herodot", "thukydides",
          "seneca", "marcus aurelius", "epiktet", "plutarch", "livius",
          "anonymous", "anonym", "unbekannt", "various",
        ];
        const nameLower = authorsStr.toLowerCase();
        const isAncient = ancientNames.some((n) => nameLower.includes(n));
        if (!isAncient) return true; // unknown, undated, not ancient → protected
        // else: known ancient → public domain, fall through
      } else {
        // Has year digits but we couldn't parse them → conservative
        return true;
      }
    }
  }

  return false; // all primary authors determined to be public domain
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
