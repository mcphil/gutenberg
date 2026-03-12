import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock `fs` ────────────────────────────────────────────────
const mockExistsSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockWriteFileSync = vi.fn();

vi.mock("fs", () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
}));

// ─── Mock `fetch` ─────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Mock DB ──────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// ─── Helpers ─────────────────────────────────────────────────

/** Build a valid EPUB response: starts with PK magic bytes, large enough */
function makeEpubResponse(byteLength = 50_000) {
  const buffer = Buffer.alloc(byteLength, 0x00);
  // Write PK magic bytes (ZIP/EPUB signature)
  buffer[0] = 0x50; // P
  buffer[1] = 0x4b; // K
  buffer[2] = 0x03;
  buffer[3] = 0x04;
  return {
    ok: true,
    headers: { get: (h: string) => (h === "content-type" ? "application/epub+zip" : null) },
    arrayBuffer: async () => buffer.buffer as ArrayBuffer,
  };
}

function makeErrorResponse(status = 404) {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

function makeHtmlResponse() {
  const html = Buffer.from("<html><body>Not found</body></html>");
  return {
    ok: true,
    headers: { get: (h: string) => (h === "content-type" ? "text/html; charset=utf-8" : null) },
    arrayBuffer: async () => html.buffer as ArrayBuffer,
  };
}

// ─── Tests ───────────────────────────────────────────────────

describe("epubs — downloadEpub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
  });

  it("returns true and writes file when known epubUrl succeeds", async () => {
    mockFetch.mockResolvedValueOnce(makeEpubResponse());

    const { downloadEpub } = await import("./epubs");
    const result = await downloadEpub(11, "https://www.gutenberg.org/cache/epub/11/pg11.epub", 0);

    expect(result).toBe(true);
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const [writtenPath] = mockWriteFileSync.mock.calls[0] as [string, Buffer];
    expect(writtenPath).toMatch(/11\.epub$/);
  });

  it("falls back to candidate URLs when known URL returns 404", async () => {
    mockFetch
      .mockResolvedValueOnce(makeErrorResponse(404))  // known URL fails
      .mockResolvedValueOnce(makeEpubResponse());      // first candidate succeeds

    const { downloadEpub } = await import("./epubs");
    const result = await downloadEpub(42, "https://www.gutenberg.org/cache/epub/42/pg42.epub", 0);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
  });

  it("returns false when all URLs fail", async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(404));

    const { downloadEpub } = await import("./epubs");
    const result = await downloadEpub(999, undefined, 0);

    expect(result).toBe(false);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("rejects HTML error pages (text/html content-type)", async () => {
    mockFetch
      .mockResolvedValueOnce(makeHtmlResponse())  // HTML error page → skip
      .mockResolvedValueOnce(makeEpubResponse());  // real EPUB

    const { downloadEpub } = await import("./epubs");
    const result = await downloadEpub(55, undefined, 0);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("rejects files that are too small (< 2000 bytes)", async () => {
    const tinyBuffer = Buffer.alloc(500, 0x50); // too small
    tinyBuffer[0] = 0x50; tinyBuffer[1] = 0x4b; // valid magic bytes but tiny
    const tinyResponse = {
      ok: true,
      headers: { get: () => "application/epub+zip" },
      arrayBuffer: async () => tinyBuffer.buffer as ArrayBuffer,
    };

    mockFetch
      .mockResolvedValueOnce(tinyResponse)     // too small → skip
      .mockResolvedValueOnce(makeEpubResponse()); // real EPUB

    const { downloadEpub } = await import("./epubs");
    const result = await downloadEpub(77, undefined, 0);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("rejects files without ZIP/EPUB magic bytes (PK header)", async () => {
    const fakeBuffer = Buffer.alloc(50_000, 0xff); // no PK magic bytes
    const fakeResponse = {
      ok: true,
      headers: { get: () => "application/epub+zip" },
      arrayBuffer: async () => fakeBuffer.buffer as ArrayBuffer,
    };

    mockFetch
      .mockResolvedValueOnce(fakeResponse)       // no magic bytes → skip
      .mockResolvedValueOnce(makeEpubResponse()); // real EPUB

    const { downloadEpub } = await import("./epubs");
    const result = await downloadEpub(88, undefined, 0);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("skips download and returns true when file already exists on disk", async () => {
    mockExistsSync.mockReturnValue(true);

    const { downloadEpub } = await import("./epubs");
    const result = await downloadEpub(11, "https://example.com/pg11.epub", 0);

    expect(result).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });
});

describe("epubs — getEpubPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
  });

  it("returns a file path ending in the book ID when download succeeds", async () => {
    mockFetch.mockResolvedValueOnce(makeEpubResponse());

    const { getEpubPath } = await import("./epubs");
    const result = await getEpubPath(11, "https://www.gutenberg.org/cache/epub/11/pg11.epub");

    expect(result).not.toBeNull();
    expect(result).toMatch(/11\.epub$/);
  });

  it("returns null when all download attempts fail", async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(404));

    const { getEpubPath } = await import("./epubs");
    const result = await getEpubPath(999);

    expect(result).toBeNull();
  });
});

describe("epubs — candidateEpubUrls", () => {
  it("returns at least 2 candidate URLs for a given ID", async () => {
    const { candidateEpubUrls } = await import("./epubs");
    const urls = candidateEpubUrls(2229);
    expect(urls.length).toBeGreaterThanOrEqual(2);
    // All URLs should reference the book ID
    expect(urls.every((u) => u.includes("2229"))).toBe(true);
  });
});
