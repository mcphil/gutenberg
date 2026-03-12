import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getBookSummary, upsertBookSummary, listBooks, getBookById, getRandomBooks, getTotalBookCount } from "./db";

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
  }),

  summaries: router({
    // Generate or retrieve cached AI summary for a book
    generate: publicProcedure
      .input(z.object({
        gutenbergId: z.number().int().positive(),
        title: z.string(),
        /** Raw authors CSV string from pg_catalog.csv, e.g. "Kafka, Franz, 1883-1924" */
        authorsRaw: z.string(),
        /** Semicolon-separated subjects from pg_catalog.csv */
        subjectsRaw: z.string().optional(),
        type: z.enum(["short", "long", "both"]).default("both"),
      }))
      .mutation(async ({ input }) => {
        // Check cache first
        const cached = await getBookSummary(input.gutenbergId);
        if (cached?.shortSummary && cached?.longSummary) {
          return {
            gutenbergId: input.gutenbergId,
            shortSummary: cached.shortSummary,
            longSummary: cached.longSummary,
            fromCache: true,
          };
        }

        // Parse authors from CSV format "Lastname, Firstname, YYYY-YYYY"
        const authorParts = input.authorsRaw.split(";").map((a) => a.trim()).filter(Boolean);
        const authorDisplay = authorParts.map((raw) => {
          const yearMatch = raw.match(/,\s*(\d{4})?-(\d{4})?$/);
          const name = yearMatch ? raw.slice(0, raw.lastIndexOf(",")).trim() : raw;
          const parts = name.split(", ");
          return parts.length === 2 ? `${parts[1]} ${parts[0]}` : name;
        }).join(", ");

        // Parse subjects
        const subjects = (input.subjectsRaw || "")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 8)
          .join(", ");

        const systemPrompt = `Du bist ein sachlicher Literaturkritiker. Deine Aufgabe ist es, neutrale, informative Zusammenfassungen von Büchern zu schreiben, die Lesern helfen zu entscheiden, ob sie ihre Lesezeit in ein Buch investieren möchten.

Wichtige Regeln:
- Bleibe streng neutral und sachlich — keine Wertungen wie "fesselnd", "brillant", "meisterhaft"
- Beschreibe WAS das Buch ist, nicht ob es gut ist
- Nenne Epoche, Gattung, Hauptthemen und Handlungsrahmen
- Vermeide Spoiler für Wendepunkte oder das Ende
- Schreibe auf Deutsch`;

        const userPrompt = `Schreibe zwei Zusammenfassungen für folgendes Buch:

Titel: "${input.title}"
Autor: ${authorDisplay}
Themen/Kategorien: ${subjects || "nicht angegeben"}

Erstelle:
1. KURZZUSAMMENFASSUNG (max. 2 Sätze, ~30 Wörter): Gattung, Epoche und zentrales Thema
2. DETAILZUSAMMENFASSUNG (4-6 Sätze, ~120 Wörter): Handlungsrahmen, Hauptfiguren, zentrale Konflikte, literarischer Kontext — alles was hilft zu entscheiden ob man das Buch lesen möchte

Antworte im JSON-Format:
{
  "short": "...",
  "long": "..."
}`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "book_summary",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  short: { type: "string", description: "Short summary, max 2 sentences" },
                  long: { type: "string", description: "Detailed summary, 4-6 sentences" },
                },
                required: ["short", "long"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices?.[0]?.message?.content;
        if (!rawContent) throw new Error("No LLM response");
        const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        const parsed = JSON.parse(content) as { short: string; long: string };

        // Cache in DB
        await upsertBookSummary({
          gutenbergId: input.gutenbergId,
          shortSummary: parsed.short,
          longSummary: parsed.long,
        });

        return {
          gutenbergId: input.gutenbergId,
          shortSummary: parsed.short,
          longSummary: parsed.long,
          fromCache: false,
        };
      }),

    // Get cached summary without generating
    getCached: publicProcedure
      .input(z.object({ gutenbergId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const cached = await getBookSummary(input.gutenbergId);
        return cached ?? null;
      }),
  }),
});

export type AppRouter = typeof appRouter;
