import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
