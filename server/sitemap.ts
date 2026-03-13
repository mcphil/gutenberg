/**
 * sitemap.ts
 *
 * Generates a dynamic XML sitemap for all book detail pages, author pages,
 * and static routes. Called by the Express server at GET /sitemap.xml.
 *
 * Sitemap index approach:
 *   /sitemap.xml         → sitemap index (lists sub-sitemaps)
 *   /sitemap-static.xml  → static routes (home, browse, impressum, datenschutz)
 *   /sitemap-books.xml   → all /book/:id pages (up to 50,000 per sitemap spec)
 *   /sitemap-authors.xml → all /author/:name pages
 *
 * This keeps each file well under the 50,000 URL / 50 MB limit.
 */

import { Request, Response } from "express";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

const DOMAIN = "https://gutenberg-navigator.de";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function xmlHeader(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n';
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, priority: string, changefreq: string, lastmod?: string): string {
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmodTag}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Sitemap Index ────────────────────────────────────────────────────────────

export async function serveSitemapIndex(_req: Request, res: Response): Promise<void> {
  const t = today();
  const xml = [
    xmlHeader(),
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n',
    `  <sitemap>\n    <loc>${DOMAIN}/sitemap-static.xml</loc>\n    <lastmod>${t}</lastmod>\n  </sitemap>\n`,
    `  <sitemap>\n    <loc>${DOMAIN}/sitemap-books.xml</loc>\n    <lastmod>${t}</lastmod>\n  </sitemap>\n`,
    `  <sitemap>\n    <loc>${DOMAIN}/sitemap-authors.xml</loc>\n    <lastmod>${t}</lastmod>\n  </sitemap>\n`,
    "</sitemapindex>",
  ].join("");

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600"); // 1 hour
  res.send(xml);
}

// ─── Static routes sitemap ────────────────────────────────────────────────────

export function serveStaticSitemap(_req: Request, res: Response): void {
  const t = today();
  const staticRoutes = [
    { path: "/",           priority: "1.0", changefreq: "daily"   },
    { path: "/browse",     priority: "0.8", changefreq: "weekly"  },
    { path: "/impressum",  priority: "0.3", changefreq: "monthly" },
    { path: "/datenschutz",priority: "0.3", changefreq: "monthly" },
  ];

  const xml = [
    xmlHeader(),
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n',
    ...staticRoutes.map(r => urlEntry(`${DOMAIN}${r.path}`, r.priority, r.changefreq, t)),
    "</urlset>",
  ].join("");

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day
  res.send(xml);
}

// ─── Books sitemap ────────────────────────────────────────────────────────────

export async function serveBooksSitemap(_req: Request, res: Response): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      res.status(503).send("Database unavailable");
      return;
    }

    // Fetch all book IDs and their importedAt date for lastmod
    const rows = await db.execute(
      sql`SELECT gutenbergId, importedAt FROM books WHERE type = 'Text' ORDER BY gutenbergId ASC`
    );
    const bookRows = rows[0] as unknown as { gutenbergId: number; importedAt: Date | null }[];

    const entries = bookRows.map(b => {
      const lastmod = b.importedAt
        ? new Date(b.importedAt).toISOString().split("T")[0]
        : today();
      return urlEntry(`${DOMAIN}/book/${b.gutenbergId}`, "0.7", "monthly", lastmod);
    });

    const xml = [
      xmlHeader(),
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n',
      ...entries,
      "</urlset>",
    ].join("");

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600"); // 1 hour
    res.send(xml);
  } catch (err) {
    console.error("[sitemap] Error generating books sitemap:", err);
    res.status(500).send("Error generating sitemap");
  }
}

// ─── Authors sitemap ──────────────────────────────────────────────────────────

export async function serveAuthorsSitemap(_req: Request, res: Response): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      res.status(503).send("Database unavailable");
      return;
    }

    // Fetch all distinct primary author names
    const rows = await db.execute(
      sql`SELECT DISTINCT authors FROM books WHERE type = 'Text' AND authors IS NOT NULL ORDER BY authors ASC`
    );
    const authorRows = rows[0] as unknown as { authors: string }[];

    // Parse author names — same logic as parseAuthors() in shared/gutenberg.ts
    const authorSet = new Set<string>();
    for (const row of authorRows) {
      const entries = row.authors.split(";").map((s: string) => s.trim());
      for (const entry of entries) {
        // Skip contributors, translators, editors etc.
        if (/\[(Translator|Editor|Contributor|Illustrator|Compiler|Annotator|Commentator|Adapter|Arranger|Foreword|Introduction|Preface)\]/i.test(entry)) {
          continue;
        }
        // Extract name part (before the first comma that precedes a year)
        const name = entry
          .replace(/,\s*\d{3,4}.*$/, "") // remove ", YYYY-YYYY" date suffix
          .replace(/\[.*?\]/g, "")        // remove role tags
          .trim();
        if (name.length > 2) {
          authorSet.add(name);
        }
      }
    }

    const t = today();
    const entries = Array.from(authorSet).map(name =>
      urlEntry(`${DOMAIN}/author/${encodeURIComponent(name)}`, "0.6", "monthly", t)
    );

    const xml = [
      xmlHeader(),
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n',
      ...entries,
      "</urlset>",
    ].join("");

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600"); // 1 hour
    res.send(xml);
  } catch (err) {
    console.error("[sitemap] Error generating authors sitemap:", err);
    res.status(500).send("Error generating sitemap");
  }
}
