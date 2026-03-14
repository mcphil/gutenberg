/**
 * render-covers.ts
 *
 * Generates generative WebP covers for ALL books in the catalog.
 * Gutenberg JPEGs are ignored — every book gets its own generative cover.
 * Run this script whenever new books are added:
 *
 *   npx tsx server/scripts/render-covers.ts
 *
 * Covers are saved to data/gen-covers/{gutenbergId}.webp
 * The script is idempotent: already-rendered covers are skipped.
 */

import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import sharp from "sharp";
import { generateGenerativeCoverSvg } from "../generativeCoverSvg";

const GEN_COVERS_DIR = path.resolve(process.cwd(), "data", "gen-covers");

if (!fs.existsSync(GEN_COVERS_DIR)) {
  fs.mkdirSync(GEN_COVERS_DIR, { recursive: true });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const conn = await mysql.createConnection(url);

  // Get ALL books with their summaries for keyword generation
  const [rows] = await conn.execute(`
    SELECT b.gutenbergId, b.title, b.authors, bs.shortSummary, b.subjects
    FROM books b
    LEFT JOIN book_summaries bs ON b.gutenbergId = bs.gutenbergId
    WHERE b.type = 'Text'
    ORDER BY b.gutenbergId
  `) as any;

  await conn.end();

  const books = rows as Array<{
    gutenbergId: number;
    title: string;
    authors: string;
    shortSummary: string | null;
    subjects: string | null;
  }>;

  console.log(`Rendering generative WebP covers for ${books.length} books...`);
  console.log(`Output directory: ${GEN_COVERS_DIR}\n`);

  let rendered = 0;
  let skipped = 0;
  let failed = 0;

  for (const book of books) {
    const webpPath = path.join(GEN_COVERS_DIR, `${book.gutenbergId}.webp`);

    // Skip if already rendered (idempotent)
    if (fs.existsSync(webpPath)) {
      skipped++;
      continue;
    }

    try {
      const previewText = book.shortSummary ?? book.subjects ?? "";
      const svg = generateGenerativeCoverSvg(book.title, book.authors ?? "", previewText);
      const webpBuffer = await sharp(Buffer.from(svg))
        .webp({ quality: 85 })
        .toBuffer();

      fs.writeFileSync(webpPath, webpBuffer);
      rendered++;

      if (rendered % 50 === 0) {
        process.stdout.write(`  ${rendered + skipped}/${books.length} (${rendered} rendered, ${skipped} skipped)...\r`);
      }
    } catch (err) {
      console.error(`\n  ERROR: ${book.gutenbergId} "${(book.title ?? "").substring(0, 40)}": ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n\nDone!`);
  console.log(`  Rendered: ${rendered}`);
  console.log(`  Skipped (already existed): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${books.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
