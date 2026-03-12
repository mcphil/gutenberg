import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock local DB helpers ────────────────────────────────────────────────────

vi.mock("./db", () => {
  const book = {
    gutenbergId: 5740,
    type: "Text",
    issued: "2004-01-01",
    title: "Tractatus Logico-Philosophicus",
    language: "de",
    authors: "Wittgenstein, Ludwig, 1889-1951",
    subjects: "Logic; Philosophy",
    locc: "BC",
    bookshelves: "DE Philosophie",
    importedAt: new Date("2026-03-12"),
  };
  return {
    listBooks: vi.fn().mockResolvedValue({ books: [book], total: 2420, page: 1, pages: 121 }),
    getBookById: vi.fn().mockResolvedValue(book),
    getRandomBooks: vi.fn().mockResolvedValue([book]),
    getTotalBookCount: vi.fn().mockResolvedValue(2420),
    getBookSummary: vi.fn().mockResolvedValue(null),
    upsertBookSummary: vi.fn().mockResolvedValue(undefined),
    getDb: vi.fn().mockResolvedValue(null),
    upsertUser: vi.fn().mockResolvedValue(undefined),
    getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  };
});

const mockLocalBook = {
  gutenbergId: 5740,
  type: "Text",
  issued: "2004-01-01",
  title: "Tractatus Logico-Philosophicus",
  language: "de",
  authors: "Wittgenstein, Ludwig, 1889-1951",
  subjects: "Logic; Philosophy",
  locc: "BC",
  bookshelves: "DE Philosophie",
  importedAt: new Date("2026-03-12"),
};

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── books.list ───────────────────────────────────────────────────────────────

describe("books.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns books from local DB with default params", async () => {
    const { listBooks } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.books.list({ page: 1, sort: "popular" });

    expect(result.total).toBe(2420);
    expect(result.books).toHaveLength(1);
    expect(result.books[0].title).toBe("Tractatus Logico-Philosophicus");
    expect(listBooks).toHaveBeenCalledWith(expect.objectContaining({ page: 1, sort: "popular" }));
  });

  it("passes search query to listBooks", async () => {
    const { listBooks } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await caller.books.list({ page: 1, search: "Kafka", sort: "popular" });

    expect(listBooks).toHaveBeenCalledWith(expect.objectContaining({ search: "Kafka" }));
  });

  it("passes topic filter to listBooks", async () => {
    const { listBooks } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await caller.books.list({ page: 1, topic: "drama", sort: "popular" });

    expect(listBooks).toHaveBeenCalledWith(expect.objectContaining({ topic: "drama" }));
  });

  it("passes sort=ascending to listBooks", async () => {
    const { listBooks } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await caller.books.list({ page: 1, sort: "ascending" });

    expect(listBooks).toHaveBeenCalledWith(expect.objectContaining({ sort: "ascending" }));
  });

  it("passes sort=popular to listBooks", async () => {
    const { listBooks } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await caller.books.list({ page: 1, sort: "popular" });

    expect(listBooks).toHaveBeenCalledWith(expect.objectContaining({ sort: "popular" }));
  });
});

// ─── books.byId ───────────────────────────────────────────────────────────────

describe("books.byId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches a single book by Gutenberg ID from local catalog", async () => {
    const { getBookById } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.books.byId({ id: 5740 });

    expect(result.gutenbergId).toBe(5740);
    expect(result.title).toBe("Tractatus Logico-Philosophicus");
    expect(getBookById).toHaveBeenCalledWith(5740);
  });

  it("throws when book is not found", async () => {
    const { getBookById } = await import("./db");
    vi.mocked(getBookById).mockResolvedValueOnce(undefined);

    const caller = appRouter.createCaller(createCtx());
    await expect(caller.books.byId({ id: 99999 })).rejects.toThrow("not found");
  });
});

// ─── summaries.getCached ──────────────────────────────────────────────────────
// The generate mutation has been removed. Summaries are now pre-generated via
// the batch script (server/scripts/generate-summaries.ts) and fetched here.

describe("summaries.getCached", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no summary exists in DB", async () => {
    const { getBookSummary } = await import("./db");
    vi.mocked(getBookSummary).mockResolvedValueOnce(undefined);

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.summaries.getCached({ gutenbergId: 5740 });

    expect(result).toBeNull();
    expect(getBookSummary).toHaveBeenCalledWith(5740);
  });

  it("returns cached summary when it exists in DB", async () => {
    const { getBookSummary } = await import("./db");
    vi.mocked(getBookSummary).mockResolvedValueOnce({
      id: 1,
      gutenbergId: 5740,
      shortSummary: "Ein philosophisches Werk über Logik und Sprache.",
      longSummary: "Der Tractatus Logico-Philosophicus ist ein frühes Werk Ludwig Wittgensteins.",
      generatedAt: new Date(),
      coverCached: false,
      epubCached: false,
    });

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.summaries.getCached({ gutenbergId: 5740 });

    expect(result).not.toBeNull();
    expect(result?.shortSummary).toBe("Ein philosophisches Werk über Logik und Sprache.");
    expect(result?.longSummary).toContain("Wittgenstein");
    expect(getBookSummary).toHaveBeenCalledWith(5740);
  });

  it("does not expose a generate mutation (batch-only generation)", () => {
    // summaries.generate was removed — only getCached remains.
    // Verify by checking the router's procedure map directly.
    const procedures = Object.keys(appRouter._def.procedures);
    const hasGenerate = procedures.some((p) => p.startsWith("summaries.generate"));
    expect(hasGenerate).toBe(false);
    const hasCached = procedures.some((p) => p.startsWith("summaries.getCached"));
    expect(hasCached).toBe(true);
  });
});
