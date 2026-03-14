/**
 * Generative Cover Cache
 *
 * Renders book covers as WebP files on first request and caches them to disk.
 * The cache directory lives alongside the JPEG covers in data/gen-covers/.
 *
 * Strategy:
 *   1. Check if data/gen-covers/{id}.webp already exists → serve immediately.
 *   2. Otherwise: fetch book data from DB, generate SVG, rasterize to WebP via sharp, save.
 *   3. Return the file path (or null on failure).
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getBookById, getBookSummary } from "./db";
import { generateGenerativeCoverSvg } from "./generativeCoverSvg";

const GEN_COVERS_DIR = path.resolve(process.cwd(), "data", "gen-covers");

// Ensure the directory exists at startup
if (!fs.existsSync(GEN_COVERS_DIR)) {
  fs.mkdirSync(GEN_COVERS_DIR, { recursive: true });
}

function genCoverFilePath(gutenbergId: number): string {
  return path.join(GEN_COVERS_DIR, `${gutenbergId}.webp`);
}

function genCoverExists(gutenbergId: number): boolean {
  return fs.existsSync(genCoverFilePath(gutenbergId));
}

/**
 * Get the path to the pre-rendered WebP cover for a book.
 * Renders and caches it on first call.
 * Returns null if the book is not found in the DB.
 */
export async function getGenCoverPath(gutenbergId: number): Promise<string | null> {
  // Fast path: already cached
  if (genCoverExists(gutenbergId)) {
    return genCoverFilePath(gutenbergId);
  }

  // Fetch book data
  const book = await getBookById(gutenbergId);
  if (!book) return null;

  const summary = await getBookSummary(gutenbergId);
  const previewText = summary?.shortSummary ?? book.subjects ?? "";

  // Generate SVG and rasterize
  try {
    const svg = generateGenerativeCoverSvg(
      book.title ?? `Buch ${gutenbergId}`,
      book.authors ?? "",
      previewText
    );
    const webpBuffer = await sharp(Buffer.from(svg))
      .webp({ quality: 85 })
      .toBuffer();

    const filePath = genCoverFilePath(gutenbergId);
    fs.writeFileSync(filePath, webpBuffer);
    return filePath;
  } catch (err) {
    console.error(`[gen-covers] Failed to render cover for ${gutenbergId}:`, err);
    return null;
  }
}

export { GEN_COVERS_DIR, genCoverExists };
