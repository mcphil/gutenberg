/**
 * epub-search.ts
 *
 * Server-side full-text search over locally cached EPUB files.
 *
 * Strategy:
 * - EPUBs are ZIP archives. We open them with adm-zip, find all HTML/XHTML
 *   spine items, strip tags with cheerio, and search the plain text.
 * - Returns up to MAX_MATCHES_PER_BOOK matches per book, each with a
 *   ~200-character context snippet and the chapter title.
 * - No persistent index: with ~20 cached EPUBs this is fast enough on demand.
 *   The result is cached in memory per (bookId, query) for 10 minutes.
 */

import AdmZip from "adm-zip";
import * as cheerio from "cheerio";
import path from "path";
import { EPUBS_DIR, epubExists } from "./epubs";

const MAX_MATCHES_PER_BOOK = 5;
const SNIPPET_RADIUS = 120; // chars before/after match

// ─── In-memory result cache ───────────────────────────────────
interface CacheEntry {
  results: SearchMatch[];
  expires: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export interface SearchMatch {
  gutenbergId: number;
  title: string;
  authors: string;
  chapter: string;
  snippet: string;       // plain text with match highlighted via **bold**
  matchOffset: number;   // char offset of match start in snippet (for UI)
}

// ─── Parse EPUB spine order from OPF ─────────────────────────
interface SpineItem {
  href: string;       // path relative to OPF dir
  title: string;      // chapter title (from NCX/NAV or filename)
}

function parseSpine(zip: AdmZip): { opfDir: string; items: SpineItem[] } {
  // 1. Find OPF file via META-INF/container.xml
  const containerEntry = zip.getEntry("META-INF/container.xml");
  if (!containerEntry) return { opfDir: "", items: [] };

  const containerXml = containerEntry.getData().toString("utf8");
  const opfMatch = containerXml.match(/full-path="([^"]+\.opf)"/i);
  if (!opfMatch) return { opfDir: "", items: [] };

  const opfPath = opfMatch[1];
  const opfDir = path.dirname(opfPath);

  const opfEntry = zip.getEntry(opfPath);
  if (!opfEntry) return { opfDir, items: [] };

  const opfXml = opfEntry.getData().toString("utf8");
  const $opf = cheerio.load(opfXml, { xmlMode: true });

  // Build id→href manifest map
  const manifest: Record<string, string> = {};
  $opf("manifest item").each((_, el) => {
    const id = $opf(el).attr("id") ?? "";
    const href = $opf(el).attr("href") ?? "";
    const mediaType = $opf(el).attr("media-type") ?? "";
    if (mediaType.includes("html") || mediaType.includes("xhtml")) {
      manifest[id] = href;
    }
  });

  // Build spine order
  const spineIds: string[] = [];
  $opf("spine itemref").each((_, el) => {
    const idref = $opf(el).attr("idref") ?? "";
    if (idref && manifest[idref]) spineIds.push(idref);
  });

  // Try to get chapter titles from NCX or NAV
  const chapterTitles: Record<string, string> = {};

  // Try EPUB3 nav document first
  const navId = $opf("manifest item[properties~='nav']").attr("id");
  const navHref = navId ? manifest[navId] : undefined;
  if (navHref) {
    const navPath = opfDir ? `${opfDir}/${navHref}` : navHref;
    const navEntry = zip.getEntry(navPath) ?? zip.getEntry(navHref);
    if (navEntry) {
      const navHtml = navEntry.getData().toString("utf8");
      const $nav = cheerio.load(navHtml);
      $nav("nav a, nav li a").each((_, el) => {
        const href = $nav(el).attr("href") ?? "";
        const label = $nav(el).text().trim();
        if (href && label) {
          const base = href.split("#")[0];
          chapterTitles[base] = chapterTitles[base] || label;
        }
      });
    }
  }

  // Fall back to NCX — read href directly from OPF (not from HTML-only manifest map)
  const ncxHref = $opf("manifest item[media-type='application/x-dtbncx+xml']").attr("href");
  if (ncxHref && Object.keys(chapterTitles).length === 0) {
    const ncxPath = opfDir ? `${opfDir}/${ncxHref}` : ncxHref;
    const ncxEntry = zip.getEntry(ncxPath) ?? zip.getEntry(ncxHref);
    if (ncxEntry) {
      const ncxXml = ncxEntry.getData().toString("utf8");
      const $ncx = cheerio.load(ncxXml, { xmlMode: true });
      $ncx("navPoint").each((_, el) => {
        const src = $ncx(el).find("content").attr("src") ?? "";
        const label = $ncx(el).find("navLabel text").text().trim();
        if (src && label) {
          const base = src.split("#")[0];
          chapterTitles[base] = chapterTitles[base] || label;
        }
      });
    }
  }

  const items: SpineItem[] = spineIds.map((id) => {
    const href = manifest[id];
    const base = href.split("#")[0];
    // Try full path, then basename only (handles long numeric prefixes in Gutenberg EPUBs)
    const basename = path.basename(base);
    const title =
      chapterTitles[base] ||
      chapterTitles[href] ||
      chapterTitles[basename] ||
      // Find any key whose basename matches
      Object.entries(chapterTitles).find(([k]) => path.basename(k.split("#")[0]) === basename)?.[1] ||
      path.basename(href, path.extname(href));
    return { href, title };
  });

  return { opfDir, items };
}

// ─── Extract plain text from an HTML entry ───────────────────
function extractText(html: string): string {
  const $ = cheerio.load(html);
  // Remove script/style
  $("script, style, head").remove();
  return $.text().replace(/\s+/g, " ").trim();
}

/** Extract chapter title from HTML: <title>, then first h1/h2/h3 */
function extractHtmlTitle(html: string): string | null {
  const $ = cheerio.load(html);
  const titleTag = $("title").text().trim();
  if (titleTag && titleTag.length > 0 && titleTag.length < 120) return titleTag;
  const heading = $("h1, h2, h3").first().text().trim();
  if (heading && heading.length > 0 && heading.length < 120) return heading;
  return null;
}

// ─── Build context snippet around a match ────────────────────
function buildSnippet(text: string, matchStart: number, matchLen: number): string {
  const start = Math.max(0, matchStart - SNIPPET_RADIUS);
  const end = Math.min(text.length, matchStart + matchLen + SNIPPET_RADIUS);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";
  return snippet;
}

// ─── Search a single EPUB ─────────────────────────────────────
export function searchEpub(
  gutenbergId: number,
  bookTitle: string,
  bookAuthors: string,
  query: string
): SearchMatch[] {
  if (!epubExists(gutenbergId)) return [];

  const cacheKey = `${gutenbergId}::${query.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.results;

  const epubPath = path.join(EPUBS_DIR, `${gutenbergId}.epub`);
  let zip: AdmZip;
  try {
    zip = new AdmZip(epubPath);
  } catch {
    return [];
  }

  const { opfDir, items } = parseSpine(zip);
  const lowerQuery = query.toLowerCase();
  const results: SearchMatch[] = [];

  for (const item of items) {
    if (results.length >= MAX_MATCHES_PER_BOOK) break;

    const itemPath = opfDir ? `${opfDir}/${item.href}` : item.href;
    const entry = zip.getEntry(itemPath) ?? zip.getEntry(item.href);
    if (!entry) continue;

    let html: string;
    try {
      html = entry.getData().toString("utf8");
    } catch {
      continue;
    }

    const text = extractText(html);
    const lowerText = text.toLowerCase();

    // Use NCX/NAV title; fall back to HTML <title>/<h1> if we only have a filename
    const isFilename = !item.title || item.title === path.basename(item.href, path.extname(item.href)) || item.title.match(/^[\d_]+/);
    const chapterTitle = isFilename ? (extractHtmlTitle(html) ?? item.title) : item.title;

    let searchFrom = 0;
    while (results.length < MAX_MATCHES_PER_BOOK) {
      const idx = lowerText.indexOf(lowerQuery, searchFrom);
      if (idx === -1) break;

      const snippet = buildSnippet(text, idx, query.length);
      results.push({
        gutenbergId,
        title: bookTitle,
        authors: bookAuthors,
        chapter: chapterTitle,
        snippet,
        matchOffset: Math.min(idx, SNIPPET_RADIUS) + (idx > SNIPPET_RADIUS ? 1 : 0), // approx position in snippet
      });

      // Skip ahead to avoid overlapping matches in same chapter
      searchFrom = idx + query.length + SNIPPET_RADIUS * 2;
    }
  }

  cache.set(cacheKey, { results, expires: Date.now() + CACHE_TTL });
  return results;
}
