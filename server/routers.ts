import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getBookSummary, listBooks, getBookById, getRandomBooks, getTotalBookCount, getRelatedBooks, getBooksByAuthor, getCachedEpubBooks } from "./db";
import { searchEpub } from "./epub-search";
import { getAuthorDisplay } from "../shared/gutenberg";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  books: router({
    // List German books from local catalog with search and filter
    list: publicProcedure
      .input(z.object({
        page: z.number().int().min(1).default(1),
        search: z.string().optional(),
        topic: z.string().optional(),
        subject: z.string().optional(),
        sort: z.enum(["popular", "ascending", "descending", "random"]).default("random"),
      }))
      .query(async ({ input }) => {
        return listBooks({
          page: input.page,
          search: input.search,
          topic: input.topic,
          subject: input.subject,
          sort: input.sort,
        });
      }),

    // Get a single book by Gutenberg ID from local catalog
    byId: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const book = await getBookById(input.id);
        if (!book) throw new Error(`Book ${input.id} not found in local catalog`);
        return book;
      }),

    // Get random books for browse/swipe mode
    random: publicProcedure
      .input(z.object({ count: z.number().int().min(1).max(50).default(20) }))
      .query(async ({ input }) => {
        return getRandomBooks(input.count);
      }),

    // Get total count of German books in local catalog
    count: publicProcedure.query(async () => {
      return getTotalBookCount();
    }),

    // Get thematically related books based on shared subjects
    related: publicProcedure
      .input(z.object({
        gutenbergId: z.number().int().positive(),
        count: z.number().int().min(1).max(10).default(5),
      }))
      .query(async ({ input }) => {
        return getRelatedBooks(input.gutenbergId, input.count);
      }),

    // Get all books by a given author name
    byAuthor: publicProcedure
      .input(z.object({ authorName: z.string().min(1) }))
      .query(async ({ input }) => {
        return getBooksByAuthor(input.authorName);
      }),

    // Full-text search across locally cached EPUB files
    fullTextSearch: publicProcedure
      .input(z.object({
        query: z.string().min(2).max(100),
      }))
      .query(async ({ input }) => {
        const q = input.query.trim();
        if (q.length < 2) return { results: [], query: q };

        // Get all books that have a cached EPUB on disk
        const books = await getCachedEpubBooks();

        const allMatches = [];
        for (const book of books) {
          const matches = searchEpub(
            book.gutenbergId,
            book.title,
            getAuthorDisplay(book),
            q
          );
          allMatches.push(...matches);
        }

        return { results: allMatches, query: q };
      }),
  }),

  summaries: router({
    // Fetch pre-generated summary from database (generated via batch script)
    getCached: publicProcedure
      .input(z.object({ gutenbergId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const cached = await getBookSummary(input.gutenbergId);
        return cached ?? null;
      }),
  }),
});

export type AppRouter = typeof appRouter;
