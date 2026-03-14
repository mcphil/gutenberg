import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getCoverPath } from "../covers";
import { getGenCoverPath } from "../generativeCoverCache";
import { getEpubPath } from "../epubs";
import { serveSitemapIndex, serveStaticSitemap, serveBooksSitemap, serveAuthorsSitemap } from "../sitemap";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Cover image endpoint — serves pre-rendered covers.
  // Priority: (1) downloaded JPEG from Gutenberg, (2) generative WebP (rendered on first request, cached forever).
  // The generative cover is deterministic: same book always gets the same design.
  // Stable URL: /api/covers/:id — suitable for og:image and social sharing.
  app.get("/api/covers/:id", async (req, res) => {
    const id = parseInt(req.params.id ?? "", 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: "Invalid book ID" });
      return;
    }
    try {
      // 1. Try downloaded JPEG from Gutenberg (preferred: real cover art)
      const jpegPath = await getCoverPath(id);
      if (jpegPath) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Content-Type", "image/jpeg");
        res.sendFile(jpegPath);
        return;
      }

      // 2. Render generative WebP cover (cached to disk on first render)
      const webpPath = await getGenCoverPath(id);
      if (webpPath) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Content-Type", "image/webp");
        res.sendFile(webpPath);
        return;
      }

      // 3. Book not found
      res.status(404).json({ error: "Cover not available" });
    } catch (err) {
      console.error(`[covers] Error serving cover for ${id}:`, err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  // EPUB proxy — downloads on first request, serves from local disk thereafter.
  // Accepts both /api/epubs/22367 and /api/epubs/22367.epub
  // The .epub suffix is required by epub.js for correct file-type detection.
  app.get("/api/epubs/:id", async (req, res) => {
    const rawId = (req.params.id ?? "").replace(/\.epub$/i, "");
    const id = parseInt(rawId, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: "Invalid book ID" });
      return;
    }
    try {
      const epubUrl = req.query.url ? String(req.query.url) : undefined;
      const filePath = await getEpubPath(id, epubUrl);
      if (!filePath) {
        res.status(404).json({ error: "EPUB not available" });
        return;
      }
      // EPUBs are immutable for a given book ID
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Type", "application/epub+zip");
      res.sendFile(filePath);
    } catch (err) {
      console.error(`[epubs] Error serving EPUB for ${id}:`, err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Dynamic sitemaps — served under /api/sitemap/* to bypass infrastructure-level static sitemap
  app.get("/api/sitemap.xml", serveSitemapIndex);
  app.get("/api/sitemap-static.xml", serveStaticSitemap);
  app.get("/api/sitemap-books.xml", serveBooksSitemap);
  app.get("/api/sitemap-authors.xml", serveAuthorsSitemap);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
