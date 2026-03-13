import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, index } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Cached AI-generated summaries for Gutenberg books
export const bookSummaries = mysqlTable("book_summaries", {
  id: int("id").autoincrement().primaryKey(),
  gutenbergId: int("gutenbergId").notNull().unique(),
  shortSummary: text("shortSummary"),
  longSummary: text("longSummary"),
  coverCached: boolean("coverCached").default(false).notNull(),
  epubCached: boolean("epubCached").default(false).notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
});

export type BookSummary = typeof bookSummaries.$inferSelect;
export type InsertBookSummary = typeof bookSummaries.$inferInsert;

/**
 * Local catalog imported from Project Gutenberg's official pg_catalog.csv
 * Source: https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv
 * Updated weekly. Only German-language books (language contains 'de') are imported.
 */
export const books = mysqlTable("books", {
  // Gutenberg book ID (Text# in CSV)
  gutenbergId: int("gutenbergId").primaryKey(),
  // Type: Text, Sound, Image, etc.
  type: varchar("type", { length: 32 }).notNull().default("Text"),
  // ISO date string from CSV (e.g. "1996-02-01")
  issued: varchar("issued", { length: 16 }),
  title: text("title").notNull(),
  // Semicolon-separated language codes (e.g. "de" or "de; en")
  language: varchar("language", { length: 64 }).notNull(),
  // Raw authors string from CSV (e.g. "Kafka, Franz, 1883-1924")
  authors: text("authors"),
  // Semicolon-separated subjects from CSV
  subjects: text("subjects"),
  // Library of Congress Classification codes
  locc: varchar("locc", { length: 64 }),
  // Semicolon-separated bookshelves/categories
  bookshelves: text("bookshelves"),
  // When this row was last imported/updated from the CSV
  importedAt: timestamp("importedAt").defaultNow().notNull(),
  /**
   * Explicit copyright override for Germany (§ 64 UrhG).
   * NULL = use automatic heuristic (deathYear + 70).
   * 0    = definitively public domain (e.g. ancient authors, anonymous works).
   * YYYY = protected until end of that year (e.g. 2034 means protected through 2034).
   */
  copyrightProtectedUntil: int("copyrightProtectedUntil"),
}, (table) => ({
  titleIdx: index("title_idx").on(table.title),
}));

export type Book = typeof books.$inferSelect;
export type InsertBook = typeof books.$inferInsert;
