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
import { generateFallbackCoverSvg } from "../fallbackCover";

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

  // Cover image proxy — downloads on first request, serves from local disk thereafter.
  // Falls back to a generated typographic SVG cover if no image is available.
  // Query params: ?title=...&author=... (used only for SVG fallback generation)
  app.get("/api/covers/:id", async (req, res) => {
    const id = parseInt(req.params.id ?? "", 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: "Invalid book ID" });
      return;
    }
    try {
      const filePath = await getCoverPath(id);
      if (filePath) {
        // Serve the cached JPEG
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Content-Type", "image/jpeg");
        res.sendFile(filePath);
        return;
      }

      // No image found — generate a typographic SVG fallback
      const title = String(req.query.title ?? `Buch ${id}`);
      const author = String(req.query.author ?? "Unbekannter Autor");
      const svg = generateFallbackCoverSvg(title, author);

      // SVG fallbacks are deterministic, so we can cache them aggressively too
      res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day (shorter: title could be updated)
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.send(svg);
    } catch (err) {
      console.error(`[covers] Error serving cover for ${id}:`, err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
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
