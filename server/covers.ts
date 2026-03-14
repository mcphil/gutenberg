/**
 * Cover Cache Service
 *
 * Downloads book cover images on-demand from Project Gutenberg / Open Library,
 * stores them on the local filesystem, and serves them from our own server.
 *
 * Rules:
 * - Never hotlink images from gutenberg.org or openlibrary.org in the frontend.
 * - Each cover is downloaded exactly once, then served locally forever.
 * - When downloading in bulk (e.g. background prefetch), we sleep between requests
 *   to be a polite citizen and not hammer Gutenberg's servers.
 */

import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { bookSummaries } from "../drizzle/schema";

// ─── Storage directory ────────────────────────────────────────
// Stored outside the Vite build tree so files survive restarts.
// In production this path persists on the server's filesystem.
const COVERS_DIR = path.resolve(process.cwd(), "data", "covers");

/** In-memory set of IDs known to have no cover (avoids repeated DB lookups and timeouts) */
const knownNoCover = new Set<number>();

// Ensure the directory exists at startup
if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

// ─── Helpers ─────────────────────────────────────────────────

function coverFilePath(gutenbergId: number): string {
  return path.join(COVERS_DIR, `${gutenbergId}.jpg`);
}

function coverExists(gutenbergId: number): boolean {
  return fs.existsSync(coverFilePath(gutenbergId));
}

/** Polite sleep — used between bulk downloads */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Candidate URLs to try for a given Gutenberg book ID, in order of preference.
 * We try Gutenberg's own cache first (it's the most reliable for their books),
 * then fall back to Open Library by Gutenberg ID as LCCN approximation.
 */
function candidateUrls(gutenbergId: number): string[] {
  return [
    // Gutenberg medium cover (most reliable, same server we're already using for EPUBs)
    `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.cover.medium.jpg`,
    // Gutenberg small cover fallback
    `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.cover.small.jpg`,
    // Open Library by Gutenberg ID used as their internal ID (sometimes works)
    `https://covers.openlibrary.org/b/id/${gutenbergId}-M.jpg?default=false`,
  ];
}

/**
 * Download a single cover image and save it to disk.
 * Returns true if a cover was successfully saved, false if none of the
 * candidate URLs returned a valid image.
 *
 * @param gutenbergId  The Project Gutenberg book ID
 * @param politeDelay  Optional ms to sleep BEFORE the download (for bulk use)
 */
export async function downloadCover(
  gutenbergId: number,
  politeDelay = 0
): Promise<boolean> {
  // Already cached — nothing to do
  if (coverExists(gutenbergId)) return true;

  if (politeDelay > 0) {
    await sleep(politeDelay);
  }

  for (const url of candidateUrls(gutenbergId)) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "GutenbergLeser/1.0 (personal reading app; https://github.com/mcphil/gutenberg)",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") ?? "";
      // Reject HTML error pages masquerading as images
      if (!contentType.startsWith("image/")) continue;

      const buffer = Buffer.from(await res.arrayBuffer());
      // Reject suspiciously small files (blank placeholder images are ~807 bytes)
      if (buffer.length < 1500) continue;

      fs.writeFileSync(coverFilePath(gutenbergId), buffer);

      // Mark as cached in DB (best-effort, don't throw if DB is unavailable)
      try {
        const db = await getDb();
        if (db) {
          await db
            .insert(bookSummaries)
            .values({ gutenbergId, coverCached: true })
            .onDuplicateKeyUpdate({ set: { coverCached: true } });
        }
      } catch {
        // Non-fatal — the file is on disk regardless
      }

      return true;
    } catch {
      // Try next candidate URL
      continue;
    }
  }

  return false;
}

/**
 * Get the local file path for a cover, downloading it first if needed.
 * Returns null if no cover could be obtained.
 *
 * Skips the download attempt if the DB already records coverCached=false
 * (meaning we already tried and failed), to avoid repeated 10-second timeouts.
 */
export async function getCoverPath(gutenbergId: number): Promise<string | null> {
  // Fast path: file already on disk
  if (coverExists(gutenbergId)) return coverFilePath(gutenbergId);

  // Skip if we already know there's no cover (in-memory cache)
  if (knownNoCover.has(gutenbergId)) return null;

  // Skip if DB says coverCached=false (we already tried and failed)
  try {
    const db = await getDb();
    if (db) {
      const [row] = await db
        .select({ coverCached: bookSummaries.coverCached })
        .from(bookSummaries)
        .where(eq(bookSummaries.gutenbergId, gutenbergId))
        .limit(1);
      if (row && row.coverCached === false) {
        knownNoCover.add(gutenbergId);
        return null;
      }
    }
  } catch {
    // Non-fatal — fall through to attempt download
  }

  const ok = await downloadCover(gutenbergId);
  if (!ok) knownNoCover.add(gutenbergId);
  return ok ? coverFilePath(gutenbergId) : null;
}

/**
 * Prefetch covers for a list of book IDs in the background.
 * Uses a polite delay between each download to avoid hammering Gutenberg.
 *
 * @param ids           List of Gutenberg book IDs
 * @param delayMs       Milliseconds to sleep between each download (default 1500ms)
 */
export async function prefetchCovers(
  ids: number[],
  delayMs = 1500
): Promise<void> {
  for (const id of ids) {
    if (coverExists(id)) continue; // already have it, no delay needed
    await downloadCover(id, delayMs);
  }
}

export { COVERS_DIR, coverExists };
