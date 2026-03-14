/**
 * generate-static-html.ts
 *
 * Pre-generates static HTML files for all book and author pages.
 * Each file contains correct OG meta tags, Twitter Card, JSON-LD, and canonical URL.
 *
 * Output structure:
 *   dist/public/book/:id/index.html
 *   dist/public/author/:encodedName/index.html
 *
 * Run after Vite build: `tsx server/scripts/generate-static-html.ts`
 * The Manus proxy serves static files directly — no Express needed for meta tags.
 */

import fs from "fs";
import path from "path";
import { getDb } from "../db";
import { books } from "../../drizzle/schema";
import { getAuthorDisplay, parseAuthors, getAuthorYears } from "../../shared/gutenberg";

const DOMAIN = "https://gutenberg-navigator.de";
const DEFAULT_IMAGE = `https://d2xsxph8kpxj0f.cloudfront.net/101220242/8bBPXpc4UL9EF8BMEK3VX4/og-default-7NWyT8M7cry3iFwVNKMeuJ.png`;
// Output to client/public so Vite copies these files to dist/public during build.
// This avoids needing DB access in the deployment environment.
const CLIENT_PUBLIC = path.resolve(process.cwd(), "client/public");
// For the HTML template, we still need the built index.html (run after vite build)
const DIST_PUBLIC = path.resolve(process.cwd(), "dist/public");
const INDEX_HTML = path.join(DIST_PUBLIC, "index.html");

// We build a minimal HTML shell that contains only the meta tags + the
// external script/CSS references from the real index.html.
// This avoids copying the 370KB inline JS blob into every generated file.
function buildShellHtml(indexHtml: string): string {
  // Extract external <script src=...> and <link rel="stylesheet" href=...> tags
  const scriptTags = (indexHtml.match(/<script[^>]+src="[^"]+"[^>]*><\/script>/g) || []).join("\n    ");
  const linkTags = (indexHtml.match(/<link[^>]+rel="stylesheet"[^>]+>/g) || []).join("\n    ");
  // Extract favicon/icon links
  const iconTags = (indexHtml.match(/<link[^>]+rel="(?:icon|apple-touch-icon)[^"]*"[^>]*>/g) || []).join("\n    ");
  return `<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5" />\n  ${iconTags}\n  ${linkTags}\n  INJECT_META_HERE\n</head>\n<body><div id="root"></div>\n  ${scriptTags}\n</body>\n</html>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

interface MetaData {
  title: string;
  description: string;
  url: string;
  image: string;
  ogType?: string;
  jsonLd?: object;
}

function buildMetaTags(meta: MetaData): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const u = escapeHtml(meta.url);
  const img = escapeHtml(meta.image);
  const ogType = meta.ogType ?? "website";
  const jsonLdTag = meta.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`
    : "";
  return `
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${u}" />
    <!-- Open Graph -->
    <meta property="og:type" content="${ogType}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${u}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:width" content="400" />
    <meta property="og:image:height" content="560" />
    <meta property="og:image:type" content="image/webp" />
    <meta property="og:image:alt" content="${t}" />
    <meta property="og:locale" content="de_DE" />
    <meta property="og:site_name" content="Gutenberg Navigator" />
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />
    ${jsonLdTag}`;
}

function injectMeta(shell: string, meta: MetaData): string {
  const tags = buildMetaTags(meta);
  // The shell template uses INJECT_META_HERE as a placeholder
  return shell.replace("INJECT_META_HERE", tags);
}

// ─── Book HTML generator ──────────────────────────────────────────────────────

function buildBookMeta(book: typeof books.$inferSelect): MetaData {
  const authorDisplay = getAuthorDisplay(book as Parameters<typeof getAuthorDisplay>[0]);
  const authors = parseAuthors(book.authors);
  const title = `${book.title} — ${authorDisplay} | Gutenberg Navigator`;
  const description = truncate(
    `„${book.title}" von ${authorDisplay}. Kostenlos lesen auf Gutenberg Navigator — über 2.400 deutschsprachige Klassiker.`,
    160
  );
  const url = `${DOMAIN}/book/${book.gutenbergId}`;
  const image = `${DOMAIN}/api/covers/${book.gutenbergId}`;

  const jsonLd: object = {
    "@context": "https://schema.org",
    "@type": "Book",
    "@id": url,
    "name": book.title,
    "url": url,
    "inLanguage": "de",
    "author": authors
      .filter(a => !a.displayName.match(/\[(Translator|Editor|Contributor|Illustrator|Compiler)\]/i))
      .map(a => {
        const years = getAuthorYears(a);
        const entry: Record<string, string> = { "@type": "Person", "name": a.displayName };
        if (years) entry["description"] = years;
        return entry;
      }),
    "publisher": {
      "@type": "Organization",
      "name": "Project Gutenberg",
      "url": "https://www.gutenberg.org",
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "EUR",
      "availability": "https://schema.org/InStock",
    },
    "potentialAction": { "@type": "ReadAction", "target": url },
  };

  return { title, description, url, image, ogType: "book", jsonLd };
}

// ─── Author HTML generator ────────────────────────────────────────────────────

function buildAuthorMeta(
  authorName: string,
  books: Array<{ gutenbergId: number }>
): MetaData {
  const count = books.length;
  const title = `${authorName} — ${count} Werk${count !== 1 ? "e" : ""} | Gutenberg Navigator`;
  const description = truncate(
    `Alle ${count} deutschsprachigen Werke von ${authorName} kostenlos lesen auf Gutenberg Navigator.`,
    160
  );
  const url = `${DOMAIN}/author/${encodeURIComponent(authorName)}`;
  const image = books[0] ? `${DOMAIN}/api/covers/${books[0].gutenbergId}` : DEFAULT_IMAGE;

  const jsonLd: object = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": authorName,
    "url": url,
    "mainEntityOfPage": url,
  };

  return { title, description, url, image, jsonLd };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(INDEX_HTML)) {
    console.error(`[generate-static-html] index.html not found at ${INDEX_HTML}`);
    console.error("Run 'pnpm build' (Vite step) before this script.");
    process.exit(1);
  }

  const indexHtml = fs.readFileSync(INDEX_HTML, "utf-8");
  const template = buildShellHtml(indexHtml);
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error("DB connection failed");

  // ── Fetch all books ──
  console.log("[generate-static-html] Fetching all books from DB...");
  const allBooks = await dbInstance.select().from(books);
  console.log(`[generate-static-html] Found ${allBooks.length} books`);

  // ── Generate book pages ──
  let bookCount = 0;
  let bookErrors = 0;
  for (const book of allBooks) {
    try {
      const meta = buildBookMeta(book);
      const html = injectMeta(template, meta);
      const dir = path.join(CLIENT_PUBLIC, "book", String(book.gutenbergId));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "index.html"), html, "utf-8");
      bookCount++;
      if (bookCount % 500 === 0) {
        console.log(`[generate-static-html] Books: ${bookCount}/${allBooks.length}`);
      }
    } catch (err) {
      bookErrors++;
      console.error(`[generate-static-html] Error for book ${book.gutenbergId}:`, err);
    }
  }
  console.log(`[generate-static-html] ✓ Generated ${bookCount} book pages (${bookErrors} errors)`);

  // ── Collect unique authors ──
  console.log("[generate-static-html] Collecting unique authors...");
  const authorMap = new Map<string, Array<{ gutenbergId: number }>>();
  for (const book of allBooks) {
    const authors = parseAuthors(book.authors);
    for (const author of authors) {
      const name = author.displayName;
      if (!name || name.match(/\[(Translator|Editor|Contributor|Illustrator|Compiler)\]/i)) continue;
      if (!authorMap.has(name)) authorMap.set(name, []);
      authorMap.get(name)!.push({ gutenbergId: book.gutenbergId });
    }
  }
  console.log(`[generate-static-html] Found ${authorMap.size} unique authors`);

  // ── Generate author pages ──
  let authorCount = 0;
  let authorErrors = 0;
  for (const [authorName, authorBooks] of Array.from(authorMap.entries())) {
    try {
      const meta = buildAuthorMeta(authorName, authorBooks);
      const html = injectMeta(template, meta);
      const encoded = encodeURIComponent(authorName);
      const dir = path.join(CLIENT_PUBLIC, "author", encoded);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "index.html"), html, "utf-8");
      authorCount++;
    } catch (err) {
      authorErrors++;
      console.error(`[generate-static-html] Error for author "${authorName}":`, err);
    }
  }
  console.log(`[generate-static-html] ✓ Generated ${authorCount} author pages (${authorErrors} errors)`);

  console.log(`[generate-static-html] Done. Total: ${bookCount + authorCount} HTML files.`);
  process.exit(0);
}

main().catch(err => {
  console.error("[generate-static-html] Fatal error:", err);
  process.exit(1);
});
