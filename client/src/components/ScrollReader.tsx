/**
 * ScrollReader — continuous vertical scroll EPUB reader
 *
 * Uses epub.js directly with manager:"continuous" + flow:"scrolled".
 * Includes a persistent TOC sidebar: open by default, no auto-close on chapter
 * select, only closes when user clicks the close button.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import Epub from "epubjs";
import type { Rendition, NavItem } from "epubjs";
import { X, List } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScrollReaderProps {
  url: string;
  initialCfi?: string;
  initialScrollTop?: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: "serif" | "sans";
  themeColors: { bg: string; text: string };
  onProgress: (cfi: string, pct: number, scrollTop: number) => void;
  onRendition: (rendition: Rendition) => void;
  onLocated: (cfi: string) => void;
}

export default function ScrollReader({
  url,
  initialCfi,
  initialScrollTop,
  fontSize,
  lineHeight,
  fontFamily,
  themeColors,
  onProgress,
  onRendition,
  onLocated,
}: ScrollReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);

  // TOC state — open by default in scroll mode
  const [tocOpen, setTocOpen] = useState(true);
  const [tocItems, setTocItems] = useState<NavItem[]>([]);
  const [activeCfi, setActiveCfi] = useState<string>("");

  // Build CSS injected into the EPUB iframes
  const buildStyles = useCallback(() => {
    const ff =
      fontFamily === "serif"
        ? "'Merriweather', 'Georgia', serif"
        : "'Inter', 'system-ui', sans-serif";

    return {
      html: {
        background: themeColors.bg,
        margin: "0",
        padding: "0",
      },
      body: {
        background: themeColors.bg,
        color: themeColors.text,
        "font-family": ff,
        "font-size": `${fontSize}px !important`,
        "line-height": `${lineHeight} !important`,
        "max-width": "680px",
        margin: "0 auto !important",
        padding: "2rem 1.5rem 4rem",
        "box-sizing": "border-box",
      },
      p: {
        "font-size": `${fontSize}px !important`,
        "line-height": `${lineHeight} !important`,
        "margin-bottom": "1em",
        "text-align": "justify",
        hyphens: "auto",
      },
      h1: {
        "font-size": `${fontSize * 1.6}px !important`,
        "margin-bottom": "0.75em",
        "font-family": "'Lora', 'Georgia', serif",
      },
      h2: {
        "font-size": `${fontSize * 1.35}px !important`,
        "margin-bottom": "0.6em",
        "font-family": "'Lora', 'Georgia', serif",
      },
      h3: {
        "font-size": `${fontSize * 1.15}px !important`,
        "margin-bottom": "0.5em",
      },
      a: {
        color: themeColors.text === "#E8E0D4" ? "#C8A97E" : "#7B4F2E",
      },
    };
  }, [fontSize, lineHeight, fontFamily, themeColors]);

  // Re-apply styles when prefs change (without remounting)
  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.default(buildStyles());
    }
  }, [buildStyles]);

  // Fix epub-container: constrain height, enable scroll
  const fixContainerLayout = useCallback((node: HTMLDivElement) => {
    const epubContainer = node.querySelector('.epub-container') as HTMLElement | null;
    if (!epubContainer) return;

    epubContainer.style.height = '100%';
    epubContainer.style.overflowY = 'auto';
    epubContainer.style.overflowX = 'hidden';
    epubContainer.style.background = themeColors.bg;

    const views = epubContainer.querySelectorAll('.epub-view') as NodeListOf<HTMLElement>;
    views.forEach(view => {
      view.style.left = '';
      view.style.top = '';
      view.style.width = '100%';
    });
  }, [themeColors.bg]);

  // Navigate to a TOC item — does NOT close the TOC
  const handleTocClick = useCallback((href: string) => {
    if (renditionRef.current) {
      renditionRef.current.display(href);
    }
  }, []);

  // Mount once: create book + rendition
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const book = Epub(url);

    const rendition = book.renderTo(node, {
      manager: "continuous",
      flow: "scrolled",
      width: "100%",
    });

    renditionRef.current = rendition;
    onRendition(rendition);

    rendition.themes.default(buildStyles());

    // Load TOC once the book is ready
    book.ready.then(() => {
      book.locations.generate(1024).catch(() => {});
      book.loaded.navigation.then((nav) => {
        if (nav?.toc) {
          setTocItems(nav.toc);
        }
      }).catch(() => {});
    }).catch(() => {});

    rendition.display(initialCfi ?? undefined);

    rendition.on("relocated", (loc: { start: { cfi: string; percentage: number } }) => {
      const cfi = loc.start.cfi;
      setActiveCfi(cfi);
      onLocated(cfi);
    });

    rendition.on("rendered", () => {
      fixContainerLayout(node);

      const scrollEl = node.querySelector('.epub-container') as HTMLElement | null;
      if (!scrollEl) return;

      if (!restoredRef.current && initialScrollTop && initialScrollTop > 0) {
        restoredRef.current = true;
        setTimeout(() => {
          scrollEl.scrollTop = initialScrollTop;
        }, 400);
      }

      const onScroll = () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          const st = scrollEl.scrollTop;
          const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
          const pct = maxScroll > 0 ? Math.min(st / maxScroll, 1) : 0;
          const cfi =
            (renditionRef.current?.currentLocation() as { start?: { cfi?: string } } | null)
              ?.start?.cfi ?? "";
          onProgress(cfi, pct, st);
        }, 2000);
      };

      scrollEl.removeEventListener("scroll", onScroll);
      scrollEl.addEventListener("scroll", onScroll, { passive: true });
    });

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      try { book.destroy(); } catch { /* ignore */ }
      renditionRef.current = null;
      restoredRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const isDark = themeColors.text === "#E8E0D4";
  const tocBg = isDark ? "#1C1A18" : themeColors.bg === "#F4ECD8" ? "#EDE3CC" : "#F0EDE8";
  const tocBorder = isDark ? "#333" : "#D8D0C4";
  const tocText = themeColors.text;
  const tocMuted = isDark ? "#9A9080" : "#7A6E60";
  const tocActive = isDark ? "#C8A97E" : "#7B4F2E";
  const tocHover = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";

  return (
    <div className="flex flex-1 min-h-0 w-full overflow-hidden" style={{ background: themeColors.bg }}>
      {/* TOC Sidebar */}
      {tocOpen && (
        <div
          className="flex flex-col shrink-0 overflow-hidden border-r"
          style={{
            width: "260px",
            background: tocBg,
            borderColor: tocBorder,
          }}
        >
          {/* TOC header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ borderColor: tocBorder }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: tocMuted }}>
              Inhalt
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              style={{ color: tocMuted }}
              onClick={() => setTocOpen(false)}
              aria-label="Inhaltsverzeichnis schließen"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* TOC items */}
          <div className="flex-1 overflow-y-auto py-2">
            {tocItems.length === 0 ? (
              <p className="px-4 py-3 text-xs" style={{ color: tocMuted }}>
                Wird geladen…
              </p>
            ) : (
              tocItems.map((item, i) => {
                const isActive = activeCfi && item.href
                  ? activeCfi.includes(item.href.split('#')[0].replace(/\.x?html?.*$/, ''))
                  : false;
                return (
                  <button
                    key={i}
                    onClick={() => handleTocClick(item.href)}
                    className="w-full text-left px-4 py-2 text-sm transition-colors"
                    style={{
                      color: isActive ? tocActive : tocText,
                      background: isActive ? (isDark ? "rgba(200,169,126,0.12)" : "rgba(123,79,46,0.08)") : "transparent",
                      fontWeight: isActive ? 600 : 400,
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = tocHover; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {item.label?.trim() || `Kapitel ${i + 1}`}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TOC toggle button (when closed) */}
      {!tocOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-14 z-10 h-8 w-8 shadow-sm border"
          style={{
            background: tocBg,
            borderColor: tocBorder,
            color: tocMuted,
          }}
          onClick={() => setTocOpen(true)}
          aria-label="Inhaltsverzeichnis öffnen"
        >
          <List className="w-4 h-4" />
        </Button>
      )}

      {/* EPUB content */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 min-w-0 overflow-hidden"
        style={{ background: themeColors.bg }}
      />
    </div>
  );
}
