import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the DB helpers
vi.mock("./db", () => ({
  getBookSummary: vi.fn().mockResolvedValue(null),
  upsertBookSummary: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

// Mock the LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            short: "Ein philosophisches Werk über Logik und Sprache.",
            long: "Der Tractatus Logico-Philosophicus ist ein frühes Werk Ludwig Wittgensteins, das 1921 veröffentlicht wurde. Es behandelt die Grenzen der Sprache und ihre Beziehung zur Welt. Wittgenstein argumentiert, dass die Welt aus Tatsachen besteht und Sprache diese Tatsachen abbildet. Das Werk endet mit dem berühmten Satz: Worüber man nicht sprechen kann, darüber muss man schweigen.",
          }),
        },
      },
    ],
  }),
}));

// Mock fetch for Gutendex API
const mockBook = {
  id: 5740,
  title: "Tractatus Logico-Philosophicus",
  authors: [{ name: "Wittgenstein, Ludwig", birth_year: 1889, death_year: 1951 }],
  summaries: ["A philosophical treatise on logic."],
  subjects: ["Logic", "Philosophy"],
  bookshelves: [],
  languages: ["de"],
  copyright: false,
  media_type: "Text",
  formats: {
    "application/epub+zip": "https://www.gutenberg.org/ebooks/5740.epub.images",
    "image/jpeg": "https://www.gutenberg.org/cache/epub/5740/pg5740.cover.medium.jpg",
  },
  download_count: 10500,
};

const mockListResponse = {
  count: 2420,
  next: "https://gutendex.com/books/?languages=de&page=2",
  previous: null,
  results: [mockBook],
};

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockListResponse),
} as Response);

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("books.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockListResponse),
    });
  });

  it("fetches German books with default params", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.books.list({ page: 1, sort: "popular" });

    expect(result.count).toBe(2420);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].title).toBe("Tractatus Logico-Philosophicus");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("languages=de"),
      expect.any(Object)
    );
  });

  it("passes search query to Gutendex", async () => {
    const caller = appRouter.createCaller(createCtx());
    await caller.books.list({ page: 1, search: "Kafka", sort: "popular" });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("search=Kafka"),
      expect.any(Object)
    );
  });

  it("passes topic filter to Gutendex", async () => {
    const caller = appRouter.createCaller(createCtx());
    await caller.books.list({ page: 1, topic: "drama", sort: "popular" });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("topic=drama"),
      expect.any(Object)
    );
  });

  it("passes sort=ascending to Gutendex", async () => {
    const caller = appRouter.createCaller(createCtx());
    await caller.books.list({ page: 1, sort: "ascending" });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("sort=ascending"),
      expect.any(Object)
    );
  });

  it("does NOT pass sort param for popular (default)", async () => {
    const caller = appRouter.createCaller(createCtx());
    await caller.books.list({ page: 1, sort: "popular" });

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).not.toContain("sort=popular");
  });
});

describe("books.byId", () => {
  beforeEach(() => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockBook),
    });
  });

  it("fetches a single book by ID", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.books.byId({ id: 5740 });

    expect(result.id).toBe(5740);
    expect(result.title).toBe("Tractatus Logico-Philosophicus");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/books/5740"),
      expect.any(Object)
    );
  });
});

describe("summaries.generate", () => {
  it("generates a summary via LLM when no cache exists", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const { upsertBookSummary } = await import("./db");

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.summaries.generate({
      gutenbergId: 5740,
      title: "Tractatus Logico-Philosophicus",
      authors: [{ name: "Wittgenstein, Ludwig", birth_year: 1889, death_year: 1951 }],
      subjects: ["Logic", "Philosophy"],
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

    vi.mocked(invokeLLM).mockClear();
    vi.mocked(getBookSummary).mockResolvedValueOnce({
      id: 1,
      gutenbergId: 5740,
      shortSummary: "Cached short summary.",
      longSummary: "Cached long summary about Wittgenstein.",
      generatedAt: new Date(),
    });

    const caller = appRouter.createCaller(createCtx());
    const result = await caller.summaries.generate({
      gutenbergId: 5740,
      title: "Tractatus",
      authors: [{ name: "Wittgenstein, Ludwig", birth_year: 1889, death_year: 1951 }],
      subjects: ["Logic"],
      type: "both",
    });

    expect(result.fromCache).toBe(true);
    expect(result.shortSummary).toBe("Cached short summary.");
    expect(invokeLLM).not.toHaveBeenCalled();
  });
});

describe("books.subjects", () => {
  it("returns a list of subject strings", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.books.subjects();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("Fiction");
  });
});
