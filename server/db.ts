import { eq, like, or, sql, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, bookSummaries, InsertBookSummary, books, Book } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Book catalog queries (from pg_catalog.csv import) ───────────────────────

const PAGE_SIZE = 32;

export interface BookListOptions {
  page: number;
  search?: string;
  topic?: string;
  sort: "popular" | "ascending" | "descending";
}

/**
 * List German books from the local catalog with pagination, search and filter.
 * "popular" sort uses download_count from bookSummaries if available, otherwise
 * falls back to gutenbergId descending (newer books tend to be more popular).
 */
export async function listBooks(opts: BookListOptions): Promise<{ books: Book[]; total: number; page: number; pages: number }> {
  const db = await getDb();
  if (!db) return { books: [], total: 0, page: 1, pages: 0 };

  const offset = (opts.page - 1) * PAGE_SIZE;

  // Build WHERE conditions
  const conditions: ReturnType<typeof sql>[] = [
    sql`${books.type} = 'Text'`,
  ];

  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(sql`(${books.title} LIKE ${term} OR ${books.authors} LIKE ${term})`);
  }

  if (opts.topic) {
    const term = `%${opts.topic}%`;
    conditions.push(sql`(${books.subjects} LIKE ${term} OR ${books.bookshelves} LIKE ${term})`);
  }

  const whereClause = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  // Sort
  let orderClause: ReturnType<typeof sql>;
  if (opts.sort === "ascending") {
    orderClause = sql`ORDER BY ${books.title} ASC`;
  } else if (opts.sort === "descending") {
    orderClause = sql`ORDER BY ${books.title} DESC`;
  } else {
    // "popular" — sort by gutenbergId DESC as a proxy (higher IDs = more recently added)
    orderClause = sql`ORDER BY ${books.gutenbergId} DESC`;
  }

  // db.execute returns [rows, fields] — destructure to get just the rows array
  const [countResult] = await db.execute(
    sql`SELECT COUNT(*) as total FROM books ${whereClause}`
  );
  const total = (countResult as unknown as { total: number }[])[0]?.total ?? 0;

  const [bookRows] = await db.execute(
    sql`SELECT * FROM books ${whereClause} ${orderClause} LIMIT ${PAGE_SIZE} OFFSET ${offset}`
  );

  return {
    books: bookRows as unknown as Book[],
    total: Number(total),
    page: opts.page,
    pages: Math.ceil(Number(total) / PAGE_SIZE),
  };
}

export async function getBookById(gutenbergId: number): Promise<Book | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(books).where(eq(books.gutenbergId, gutenbergId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRandomBooks(count: number): Promise<Book[]> {
  const db = await getDb();
  if (!db) return [];
  // db.execute returns [rows, fields] — destructure to get just the rows array
  const [rows] = await db.execute(
    sql`SELECT * FROM books WHERE type = 'Text' ORDER BY RAND() LIMIT ${count}`
  );
  return rows as unknown as Book[];
}

export async function getTotalBookCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  // db.execute returns [rows, fields] — destructure to get just the rows array
  const [result] = await db.execute(
    sql`SELECT COUNT(*) as total FROM books WHERE type = 'Text'`
  );
  return Number((result as unknown as { total: number }[])[0]?.total ?? 0);
}

// ─── Book summaries ───────────────────────────────────────────────────────────

export async function getBookSummary(gutenbergId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bookSummaries).where(eq(bookSummaries.gutenbergId, gutenbergId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertBookSummary(data: InsertBookSummary): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(bookSummaries).values(data).onDuplicateKeyUpdate({
    set: {
      shortSummary: data.shortSummary,
      longSummary: data.longSummary,
      generatedAt: new Date(),
    },
  });
}

// ─── Related books ────────────────────────────────────────────────────────────
/**
 * Find books that share subjects with the given book.
 * Scores each candidate by counting how many of the source book's subject
 * terms appear in the candidate's subjects field, then returns the top `count`.
 */
export async function getRelatedBooks(gutenbergId: number, count = 5): Promise<Book[]> {
  const db = await getDb();
  if (!db) return [];

  // Fetch source book's subjects
  const source = await getBookById(gutenbergId);
  if (!source?.subjects) return [];

  // Parse into individual terms (split on ";", trim, filter very short ones)
  const terms = source.subjects
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
    .slice(0, 6);

  if (terms.length === 0) return [];

  // Safely escape each term for use in LIKE patterns (escape %, _, \)
  const escapeTerm = (t: string) =>
    "'%" + t.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/'/g, "''") + "%'";

  // Score = number of matching subject terms
  const scoreExpr = terms
    .map((t) => `(CASE WHEN subjects LIKE ${escapeTerm(t)} THEN 1 ELSE 0 END)`)
    .join(" + ");

  const orConditions = terms
    .map((t) => `subjects LIKE ${escapeTerm(t)}`)
    .join(" OR ");

  const [rows] = await db.execute(
    sql`SELECT *, (${sql.raw(scoreExpr)}) AS _score
        FROM books
        WHERE type = 'Text'
          AND gutenbergId != ${gutenbergId}
          AND (${sql.raw(orConditions)})
        ORDER BY _score DESC, gutenbergId DESC
        LIMIT ${count}`
  );

  return (rows as unknown as Book[]) ?? [];
}
