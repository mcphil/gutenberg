/**
 * Batch Summary Generation Script
 * ================================
 * Generates AI summaries (short ~30 words, long ~120 words) for all German books
 * in the database that do not yet have a summary cached.
 *
 * Usage:
 *   npx tsx server/scripts/generate-summaries.ts [options]
 *
 * Options:
 *   --limit <n>      Only process the first N books (default: all)
 *   --delay <ms>     Polite delay between API calls in ms (default: 1500)
 *   --dry-run        Parse and log books without calling the LLM
 *   --start-id <n>   Start from gutenbergId >= n (resume interrupted run)
 *
 * The script is idempotent: books that already have both summaries are skipped.
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { eq, isNull, or, gte } from "drizzle-orm";
import { books, bookSummaries } from "../../drizzle/schema";
import { sql as drizzleSql } from "drizzle-orm";

// ─── Config ──────────────────────────────────────────────────────────────────

const DELAY_MS = parseInt(process.env.SUMMARY_DELAY ?? "1500", 10);
const LIMIT = process.env.SUMMARY_LIMIT ? parseInt(process.env.SUMMARY_LIMIT, 10) : undefined;
const DRY_RUN = process.argv.includes("--dry-run");
const START_ID = (() => {
  const idx = process.argv.indexOf("--start-id");
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : undefined;
})();
const LIMIT_ARG = (() => {
  const idx = process.argv.indexOf("--limit");
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : undefined;
})();
const DELAY_ARG = (() => {
  const idx = process.argv.indexOf("--delay");
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : undefined;
})();

const effectiveDelay = DELAY_ARG ?? DELAY_MS;
const effectiveLimit = LIMIT_ARG ?? LIMIT;

// ─── Database ────────────────────────────────────────────────────────────────

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(url);
}

// ─── LLM ─────────────────────────────────────────────────────────────────────

interface SummaryResult {
  short: string;
  long: string;
}

async function generateSummaryViaLLM(
  title: string,
  authorsRaw: string,
  subjectsRaw: string
): Promise<SummaryResult> {
  const apiUrl = process.env.BUILT_IN_FORGE_API_URL ?? "https://forge.manus.im";
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  if (!apiKey) throw new Error("BUILT_IN_FORGE_API_KEY is not set");

  // Parse authors from CSV format "Lastname, Firstname, YYYY-YYYY"
  const authorParts = authorsRaw.split(";").map((a) => a.trim()).filter(Boolean);
  const authorDisplay = authorParts.map((raw) => {
    const yearMatch = raw.match(/,\s*(\d{4})?-(\d{4})?$/);
    const name = yearMatch ? raw.slice(0, raw.lastIndexOf(",")).trim() : raw;
    const parts = name.split(", ");
    return parts.length === 2 ? `${parts[1]} ${parts[0]}` : name;
  }).join(", ");

  // Parse subjects
  const subjects = subjectsRaw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");

  const systemPrompt = `Du bist ein sachlicher Literaturkritiker. Deine Aufgabe ist es, neutrale, informative Zusammenfassungen von Büchern zu schreiben, die Lesern helfen zu entscheiden, ob sie ihre Lesezeit in ein Buch investieren möchten.

Wichtige Regeln:
- Bleibe streng neutral und sachlich — keine Wertungen wie "fesselnd", "brillant", "meisterhaft"
- Beschreibe WAS das Buch ist, nicht ob es gut ist
- Nenne Epoche, Gattung, Hauptthemen und Handlungsrahmen
- Vermeide Spoiler für Wendepunkte oder das Ende
- Schreibe auf Deutsch`;

  const userPrompt = `Schreibe zwei Zusammenfassungen für folgendes Buch:

Titel: "${title}"
Autor: ${authorDisplay || "Unbekannt"}
Themen/Kategorien: ${subjects || "nicht angegeben"}

Erstelle:
1. KURZZUSAMMENFASSUNG (max. 2 Sätze, ~30 Wörter): Gattung, Epoche und zentrales Thema
2. DETAILZUSAMMENFASSUNG (4-6 Sätze, ~120 Wörter): Handlungsrahmen, Hauptfiguren, zentrale Konflikte, literarischer Kontext — alles was hilft zu entscheiden ob man das Buch lesen möchte

Antworte im JSON-Format:
{
  "short": "...",
  "long": "..."
}`;

  const payload = {
    model: "gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 1024,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "book_summary",
        strict: true,
        schema: {
          type: "object",
          properties: {
            short: { type: "string", description: "Short summary, max 2 sentences" },
            long: { type: "string", description: "Detailed summary, 4-6 sentences" },
          },
          required: ["short", "long"],
          additionalProperties: false,
        },
      },
    },
  };

  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} ${response.statusText} – ${errorText}`);
  }

  const result = await response.json() as { choices: Array<{ message: { content: string } }> };
  const rawContent = result.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("Empty LLM response");

  const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent)) as SummaryResult;
  if (!parsed.short || !parsed.long) throw new Error("Invalid LLM response structure");

  return parsed;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("Gutenberg Navigator — Batch Summary Generator");
  console.log("=".repeat(60));
  console.log(`Mode:        ${DRY_RUN ? "DRY RUN (no LLM calls)" : "LIVE"}`);
  console.log(`Delay:       ${effectiveDelay}ms between API calls`);
  if (effectiveLimit) console.log(`Limit:       ${effectiveLimit} books`);
  if (START_ID) console.log(`Start ID:    gutenbergId >= ${START_ID}`);
  console.log("");

  const db = getDb();

  // Query all books that don't have both summaries yet
  // LEFT JOIN book_summaries, filter where shortSummary IS NULL
  const query = db
    .select({
      gutenbergId: books.gutenbergId,
      title: books.title,
      authors: books.authors,
      subjects: books.subjects,
    })
    .from(books)
    .leftJoin(bookSummaries, eq(books.gutenbergId, bookSummaries.gutenbergId))
    .where(
      or(
        isNull(bookSummaries.gutenbergId),
        isNull(bookSummaries.shortSummary)
      )
    )
    .orderBy(books.gutenbergId);

  const allPending = await query;

  // Apply start-id filter
  const filtered = START_ID
    ? allPending.filter((b) => b.gutenbergId >= START_ID)
    : allPending;

  // Apply limit
  const toProcess = effectiveLimit ? filtered.slice(0, effectiveLimit) : filtered;

  console.log(`Books without summaries: ${allPending.length}`);
  console.log(`Books to process now:    ${toProcess.length}`);
  if (toProcess.length === 0) {
    console.log("\nAll books already have summaries. Nothing to do.");
    return;
  }

  const estimatedMinutes = Math.ceil((toProcess.length * effectiveDelay) / 60000);
  console.log(`Estimated time:          ~${estimatedMinutes} minutes`);
  console.log("");

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const startTime = Date.now();
  const errors: Array<{ gutenbergId: number; title: string; error: string }> = [];

  for (let i = 0; i < toProcess.length; i++) {
    const book = toProcess[i];
    const progress = `[${i + 1}/${toProcess.length}]`;
    const elapsed = Date.now() - startTime;
    const rate = i > 0 ? elapsed / i : effectiveDelay;
    const remaining = rate * (toProcess.length - i);

    process.stdout.write(
      `${progress} ID=${book.gutenbergId} "${book.title?.slice(0, 50)}${(book.title?.length ?? 0) > 50 ? "…" : ""}" — `
    );

    if (DRY_RUN) {
      console.log("SKIP (dry-run)");
      skipped++;
      continue;
    }

    try {
      const summary = await generateSummaryViaLLM(
        book.title ?? "",
        book.authors ?? "",
        book.subjects ?? ""
      );

      // Upsert into database
      await db
        .insert(bookSummaries)
        .values({
          gutenbergId: book.gutenbergId,
          shortSummary: summary.short,
          longSummary: summary.long,
        })
        .onDuplicateKeyUpdate({
          set: {
            shortSummary: summary.short,
            longSummary: summary.long,
            generatedAt: new Date(),
          },
        });

      console.log(`OK (${summary.short.length}/${summary.long.length} chars) — ETA: ${formatDuration(remaining)}`);
      succeeded++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED: ${errorMsg}`);
      failed++;
      errors.push({ gutenbergId: book.gutenbergId, title: book.title ?? "", error: errorMsg });
    }

    // Polite delay before next API call (skip after last item)
    if (i < toProcess.length - 1) {
      await sleep(effectiveDelay);
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  const totalTime = Date.now() - startTime;
  console.log("");
  console.log("=".repeat(60));
  console.log("DONE");
  console.log("=".repeat(60));
  console.log(`Succeeded:   ${succeeded}`);
  console.log(`Failed:      ${failed}`);
  console.log(`Skipped:     ${skipped}`);
  console.log(`Total time:  ${formatDuration(totalTime)}`);

  if (errors.length > 0) {
    console.log("");
    console.log("Failed books:");
    for (const e of errors) {
      console.log(`  ID=${e.gutenbergId} "${e.title}": ${e.error}`);
    }
    console.log("");
    console.log(`To retry failed books, run:`);
    console.log(`  npx tsx server/scripts/generate-summaries.ts --start-id ${errors[0].gutenbergId}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
