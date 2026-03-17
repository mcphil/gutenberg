#!/usr/bin/env node
/**
 * precache-epubs.mjs
 *
 * Pre-caches EPUBs for all German books in the database using rsync from
 * Project Gutenberg's official rsync server (aleph.gutenberg.org::gutenberg-epub).
 *
 * Project Gutenberg explicitly welcomes and recommends rsync for bulk access:
 * https://www.gutenberg.org/help/mirroring.html
 *
 * Strategy:
 * - Reads all gutenbergId values from the database
 * - Builds an rsync --include filter list for only those IDs
 * - Runs rsync in batches of 200 books to keep the filter list manageable
 * - Skips books that are already cached locally
 * - Adds a short pause between batches to be friendly to the server
 *
 * Usage:
 *   node scripts/precache-epubs.mjs [--dry-run] [--batch-size=200] [--pause=5]
 *
 * Options:
 *   --dry-run        Show what would be downloaded without actually downloading
 *   --batch-size=N   Number of books per rsync batch (default: 200)
 *   --pause=N        Seconds to pause between batches (default: 5)
 *   --limit=N        Only process the first N books (for testing)
 */

import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const EPUBS_DIR = join(PROJECT_ROOT, "data", "epubs");

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const BATCH_SIZE = parseInt(args.find(a => a.startsWith("--batch-size="))?.split("=")[1] ?? "200");
const PAUSE_SEC = parseInt(args.find(a => a.startsWith("--pause="))?.split("=")[1] ?? "5");
const LIMIT = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0");

const RSYNC_SERVER = "aleph.gutenberg.org::gutenberg-epub";

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

/** Get all gutenbergIds from the database */
async function getAllBookIds() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.execute("SELECT gutenbergId FROM books ORDER BY gutenbergId");
  await conn.end();
  return rows.map(r => r.gutenbergId);
}

/** Get set of already-cached IDs */
function getCachedIds() {
  if (!existsSync(EPUBS_DIR)) return new Set();
  return new Set(
    readdirSync(EPUBS_DIR)
      .filter(f => f.endsWith(".epub"))
      .map(f => parseInt(f.replace(".epub", ""), 10))
      .filter(n => !isNaN(n))
  );
}

/**
 * Run rsync for a batch of book IDs.
 * rsync filter: include only epub/{id}/{id}.epub for each ID in the batch.
 * Everything else is excluded.
 */
function rsyncBatch(ids, batchNum, totalBatches) {
  return new Promise((resolve, reject) => {
    // Build filter args: include the directory and the specific .epub file for each ID
    const filterArgs = [];
    for (const id of ids) {
      filterArgs.push(`--include=/${id}/`);
      filterArgs.push(`--include=/${id}/${id}.epub`);
    }
    // Exclude everything else
    filterArgs.push("--exclude=*");

    const rsyncArgs = [
      "-av",
      "--no-relative",
      "--no-implied-dirs",
      "--timeout=60",
      "--contimeout=30",
      "--bwlimit=2000",   // 2 MB/s max — friendly to the server
      "--ignore-existing", // skip already-cached files
      ...filterArgs,
      RSYNC_SERVER,
      EPUBS_DIR + "/",
    ];

    if (DRY_RUN) {
      rsyncArgs.unshift("--dry-run");
    }

    log(`Batch ${batchNum}/${totalBatches}: syncing ${ids.length} books (IDs ${ids[0]}–${ids[ids.length - 1]})`);

    if (DRY_RUN) {
      log(`[DRY RUN] rsync ${rsyncArgs.join(" ")}`);
      resolve({ downloaded: 0, skipped: ids.length });
      return;
    }

    const proc = spawn("rsync", rsyncArgs, { stdio: ["ignore", "pipe", "pipe"] });

    let downloaded = 0;
    let stdout = "";

    proc.stdout.on("data", data => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.trim().endsWith(".epub")) {
          downloaded++;
          log(`  ✓ ${line.trim()}`);
        }
        stdout += line + "\n";
      }
    });

    proc.stderr.on("data", data => {
      const msg = data.toString().trim();
      if (msg) log(`  [rsync stderr] ${msg}`);
    });

    proc.on("close", code => {
      if (code === 0 || code === 24) {
        // code 24 = some files vanished during transfer (harmless)
        resolve({ downloaded, skipped: ids.length - downloaded });
      } else {
        log(`  [rsync] exited with code ${code}`);
        // Don't reject — continue with next batch
        resolve({ downloaded, skipped: ids.length - downloaded, error: code });
      }
    });

    proc.on("error", err => {
      log(`  [rsync] spawn error: ${err.message}`);
      resolve({ downloaded: 0, skipped: ids.length, error: err.message });
    });
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log("=== Gutenberg EPUB Pre-Cache Script ===");
  log(`rsync server: ${RSYNC_SERVER}`);
  log(`EPUB dir:     ${EPUBS_DIR}`);
  log(`Batch size:   ${BATCH_SIZE}`);
  log(`Pause:        ${PAUSE_SEC}s between batches`);
  if (DRY_RUN) log("MODE: DRY RUN (no files will be downloaded)");
  log("");

  // Ensure EPUB directory exists
  if (!existsSync(EPUBS_DIR)) {
    mkdirSync(EPUBS_DIR, { recursive: true });
    log(`Created ${EPUBS_DIR}`);
  }

  // Check rsync is available
  try {
    execSync("which rsync", { stdio: "ignore" });
  } catch {
    log("ERROR: rsync is not installed. Install it with: sudo apt-get install rsync");
    process.exit(1);
  }

  // Load book IDs from DB
  log("Loading book IDs from database...");
  let allIds;
  try {
    allIds = await getAllBookIds();
  } catch (err) {
    log(`ERROR: Could not connect to database: ${err.message}`);
    log("Make sure DATABASE_URL is set in your environment.");
    process.exit(1);
  }
  log(`Found ${allIds.length} books in database.`);

  // Apply limit for testing
  if (LIMIT > 0) {
    allIds = allIds.slice(0, LIMIT);
    log(`Limiting to first ${LIMIT} books (--limit flag).`);
  }

  // Filter out already-cached books
  const cachedIds = getCachedIds();
  log(`Already cached: ${cachedIds.size} EPUBs`);

  const missingIds = allIds.filter(id => !cachedIds.has(id));
  log(`To download:    ${missingIds.length} EPUBs`);
  log("");

  if (missingIds.length === 0) {
    log("All EPUBs are already cached. Nothing to do.");
    process.exit(0);
  }

  // Split into batches
  const batches = [];
  for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
    batches.push(missingIds.slice(i, i + BATCH_SIZE));
  }
  log(`Processing ${batches.length} batch(es) of up to ${BATCH_SIZE} books each.`);
  log("");

  let totalDownloaded = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const result = await rsyncBatch(batch, i + 1, batches.length);
    totalDownloaded += result.downloaded;
    if (result.error) totalErrors++;

    // Progress report
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const cachedNow = getCachedIds().size;
    log(`  → Downloaded: ${result.downloaded} | Total cached: ${cachedNow} | Elapsed: ${elapsed}s`);

    // Pause between batches (except after the last one)
    if (i < batches.length - 1 && !DRY_RUN) {
      log(`  Pausing ${PAUSE_SEC}s before next batch...`);
      await sleep(PAUSE_SEC * 1000);
    }
  }

  log("");
  log("=== Summary ===");
  log(`Total downloaded: ${totalDownloaded}`);
  log(`Total cached now: ${getCachedIds().size} / ${allIds.length}`);
  log(`Errors:           ${totalErrors} batch(es) with errors`);
  log(`Time:             ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  if (!DRY_RUN && totalDownloaded === 0 && missingIds.length > 0) {
    log("");
    log("WARNING: No files were downloaded. This could mean:");
    log("  - The rsync server is temporarily unavailable");
    log("  - The book IDs don't have EPUBs on Gutenberg (some books are text-only)");
    log("  - Network connectivity issues");
    log("Try running with --dry-run first to verify the rsync connection.");
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
