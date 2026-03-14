/**
 * meta.ts
 *
 * Server-side meta tag injection for SPA routes.
 *
 * For /book/:id and /author/:name, the server fetches data from the DB and
 * injects dynamic <title>, <meta>, Open Graph, Twitter Card, and JSON-LD tags
 * into the HTML shell before sending it to the client.
 *
 * This ensures Googlebot and social crawlers see the correct metadata without
 * needing to execute JavaScript.
 */

import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { getBookById, getBooksByAuthor } from "./db";
import { getAuthorDisplay, parseAuthors, getAuthorYears } from "../shared/gutenberg";

const DOMAIN = "https://gutenberg-navigator.de";
const DEFAULT_TITLE = "Gutenberg Navigator — Deutschsprachige Werke";
const DEFAULT_DESC =
  "Erkunde und lies über 2.400 deutschsprachige Werke aus der Gutenberg.org Bibliothek. Mit integriertem EPUB-Reader, KI-Zusammenfassungen und Browse-Modus.";
const DEFAULT_IMAGE = `${DOMAIN}/og-default.png`;

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
  const { title, description, url, image, jsonLd } = meta;
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(url);
  const img = escapeHtml(image);

  const jsonLdTag = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : "";

  return `
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${u}" />
    <!-- Open Graph -->
    <meta property="og:type" content="${meta.ogType ?? 'website'}" />
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

function injectMeta(html: string, meta: MetaData): string {
  const tags = buildMetaTags(meta);
  // Remove all existing meta tags that we will replace with dynamic ones:
  // - <title> (static)
  // - <meta name="description"> (static)
  // - All <meta property="og:*"> tags (Open Graph)
  // - All <meta name="twitter:*"> tags (Twitter Card)
  // - HTML comments labelling these sections (<!-- Open Graph -->, <!-- Twitter Card -->)
  // - <link rel="canonical"> (we inject a fresh one)
  // This prevents duplicate tags which would cause crawlers to use the wrong (generic) values.
  return html
    .replace(/<title>[^<]*<\/title>/, "") // remove static title
    .replace(/<meta name="description"[^>]*\/>/g, "") // remove static description
    .replace(/<meta property="og:[^>]*\/>/g, "") // remove all og: meta tags
    .replace(/<meta name="twitter:[^>]*\/>/g, "") // remove all twitter: meta tags
    .replace(/<link rel="canonical"[^>]*\/>/g, "") // remove existing canonical
    .replace(/<!--\s*Open Graph\s*-->/g, "") // remove OG comment
    .replace(/<!--\s*Twitter Card\s*-->/g, "") // remove Twitter comment
    .replace("</head>", `<!-- ssr-meta-injected -->\n  ${tags}\n  </head>`);
}

// ─── Book meta builder ────────────────────────────────────────────────────────

async function buildBookMeta(bookId: number): Promise<MetaData | null> {
  const book = await getBookById(bookId);
  if (!book) return null;

  const authorDisplay = getAuthorDisplay(book);
  const authors = parseAuthors(book.authors);

  const title = `${book.title} — ${authorDisplay} | Gutenberg Navigator`;
  const description = truncate(
    `„${book.title}" von ${authorDisplay}. Kostenlos lesen auf Gutenberg Navigator — über 2.400 deutschsprachige Klassiker.`,
    160
  );
  const url = `${DOMAIN}/book/${bookId}`;
  const image = `${DOMAIN}/api/covers/${bookId}`;

  // JSON-LD: schema.org/Book
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
        const entry: Record<string, string> = {
          "@type": "Person",
          "name": a.displayName,
        };
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
    "potentialAction": {
      "@type": "ReadAction",
      "target": url,
    },
  };

  return { title, description, url, image, ogType: "book", jsonLd };
}

// ─── Author meta builder ──────────────────────────────────────────────────────

async function buildAuthorMeta(authorName: string): Promise<MetaData | null> {
  const authorBooks = await getBooksByAuthor(authorName);
  if (!authorBooks || authorBooks.length === 0) return null;

  const count = authorBooks.length;
  const title = `${authorName} — ${count} Werk${count !== 1 ? "e" : ""} | Gutenberg Navigator`;
  const description = truncate(
    `Alle ${count} deutschsprachigen Werke von ${authorName} kostenlos lesen auf Gutenberg Navigator.`,
    160
  );
  const url = `${DOMAIN}/author/${encodeURIComponent(authorName)}`;

  // Use cover of the first book as OG image
  const firstBook = authorBooks[0];
  const image = firstBook
    ? `${DOMAIN}/api/covers/${firstBook.gutenbergId}`
    : DEFAULT_IMAGE;

  // JSON-LD: schema.org/Person
  const jsonLd: object = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": authorName,
    "url": url,
    "mainEntityOfPage": url,
  };

  return { title, description, url, image, jsonLd };
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Returns an Express middleware that injects dynamic meta tags for
 * /book/:id and /author/:name routes in production (static file serving).
 *
 * In development, Vite handles HTML serving — this middleware is a no-op.
 */
export function createMetaMiddleware(distPath: string) {
  const indexPath = path.join(distPath, "index.html");

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const url = req.path;

    // Only handle SPA routes that need dynamic meta
    const bookMatch = url.match(/^\/book\/(\d+)$/);
    const authorMatch = url.match(/^\/author\/(.+)$/);

    if (!bookMatch && !authorMatch) {
      next();
      return;
    }

    try {
      let html = fs.readFileSync(indexPath, "utf-8");
      let meta: MetaData | null = null;

      if (bookMatch) {
        const bookId = parseInt(bookMatch[1], 10);
        meta = await buildBookMeta(bookId);
      } else if (authorMatch) {
        const authorName = decodeURIComponent(authorMatch[1]);
        meta = await buildAuthorMeta(authorName);
      }

      if (meta) {
        html = injectMeta(html, meta);
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300"); // 5 min cache for meta pages
      res.send(html);
    } catch (err) {
      console.error("[meta] Error injecting meta tags:", err);
      next(); // fall through to static file serving on error
    }
  };
}
