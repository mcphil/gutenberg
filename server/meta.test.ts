/**
 * meta.test.ts
 *
 * Tests for server-side meta tag injection (createMetaMiddleware).
 * Verifies that /book/:id and /author/:name return HTML with correct
 * Open Graph, Twitter Card, and JSON-LD tags.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import type { Request, Response, NextFunction } from "express";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getBookById: vi.fn(),
  getBooksByAuthor: vi.fn(),
}));

import { createMetaMiddleware } from "./meta";
import * as db from "./db";

// Use the real test fixture file (server/test-fixtures/index.html)
const FIXTURE_DIST = path.resolve(import.meta.dirname, "test-fixtures");

const defaultBook = {
  gutenbergId: 22738,
  title: "Faust. Eine Tragödie",
  authors: "Goethe, Johann Wolfgang von, 1749-1832",
  subjects: "Tragedies; German drama",
  bookshelves: "DE Belletristik",
  language: "de",
  type: "Text",
  issued: "2007-09-01",
  importedAt: new Date("2026-03-12"),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(reqPath: string): Partial<Request> {
  return { path: reqPath } as Partial<Request>;
}

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: "",
    send(b: string) { this.body = b; },
    setHeader(k: string, v: string) { this.headers[k] = v; },
    status(c: number) { this.statusCode = c; return this; },
  };
  return res;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("createMetaMiddleware", () => {
  const middleware = createMetaMiddleware(FIXTURE_DIST);
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
    vi.mocked(db.getBookById).mockResolvedValue(defaultBook);
    vi.mocked(db.getBooksByAuthor).mockResolvedValue([defaultBook]);
  });

  it("calls next() for non-book/author paths", async () => {
    const req = makeReq("/");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalledOnce();
    expect(res.body).toBe("");
  });

  it("calls next() for /catalog path", async () => {
    const req = makeReq("/catalog");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalledOnce();
  });

  it("injects OG meta tags for /book/:id", async () => {
    const req = makeReq("/book/22738");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.body).toContain("og:title");
    expect(res.body).toContain("Faust");
    expect(res.body).toContain("og:image");
    expect(res.body).toContain("/api/covers/22738");
    expect(res.body).toContain("og:image:width");
    expect(res.body).toContain("400");
    expect(res.body).toContain("og:image:height");
    expect(res.body).toContain("560");
    expect(res.body).toContain("og:image:type");
    expect(res.body).toContain("image/webp");
    expect(res.body).toContain("twitter:card");
    expect(res.body).toContain("summary_large_image");
  });

  it("injects JSON-LD schema for /book/:id", async () => {
    const req = makeReq("/book/22738");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    expect(res.body).toContain("application/ld+json");
    expect(res.body).toContain('"@type":"Book"');
    expect(res.body).toContain('"name":"Faust. Eine Trag');
  });

  it("sets og:type=book for book pages", async () => {
    const req = makeReq("/book/22738");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    expect(res.body).toContain("og:type");
    expect(res.body).toContain('"book"');
  });

  it("sets correct canonical URL for book pages", async () => {
    const req = makeReq("/book/22738");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    expect(res.body).toContain('rel="canonical"');
    expect(res.body).toContain("gutenberg-navigator.de/book/22738");
  });

  it("injects OG meta tags for /author/:name", async () => {
    const req = makeReq("/author/Goethe%2C%20Johann%20Wolfgang%20von%2C%201749-1832");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.body).toContain("og:title");
    expect(res.body).toContain("Goethe");
    expect(res.body).toContain("og:image");
    expect(res.body).toContain("/api/covers/22738");
  });

  it("sets Content-Type header to text/html", async () => {
    const req = makeReq("/book/22738");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    expect(res.headers["Content-Type"]).toContain("text/html");
  });

  it("sets Cache-Control header for meta pages", async () => {
    const req = makeReq("/book/22738");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    expect(res.headers["Cache-Control"]).toBeDefined();
    expect(res.headers["Cache-Control"]).toContain("public");
  });

  it("removes static title tag and replaces with dynamic one", async () => {
    const req = makeReq("/book/22738");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    // Static title should be replaced
    expect(res.body).not.toContain("<title>Gutenberg Navigator</title>");
    // Dynamic title should contain book title
    expect(res.body).toContain("Faust");
  });

  it("removes all existing og: tags from index.html before injecting new ones (no duplicates)", async () => {
    const req = makeReq("/book/22738");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    // Should NOT contain the generic/default OG values from index.html
    expect(res.body).not.toContain('og:url" content="https://gutenberg-navigator.de/"');
    expect(res.body).not.toContain('Gutenberg Navigator — Klassiker kostenlos lesen');
    expect(res.body).not.toContain('og-default.png');

    // Should contain exactly ONE og:title (no duplicates)
    const ogTitleCount = (res.body.match(/property="og:title"/g) || []).length;
    expect(ogTitleCount).toBe(1);

    // Should contain exactly ONE og:image (no duplicates)
    const ogImageCount = (res.body.match(/property="og:image"/g) || []).length;
    expect(ogImageCount).toBe(1);

    // The single og:title should be the book-specific one
    expect(res.body).toContain('og:title');
    expect(res.body).toContain('Faust');
  });

  it("removes existing canonical link and injects book-specific one", async () => {
    const req = makeReq("/book/22738");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    // Should NOT contain the generic canonical from index.html
    expect(res.body).not.toContain('canonical" href="https://gutenberg-navigator.de/"');

    // Should contain exactly ONE canonical (no duplicates)
    const canonicalCount = (res.body.match(/rel="canonical"/g) || []).length;
    expect(canonicalCount).toBe(1);

    // The canonical should point to the book page
    expect(res.body).toContain('canonical" href="https://gutenberg-navigator.de/book/22738"');
  });

  it("sends HTML with unmodified template when book is not found", async () => {
    vi.mocked(db.getBookById).mockResolvedValueOnce(null);

    const req = makeReq("/book/99999");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    // When book not found, middleware sends the unmodified HTML (no meta injection)
    expect(res.body).toContain("<!DOCTYPE html>");
  });

  it("sends HTML with unmodified template when author has no books", async () => {
    vi.mocked(db.getBooksByAuthor).mockResolvedValueOnce([]);

    const req = makeReq("/author/UnknownAuthor");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    // When author not found, middleware sends the unmodified HTML
    expect(res.body).toContain("<!DOCTYPE html>");
  });

  it("escapes HTML entities in title and description", async () => {
    vi.mocked(db.getBookById).mockResolvedValueOnce({
      gutenbergId: 1,
      title: 'Book with <script> & "quotes"',
      authors: "Author, Test",
      subjects: "",
      bookshelves: "",
      language: "de",
      type: "Text",
      issued: "2000-01-01",
      importedAt: new Date(),
    });

    const req = makeReq("/book/1");
    const res = makeRes();
    await middleware(req as Request, res as unknown as Response, next as NextFunction);

    // Meta tag attribute values should have HTML-escaped content
    expect(res.body).toContain("&lt;script&gt;");
    expect(res.body).toContain("&amp;");
    // The og:title attribute should not contain raw unescaped < or >
    const ogTitleMatch = res.body.match(/og:title" content="([^"]*)"/); 
    expect(ogTitleMatch).not.toBeNull();
    if (ogTitleMatch) {
      expect(ogTitleMatch[1]).not.toContain('<');
      expect(ogTitleMatch[1]).not.toContain('>');
    }
  });
});
