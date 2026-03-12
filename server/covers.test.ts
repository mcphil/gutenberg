/**
 * Tests for the cover cache service.
 *
 * We use vi.mock with a factory to fully replace `fs` with spy functions,
 * and vi.stubGlobal to replace `fetch`. The module under test is imported
 * *after* the mocks are set up via dynamic import inside each test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock `fs` with spy functions ────────────────────────────
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

// ─── Mock `fetch` globally ───────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Mock DB so we don't need a real database ────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// ─── Helpers ─────────────────────────────────────────────────

function makeImageResponse(byteLength = 5000, contentType = "image/jpeg") {
  const buffer = Buffer.alloc(byteLength, 0xff);
  return {
    ok: true,
    headers: { get: (h: string) => (h === "content-type" ? contentType : null) },
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

// ─── Tests ───────────────────────────────────────────────────

describe("covers — downloadCover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: the cover file does NOT exist on disk
    mockExistsSync.mockReturnValue(false);
    // Default mkdirSync is a no-op
    mockMkdirSync.mockReturnValue(undefined);
  });

  it("returns true and writes file when first candidate URL succeeds", async () => {
    mockFetch.mockResolvedValueOnce(makeImageResponse(5000));

    const { downloadCover } = await import("./covers");
    const result = await downloadCover(11, 0);

    expect(result).toBe(true);
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const [writtenPath] = mockWriteFileSync.mock.calls[0] as [string, Buffer];
    expect(writtenPath).toMatch(/11\.jpg$/);
  });

  it("tries next candidate URL when first returns 404", async () => {
    mockFetch
      .mockResolvedValueOnce(makeErrorResponse(404))   // first URL fails
      .mockResolvedValueOnce(makeImageResponse(5000));  // second URL succeeds

    const { downloadCover } = await import("./covers");
    const result = await downloadCover(42, 0);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
  });

  it("returns false when all candidate URLs fail", async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(404));

    const { downloadCover } = await import("./covers");
    const result = await downloadCover(999, 0);

    expect(result).toBe(false);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("rejects suspiciously small files (blank placeholder images < 1500 bytes)", async () => {
    // First URL returns a tiny 807-byte 'blank' image — should be skipped
    mockFetch
      .mockResolvedValueOnce(makeImageResponse(807))    // too small → skip
      .mockResolvedValueOnce(makeImageResponse(5000));  // second URL is a real cover

    const { downloadCover } = await import("./covers");
    const result = await downloadCover(77, 0);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
  });

  it("rejects responses with non-image content-type", async () => {
    mockFetch
      .mockResolvedValueOnce(makeImageResponse(5000, "text/html"))  // HTML error page
      .mockResolvedValueOnce(makeImageResponse(5000));               // real image

    const { downloadCover } = await import("./covers");
    const result = await downloadCover(55, 0);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("skips download and returns true when file already exists on disk", async () => {
    mockExistsSync.mockReturnValue(true);

    const { downloadCover } = await import("./covers");
    const result = await downloadCover(11, 0);

    expect(result).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });
});

describe("covers — getCoverPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
  });

  it("returns a file path ending in the book ID when download succeeds", async () => {
    mockFetch.mockResolvedValueOnce(makeImageResponse(5000));

    const { getCoverPath } = await import("./covers");
    const result = await getCoverPath(11);

    expect(result).not.toBeNull();
    expect(result).toMatch(/11\.jpg$/);
  });

  it("returns null when all download attempts fail", async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(404));

    const { getCoverPath } = await import("./covers");
    const result = await getCoverPath(999);

    expect(result).toBeNull();
  });
});
