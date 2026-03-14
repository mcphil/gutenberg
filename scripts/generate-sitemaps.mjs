/**
 * generate-sitemaps.mjs
 *
 * Build-time script: queries the database and writes static sitemap XML files
 * directly into client/public/ so they are served as static assets (bypassing
 * the infrastructure-managed /sitemap.xml).
 *
 * Output files:
 *   client/public/sitemap-index.xml   ← sitemap index (submit THIS to Google Search Console)
 *   client/public/sitemap-books.xml   ← all /book/:id pages
 *   client/public/sitemap-authors.xml ← all /author/:name pages
 *   client/public/sitemap-static.xml  ← static routes
 *
 * Usage: node scripts/generate-sitemaps.mjs
 */

import { createConnection } from "mysql2/promise";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "../client/public");
const DOMAIN = "https://gutenberg-navigator.de";

function today() {
  return new Date().toISOString().split("T")[0];
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc, priority, changefreq, lastmod) {
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmodTag}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
}

function xmlHeader() {
  return '<?xml version="1.0" encoding="UTF-8"?>\n';
}

async function main() {
  const db = await createConnection(process.env.DATABASE_URL);
  const t = today();

  console.log("📚 Generating sitemaps...");

  // ── Static sitemap ──────────────────────────────────────────────────────────
  const staticRoutes = [
    { path: "/",            priority: "1.0", changefreq: "daily"   },
    { path: "/browse",      priority: "0.8", changefreq: "weekly"  },
    { path: "/impressum",   priority: "0.3", changefreq: "monthly" },
    { path: "/datenschutz", priority: "0.3", changefreq: "monthly" },
  ];
  const staticXml = [
    xmlHeader(),
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n',
    ...staticRoutes.map(r => urlEntry(`${DOMAIN}${r.path}`, r.priority, r.changefreq, t)),
    "</urlset>",
  ].join("");
  writeFileSync(join(PUBLIC_DIR, "sitemap-static.xml"), staticXml, "utf-8");
  console.log(`  ✓ sitemap-static.xml (${staticRoutes.length} URLs)`);

  // ── Books sitemap ───────────────────────────────────────────────────────────
  const [bookRows] = await db.execute(
    "SELECT gutenbergId, importedAt FROM books WHERE type = 'Text' ORDER BY gutenbergId ASC"
  );
  const bookEntries = bookRows.map(b => {
    const lastmod = b.importedAt
      ? new Date(b.importedAt).toISOString().split("T")[0]
      : t;
    return urlEntry(`${DOMAIN}/book/${b.gutenbergId}`, "0.7", "monthly", lastmod);
  });
  const booksXml = [
    xmlHeader(),
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n',
    ...bookEntries,
    "</urlset>",
  ].join("");
  writeFileSync(join(PUBLIC_DIR, "sitemap-books.xml"), booksXml, "utf-8");
  console.log(`  ✓ sitemap-books.xml (${bookRows.length} URLs)`);

  // ── Authors sitemap ─────────────────────────────────────────────────────────
  const [authorRows] = await db.execute(
    "SELECT DISTINCT authors FROM books WHERE type = 'Text' AND authors IS NOT NULL ORDER BY authors ASC"
  );
  const authorSet = new Set();
  for (const row of authorRows) {
    const entries = row.authors.split(";").map(s => s.trim());
    for (const entry of entries) {
      if (/\[(Translator|Editor|Contributor|Illustrator|Compiler|Annotator|Commentator|Adapter|Arranger|Foreword|Introduction|Preface)\]/i.test(entry)) {
        continue;
      }
      const name = entry
        .replace(/,\s*\d{3,4}.*$/, "")
        .replace(/\[.*?\]/g, "")
        .trim();
      if (name.length > 2) authorSet.add(name);
    }
  }
  const authorEntries = Array.from(authorSet).map(name =>
    urlEntry(`${DOMAIN}/author/${encodeURIComponent(name)}`, "0.6", "monthly", t)
  );
  const authorsXml = [
    xmlHeader(),
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n',
    ...authorEntries,
    "</urlset>",
  ].join("");
  writeFileSync(join(PUBLIC_DIR, "sitemap-authors.xml"), authorsXml, "utf-8");
  console.log(`  ✓ sitemap-authors.xml (${authorSet.size} URLs)`);

  // ── Sitemap index ───────────────────────────────────────────────────────────
  const indexXml = [
    xmlHeader(),
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n',
    `  <sitemap>\n    <loc>${DOMAIN}/sitemap-static.xml</loc>\n    <lastmod>${t}</lastmod>\n  </sitemap>\n`,
    `  <sitemap>\n    <loc>${DOMAIN}/sitemap-books.xml</loc>\n    <lastmod>${t}</lastmod>\n  </sitemap>\n`,
    `  <sitemap>\n    <loc>${DOMAIN}/sitemap-authors.xml</loc>\n    <lastmod>${t}</lastmod>\n  </sitemap>\n`,
    "</sitemapindex>",
  ].join("");
  writeFileSync(join(PUBLIC_DIR, "sitemap-index.xml"), indexXml, "utf-8");
  console.log(`  ✓ sitemap-index.xml (index of 3 sub-sitemaps)`);

  await db.end();
  console.log("✅ All sitemaps generated successfully.");
}

main().catch(err => {
  console.error("❌ Sitemap generation failed:", err);
  process.exit(1);
});
