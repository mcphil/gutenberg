import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getBookSummary, listBooks, getBookById, getRandomBooks, getTotalBookCount, getRelatedBooks } from "./db";

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
        sort: z.enum(["popular", "ascending", "descending"]).default("popular"),
      }))
      .query(async ({ input }) => {
        return listBooks({
          page: input.page,
          search: input.search,
          topic: input.topic,
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
