/**
 * adminPrecache.ts
 *
 * Token-protected admin endpoint that triggers the rsync EPUB pre-cache script
 * and streams progress logs back to the caller via Server-Sent Events (SSE).
 *
 * Usage:
 *   GET /api/admin/precache-epubs?token=<ADMIN_PRECACHE_TOKEN>
 *   GET /api/admin/precache-epubs?token=<ADMIN_PRECACHE_TOKEN>&batch-size=100&pause=3
 *
 * The endpoint streams log lines as SSE events so you can watch progress in
 * a browser or with curl:
 *   curl -N "https://your-domain.com/api/admin/precache-epubs?token=..."
 *
 * Only one job can run at a time. A second request while a job is running
 * will return 409 Conflict.
 */

import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, "..", "scripts", "precache-epubs.mjs");

// Track running job state
let jobRunning = false;
let jobStartedAt: Date | null = null;
let lastLogLines: string[] = [];

export function registerAdminPrecacheRoute(app: Router) {
  // ── Status endpoint (GET /api/admin/precache-status) ──────────────────────
  app.get("/api/admin/precache-status", (req: Request, res: Response) => {
    const token = (req.query.token as string) ?? req.headers["x-admin-token"] as string;
    if (!token || token !== process.env.ADMIN_PRECACHE_TOKEN) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({
      running: jobRunning,
      startedAt: jobStartedAt?.toISOString() ?? null,
      lastLines: lastLogLines.slice(-20),
    });
  });

  // ── Trigger endpoint (GET /api/admin/precache-epubs) ──────────────────────
  app.get("/api/admin/precache-epubs", (req: Request, res: Response) => {
    const token = (req.query.token as string) ?? req.headers["x-admin-token"] as string;
    if (!token || token !== process.env.ADMIN_PRECACHE_TOKEN) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (jobRunning) {
      res.status(409).json({
        error: "A pre-cache job is already running",
        startedAt: jobStartedAt?.toISOString(),
      });
      return;
    }

    // Build script args from query params
    const batchSize = parseInt((req.query["batch-size"] as string) ?? "200");
    const pause = parseInt((req.query["pause"] as string) ?? "5");
    const limit = parseInt((req.query["limit"] as string) ?? "0");
    const dryRun = req.query["dry-run"] === "1" || req.query["dry-run"] === "true";

    const scriptArgs = [SCRIPT_PATH];
    if (!isNaN(batchSize) && batchSize > 0) scriptArgs.push(`--batch-size=${batchSize}`);
    if (!isNaN(pause) && pause > 0) scriptArgs.push(`--pause=${pause}`);
    if (!isNaN(limit) && limit > 0) scriptArgs.push(`--limit=${limit}`);
    if (dryRun) scriptArgs.push("--dry-run");

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
    res.flushHeaders();

    const sendEvent = (type: string, data: string) => {
      const lines = data.split("\n").filter(l => l.trim());
      for (const line of lines) {
        res.write(`event: ${type}\ndata: ${JSON.stringify(line)}\n\n`);
        // Keep last 200 lines in memory for status endpoint
        lastLogLines.push(line);
        if (lastLogLines.length > 200) lastLogLines.shift();
      }
    };

    sendEvent("start", `Starting pre-cache job at ${new Date().toISOString()}`);
    sendEvent("start", `Script: ${SCRIPT_PATH}`);
    sendEvent("start", `Args: ${scriptArgs.slice(1).join(" ") || "(none)"}`);
    sendEvent("start", "---");

    jobRunning = true;
    jobStartedAt = new Date();
    lastLogLines = [];

    const proc = spawn("node", scriptArgs, {
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (data: Buffer) => {
      sendEvent("log", data.toString());
    });

    proc.stderr.on("data", (data: Buffer) => {
      sendEvent("error", data.toString());
    });

    proc.on("close", (code: number | null) => {
      jobRunning = false;
      const msg = `Job finished with exit code ${code ?? "unknown"} at ${new Date().toISOString()}`;
      sendEvent("done", msg);
      res.write("event: close\ndata: {}\n\n");
      res.end();
    });

    proc.on("error", (err: Error) => {
      jobRunning = false;
      sendEvent("error", `Failed to start script: ${err.message}`);
      res.write("event: close\ndata: {}\n\n");
      res.end();
    });

    // Clean up if client disconnects
    req.on("close", () => {
      if (jobRunning) {
        sendEvent("info", "Client disconnected — job continues in background");
        // Don't kill the job — let it finish
      }
    });
  });
}
