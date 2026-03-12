import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getBookSummary, upsertBookSummary } from "./db";
import type { GutendexResponse, GutenbergBook } from "../shared/gutenberg";

const GUTENDEX_BASE = "https://gutendex.com";

async function fetchGutendex(path: string): Promise<unknown> {
  const res = await fetch(`${GUTENDEX_BASE}${path}`, {
    headers: {
      "User-Agent": "GutenbergLeser/1.0 (personal reading app; contact: gutenbergleser@example.com)",
    },
  });
  if (!res.ok) throw new Error(`Gutendex error: ${res.status}`);
  return res.json();
}

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
    // List German books with search and filter
    list: publicProcedure
      .input(z.object({
        page: z.number().int().min(1).default(1),
        search: z.string().optional(),
        topic: z.string().optional(),
        sort: z.enum(["popular", "ascending", "descending"]).default("popular"),
      }))
      .query(async ({ input }) => {
        const params = new URLSearchParams();
        params.set("languages", "de");
        params.set("page", String(input.page));
        if (input.search) params.set("search", input.search);
        if (input.topic) params.set("topic", input.topic);
        if (input.sort !== "popular") params.set("sort", input.sort);

        const data = await fetchGutendex(`/books/?${params.toString()}`) as GutendexResponse;
        return data;
      }),

    // Get a single book by Gutenberg ID
    byId: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const data = await fetchGutendex(`/books/${input.id}`) as GutenbergBook;
        return data;
      }),

    // Get subjects/topics for German books (for filter UI)
    subjects: publicProcedure.query(async () => {
      // Return a curated list of common German literature subjects
      return [
        "Fiction", "Drama", "Poetry", "Novel", "Short stories",
        "History", "Philosophy", "Science", "Biography",
        "Fairy tales", "Adventure", "Romance", "Detective fiction",
        "Classical literature", "Expressionism", "Realism",
      ];
    }),
  }),

  summaries: router({
    // Generate or retrieve cached AI summary for a book
    generate: publicProcedure
      .input(z.object({
        gutenbergId: z.number().int().positive(),
        title: z.string(),
        authors: z.array(z.object({
          name: z.string(),
          birth_year: z.number().nullable(),
          death_year: z.number().nullable(),
        })),
        subjects: z.array(z.string()),
        existingSummary: z.string().optional(),
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

        const authorNames = input.authors
          .map((a) => {
            const parts = a.name.split(", ");
            return parts.length === 2 ? `${parts[1]} ${parts[0]}` : a.name;
          })
          .join(", ");

        const authorYears = input.authors[0]
          ? input.authors[0].birth_year && input.authors[0].death_year
            ? ` (${input.authors[0].birth_year}–${input.authors[0].death_year})`
            : ""
          : "";

        const subjectList = input.subjects.slice(0, 8).join(", ");
        const existingContext = input.existingSummary
          ? `\n\nVorhandene Beschreibung (als Kontext): ${input.existingSummary}`
          : "";

        const systemPrompt = `Du bist ein sachlicher Literaturkritiker. Deine Aufgabe ist es, neutrale, informative Zusammenfassungen von Büchern zu schreiben, die Lesern helfen zu entscheiden, ob sie ihre Lesezeit in ein Buch investieren möchten. 

Wichtige Regeln:
- Bleibe streng neutral und sachlich — keine Wertungen wie "fesselnd", "brillant", "meisterhaft"
- Beschreibe WAS das Buch ist, nicht ob es gut ist
- Nenne Epoche, Gattung, Hauptthemen und Handlungsrahmen
- Vermeide Spoiler für Wendepunkte oder das Ende
- Schreibe auf Deutsch`;

        const userPrompt = `Schreibe zwei Zusammenfassungen für folgendes Buch:

Titel: "${input.title}"
Autor: ${authorNames}${authorYears}
Themen/Kategorien: ${subjectList}${existingContext}

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
