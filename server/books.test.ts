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

// ─── Mock LLM ─────────────────────────────────────────────────────────────────

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            short: "Ein philosophisches Werk über Logik und Sprache.",
            long: "Der Tractatus Logico-Philosophicus ist ein frühes Werk Ludwig Wittgensteins, das 1921 veröffentlicht wurde. Es behandelt die Grenzen der Sprache und ihre Beziehung zur Welt.",
          }),
        },
      },
    ],
  }),
}));

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

// ─── summaries.generate ───────────────────────────────────────────────────────

describe("summaries.generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a summary via LLM when no cache exists", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const { upsertBookSummary } = await import("./db");

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.summaries.generate({
      gutenbergId: 5740,
      title: "Tractatus Logico-Philosophicus",
      authorsRaw: "Wittgenstein, Ludwig, 1889-1951",
      subjectsRaw: "Logic; Philosophy",
      type: "both",
    });

    expect(result.shortSummary).toBe("Ein philosophisches Werk über Logik und Sprache.");
    expect(result.longSummary).toContain("Wittgenstein");
    expect(result.fromCache).toBe(false);
    expect(invokeLLM).toHaveBeenCalledOnce();
    expect(upsertBookSummary).toHaveBeenCalledWith(
      expect.objectContaining({ gutenbergId: 5740 })
    );
  });

  it("returns cached summary without calling LLM", async () => {
    const { getBookSummary } = await import("./db");
    const { invokeLLM } = await import("./_core/llm");

    vi.mocked(getBookSummary).mockResolvedValueOnce({
      id: 1,
      gutenbergId: 5740,
      shortSummary: "Cached short summary.",
      longSummary: "Cached long summary about Wittgenstein.",
      generatedAt: new Date(),
      coverCached: false,
      epubCached: false,
    });

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.summaries.generate({
      gutenbergId: 5740,
      title: "Tractatus",
      authorsRaw: "Wittgenstein, Ludwig, 1889-1951",
      type: "both",
    });

    expect(result.fromCache).toBe(true);
    expect(result.shortSummary).toBe("Cached short summary.");
    expect(invokeLLM).not.toHaveBeenCalled();
  });
});
