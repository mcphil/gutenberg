/**
 * import-catalog.mjs
 *
 * Downloads Project Gutenberg's official pg_catalog.csv, filters German-language
 * books, and bulk-upserts them into the local `books` table.
 *
 * Usage:
 *   node scripts/import-catalog.mjs
 *
 * Source: https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv
 * Updated weekly by Project Gutenberg. Run this script weekly (e.g. via cron).
 *
 * We respect all Project Gutenberg terms of use:
 *   - We download the catalog file once (not crawl individual pages)
 *   - We do not hotlink or deep-link to Gutenberg servers for serving content
 *   - We use the approved machine-readable catalog format
 */

import { createReadStream, mkdirSync, existsSync, createWriteStream } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { get as httpsGet } from "https";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const CATALOG_PATH = join(DATA_DIR, "pg_catalog.csv");
const CATALOG_URL = "https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv";

dotenv.config({ path: join(ROOT, ".env") });

// ─── Download ────────────────────────────────────────────────────────────────

async function downloadCatalog() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  console.log("Downloading pg_catalog.csv from Project Gutenberg...");
  await new Promise((resolve, reject) => {
    const file = createWriteStream(CATALOG_PATH);
    httpsGet(CATALOG_URL, {
      headers: {
        "User-Agent": "GutenbergLeser/1.0 (personal reading app; not for commercial use)",
      },
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} from Gutenberg catalog`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", reject);
  });
  console.log("Download complete.");
}

// ─── Parse CSV ───────────────────────────────────────────────────────────────

/**
 * Reads the CSV line by line, handling quoted fields with embedded newlines.
 * Returns an array of row objects keyed by the header row.
 */
async function parseGermanBooks() {
  const books = [];
  let headers = null;
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  const { createInterface } = await import("readline");
  const rl = createInterface({
    input: createReadStream(CATALOG_PATH, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    // Append newline back (stripped by readline) so embedded newlines in quoted
    // fields are preserved across iterations.
    const chars = line + "\n";
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (inQuotes) {
        if (ch === '"') {
          if (chars[i + 1] === '"') { currentField += '"'; i++; }
          else inQuotes = false;
        } else {
          currentField += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          currentRow.push(currentField.trim());
          currentField = "";
        } else if (ch === '\n') {
          currentRow.push(currentField.trim());
          currentField = "";

          if (!headers) {
            headers = currentRow;
          } else if (currentRow.length >= headers.length) {
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = currentRow[idx] ?? ""; });
            const langs = (obj["Language"] || "").split(";").map(l => l.trim());
            if (langs.includes("de")) {
              books.push(obj);
            }
          }
          currentRow = [];
        } else {
          currentField += ch;
        }
      }
    }
  }

  return books;
}

// ─── DB Import (batch UPSERT) ─────────────────────────────────────────────────

async function importToDb(books) {
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  console.log(`Importing ${books.length} German books into database...`);

  const BATCH = 500;
  let total = 0;

  for (let i = 0; i < books.length; i += BATCH) {
    const batch = books.slice(i, i + BATCH);
    const rows = [];

    for (const book of batch) {
      const gutenbergId = parseInt(book["Text#"], 10);
      if (isNaN(gutenbergId)) continue;

      rows.push([
        gutenbergId,
        (book["Type"] || "Text").trim().substring(0, 32),
        (book["Issued"] || "").trim().substring(0, 16),
        (book["Title"] || "").replace(/\n/g, " ").trim(),
        (book["Language"] || "").trim().substring(0, 64),
        (book["Authors"] || "").trim(),
        (book["Subjects"] || "").trim(),
        (book["LoCC"] || "").trim().substring(0, 64),
        (book["Bookshelves"] || "").trim(),
      ]);
    }

    if (rows.length === 0) continue;

    // Build a single multi-row UPSERT
    const placeholders = rows.map(() => "(?,?,?,?,?,?,?,?,?,NOW())").join(",");
    const values = rows.flat();

    await db.execute(
      `INSERT INTO books (gutenbergId, type, issued, title, language, authors, subjects, locc, bookshelves, importedAt)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         type=VALUES(type), issued=VALUES(issued), title=VALUES(title),
         language=VALUES(language), authors=VALUES(authors), subjects=VALUES(subjects),
         locc=VALUES(locc), bookshelves=VALUES(bookshelves), importedAt=NOW()`,
      values
    );

    total += rows.length;
    process.stdout.write(`\r  Progress: ${total}/${books.length}`);
  }

  await db.end();
  console.log(`\nDone. ${total} rows upserted.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    await downloadCatalog();
    const books = await parseGermanBooks();
    console.log(`Found ${books.length} German-language books in catalog.`);
    await importToDb(books);
    console.log("Catalog import complete.");
  } catch (err) {
    console.error("Import failed:", err);
    process.exit(1);
  }
}

main();
