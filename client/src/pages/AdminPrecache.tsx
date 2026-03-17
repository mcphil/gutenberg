import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Link } from "wouter";
import { ArrowLeft, Play, Square, RefreshCw, Terminal, BookOpen } from "lucide-react";

type JobState = "idle" | "running" | "done" | "error";

export default function AdminPrecache() {
  const [token, setToken] = useState(() => localStorage.getItem("adminPrecacheToken") ?? "");
  const [batchSize, setBatchSize] = useState("200");
  const [pause, setPause] = useState("5");
  const [limit, setLimit] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [jobState, setJobState] = useState<JobState>("idle");
  const [logs, setLogs] = useState<{ type: string; text: string }[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const appendLog = useCallback((type: string, text: string) => {
    setLogs(prev => [...prev, { type, text }]);
    setTimeout(scrollToBottom, 50);
  }, [scrollToBottom]);

  const startJob = useCallback(() => {
    if (!token.trim()) {
      alert("Bitte Token eingeben.");
      return;
    }
    localStorage.setItem("adminPrecacheToken", token.trim());

    setLogs([]);
    setJobState("running");

    const params = new URLSearchParams({ token: token.trim() });
    if (batchSize) params.set("batch-size", batchSize);
    if (pause) params.set("pause", pause);
    if (limit) params.set("limit", limit);
    if (dryRun) params.set("dry-run", "1");

    const url = `/api/admin/precache-epubs?${params.toString()}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("start", (e) => appendLog("start", JSON.parse(e.data)));
    es.addEventListener("log", (e) => appendLog("log", JSON.parse(e.data)));
    es.addEventListener("error", (e) => appendLog("error", JSON.parse((e as MessageEvent).data)));
    es.addEventListener("info", (e) => appendLog("info", JSON.parse(e.data)));
    es.addEventListener("done", (e) => {
      appendLog("done", JSON.parse(e.data));
      setJobState("done");
    });
    es.addEventListener("close", () => {
      es.close();
      esRef.current = null;
      setJobState(prev => prev === "running" ? "done" : prev);
    });

    es.onerror = () => {
      appendLog("error", "SSE-Verbindung unterbrochen.");
      setJobState("error");
      es.close();
      esRef.current = null;
    };
  }, [token, batchSize, pause, limit, dryRun, appendLog]);

  const stopMonitoring = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    appendLog("info", "Monitoring gestoppt. Job läuft ggf. weiter im Hintergrund.");
    setJobState("idle");
  }, [appendLog]);

  const clearLogs = useCallback(() => setLogs([]), []);

  const logColor = (type: string) => {
    switch (type) {
      case "error": return "text-red-400";
      case "done": return "text-green-400 font-semibold";
      case "start": return "text-blue-400";
      case "info": return "text-yellow-400";
      default: return "text-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-semibold">EPUB Pre-Cache Admin</h1>
          </div>
          <Badge variant={jobState === "running" ? "default" : jobState === "done" ? "secondary" : "outline"}>
            {jobState === "idle" ? "Bereit" : jobState === "running" ? "Läuft…" : jobState === "done" ? "Fertig" : "Fehler"}
          </Badge>
        </div>

        {/* Config Card */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-base">Konfiguration</CardTitle>
            <CardDescription className="text-gray-400">
              Lädt alle deutschen EPUBs via rsync von <code className="text-amber-400">aleph.gutenberg.org::gutenberg-epub</code>.
              Gemäß den offiziellen Mirroring-Richtlinien von Project Gutenberg.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="token" className="text-gray-300">Admin-Token *</Label>
                <Input
                  id="token"
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="ADMIN_PRECACHE_TOKEN"
                  className="bg-gray-800 border-gray-700 text-white"
                  disabled={jobState === "running"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batchSize" className="text-gray-300">Batch-Größe</Label>
                <Input
                  id="batchSize"
                  type="number"
                  value={batchSize}
                  onChange={e => setBatchSize(e.target.value)}
                  placeholder="200"
                  className="bg-gray-800 border-gray-700 text-white"
                  disabled={jobState === "running"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pause" className="text-gray-300">Pause zwischen Batches (Sek.)</Label>
                <Input
                  id="pause"
                  type="number"
                  value={pause}
                  onChange={e => setPause(e.target.value)}
                  placeholder="5"
                  className="bg-gray-800 border-gray-700 text-white"
                  disabled={jobState === "running"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="limit" className="text-gray-300">Limit (0 = alle)</Label>
                <Input
                  id="limit"
                  type="number"
                  value={limit}
                  onChange={e => setLimit(e.target.value)}
                  placeholder="0"
                  className="bg-gray-800 border-gray-700 text-white"
                  disabled={jobState === "running"}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Switch
                id="dryRun"
                checked={dryRun}
                onCheckedChange={setDryRun}
                disabled={jobState === "running"}
              />
              <Label htmlFor="dryRun" className="text-gray-300 cursor-pointer">
                Dry-Run (kein Download, nur Vorschau)
              </Label>
            </div>
            <div className="flex gap-3 pt-2">
              {jobState !== "running" ? (
                <Button
                  onClick={startJob}
                  className="bg-amber-600 hover:bg-amber-500 text-white"
                  disabled={!token.trim()}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {dryRun ? "Dry-Run starten" : "Pre-Cache starten"}
                </Button>
              ) : (
                <Button
                  onClick={stopMonitoring}
                  variant="outline"
                  className="border-red-700 text-red-400 hover:bg-red-950"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Monitoring stoppen
                </Button>
              )}
              {logs.length > 0 && (
                <Button
                  onClick={clearLogs}
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-300"
                  disabled={jobState === "running"}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Logs leeren
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Log output */}
        {logs.length > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="w-4 h-4 text-gray-400" />
                Ausgabe
                <span className="text-xs font-normal text-gray-500 ml-auto">{logs.length} Zeilen</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-950 rounded-md p-4 font-mono text-xs leading-relaxed max-h-[60vh] overflow-y-auto">
                {logs.map((entry, i) => (
                  <div key={i} className={logColor(entry.type)}>
                    {entry.text}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info box */}
        <Card className="bg-gray-900 border-gray-800 text-sm text-gray-400">
          <CardContent className="pt-4 space-y-2">
            <p><strong className="text-gray-300">Direkte URL-Nutzung:</strong> Der Endpunkt kann auch ohne Browser aufgerufen werden:</p>
            <code className="block bg-gray-950 rounded p-2 text-xs text-amber-300 break-all">
              curl -N "https://gutenberg-navigator.de/api/admin/precache-epubs?token=DEIN_TOKEN"
            </code>
            <p>Der Job läuft im Hintergrund weiter, auch wenn die Browser-Verbindung getrennt wird.</p>
            <p><strong className="text-gray-300">Status prüfen:</strong></p>
            <code className="block bg-gray-950 rounded p-2 text-xs text-amber-300 break-all">
              curl "https://gutenberg-navigator.de/api/admin/precache-status?token=DEIN_TOKEN"
            </code>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
