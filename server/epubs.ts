/**
 * EPUB Cache Service
 *
 * Downloads EPUB files on-demand from Project Gutenberg, stores them on the
 * local filesystem, and serves them from our own server.
 *
 * Design mirrors the cover cache service (server/covers.ts):
 * - Never hotlink EPUB files from gutenberg.org in the frontend.
 * - Each EPUB is downloaded exactly once, then served locally forever.
 * - Bulk / background downloads use a polite delay between requests.
 */

import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { bookSummaries } from "../drizzle/schema";

// ─── Storage directory ────────────────────────────────────────
const EPUBS_DIR = path.resolve(process.cwd(), "data", "epubs");

if (!fs.existsSync(EPUBS_DIR)) {
  fs.mkdirSync(EPUBS_DIR, { recursive: true });
}

// ─── Helpers ─────────────────────────────────────────────────

function epubFilePath(gutenbergId: number): string {
  return path.join(EPUBS_DIR, `${gutenbergId}.epub`);
}

export function epubExists(gutenbergId: number): boolean {
  return fs.existsSync(epubFilePath(gutenbergId));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Candidate EPUB URLs for a given Gutenberg book ID, in order of preference.
 * The standard cache path is the most reliable; the direct path is a fallback.
 */
export function candidateEpubUrls(gutenbergId: number): string[] {
  return [
    // Standard EPUB3 (preferred — better formatting)
    `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.epub`,
    // EPUB3 with images variant
    `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}-images.epub`,
    // Direct ebooks path fallback
    `https://www.gutenberg.org/ebooks/${gutenbergId}.epub.noimages`,
  ];
}

const USER_AGENT =
  "GutenbergLeser/1.0 (personal reading app; https://github.com/mcphil/gutenberg)";

/**
 * Download a single EPUB and save it to disk.
 *
 * @param gutenbergId   The Project Gutenberg book ID
 * @param epubUrl       The known EPUB URL from Gutendex metadata (tried first)
 * @param politeDelay   Optional ms to sleep BEFORE the download (for bulk use)
 * @returns             true if the EPUB was saved, false if all URLs failed
 */
export async function downloadEpub(
  gutenbergId: number,
  epubUrl?: string,
  politeDelay = 0
): Promise<boolean> {
  if (epubExists(gutenbergId)) return true;

  if (politeDelay > 0) {
    await sleep(politeDelay);
  }

  // Build the list of URLs to try: known URL from Gutendex first, then fallbacks
  const urls = epubUrl
    ? [epubUrl, ...candidateEpubUrls(gutenbergId).filter((u) => u !== epubUrl)]
    : candidateEpubUrls(gutenbergId);

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(60_000), // EPUBs can be large — allow 60s
      });

      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") ?? "";
      // Reject HTML error pages
      if (contentType.startsWith("text/html")) continue;

      const buffer = Buffer.from(await res.arrayBuffer());

      // Minimum sanity check: a valid EPUB is at least a few KB
      if (buffer.length < 2000) continue;

      // EPUBs are ZIP files — check the magic bytes (PK\x03\x04)
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) continue;

      fs.writeFileSync(epubFilePath(gutenbergId), buffer);

      // Mark as cached in DB (best-effort)
      try {
        const db = await getDb();
        if (db) {
          await db
            .insert(bookSummaries)
            .values({ gutenbergId, epubCached: true })
            .onDuplicateKeyUpdate({ set: { epubCached: true } });
        }
      } catch {
        // Non-fatal — the file is on disk regardless
      }

      return true;
    } catch {
      continue;
    }
  }

  return false;
}

/**
 * Get the local file path for an EPUB, downloading it first if needed.
 * Returns null if no EPUB could be obtained.
 *
 * @param gutenbergId  The Project Gutenberg book ID
 * @param epubUrl      Known EPUB URL from Gutendex metadata (optional but preferred)
 */
export async function getEpubPath(
  gutenbergId: number,
  epubUrl?: string
): Promise<string | null> {
  if (epubExists(gutenbergId)) return epubFilePath(gutenbergId);
  const ok = await downloadEpub(gutenbergId, epubUrl);
  return ok ? epubFilePath(gutenbergId) : null;
}

/**
 * Prefetch EPUBs for a list of books in the background.
 * Uses a polite delay between each download.
 *
 * @param books       Array of { id, epubUrl } objects
 * @param delayMs     Milliseconds to sleep between downloads (default 2000ms —
 *                    EPUBs are larger than covers, so we're even more polite)
 */
export async function prefetchEpubs(
  books: Array<{ id: number; epubUrl?: string }>,
  delayMs = 2000
): Promise<void> {
  for (const book of books) {
    if (epubExists(book.id)) continue;
    await downloadEpub(book.id, book.epubUrl, delayMs);
  }
}

export { EPUBS_DIR };
