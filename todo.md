# Gutenberg Leser — TODO

## Core Features
- [x] Buchkatalog: 2.420 deutschsprachige Bücher von Gutendex API
- [x] Raster- und Listenansicht
- [x] Suche nach Titel/Autor (Echtzeit)
- [x] Filter nach Themen (Chips), Sortierung
- [x] Buchdetailseite mit Metadaten
- [x] KI-Zusammenfassung kurz (für Karten) und lang (für Detailseite)
- [x] KI-Zusammenfassungen neutral, sachlich, auf Deutsch
- [x] DB-Caching der KI-Zusammenfassungen
- [x] Browse-Modus (TikTok-Stil): Wischen, Mausrad, Pfeiltasten
- [x] EPUB-Reader mit react-reader/epub.js
- [x] Reader: Schriftgröße, Zeilenabstand, Textbreite, 3 Themes
- [x] Lokaler Speicher: Lesefortschritt (CFI), Lesezeichen, Einstellungen
- [x] Dark Mode
- [x] Responsives Design (Desktop, Tablet, Mobile)

## Bug Fixes
- [x] Englische Gutenberg-Fallback-Zusammenfassungen entfernt
- [x] translateSubject() für alle subject-Badges
- [x] FILTER_TOPICS aus shared/gutenberg.ts
- [x] Buchcover nie anschneiden — object-contain überall
- [x] Cover-Bilder serverseitig herunterladen und lokal cachen (nie von gutenberg.org hotlinken)
- [x] Express-Endpunkt GET /api/covers/:id — lädt on-demand, cached auf Disk, liefert selbst aus
- [x] DB-Spalte coverCached in book_summaries (boolean)
- [x] Frontend nutzt nur noch /api/covers/:id statt gutenberg.org URLs
- [x] Polite delay-Parameter in downloadCover() für Batch-Downloads
- [x] prefetchCovers() mit konfigurierbarem Delay (Standard 1500ms)
- [x] Typografisches SVG-Fallback-Cover für Bücher ohne Bild (serverseitig generiert, Titel + Autor, charakteristische Farbe aus Buchtitel-Hash)
- [x] /api/covers/:id liefert SVG-Fallback wenn kein echtes Cover vorhanden
- [x] Elegantes Layout: Verlagsname-Stil, Ornament-Linie, Titel zentriert, Autor unten
- [x] 8 Farbpaletten (Mitternachtsblau, Altes Leder, Dunkelgrün, Tabak, Indigo, Pflaume, Schieferblau, Olivgrau)
- [x] getCoverUrl() übergibt Titel+Autor als Query-Parameter für SVG-Generierung
- [x] EPUB-Caching: server/epubs.ts — on-demand herunterladen, lokal in data/epubs/ speichern
- [x] Express-Endpunkt GET /api/epubs/:id — lädt EPUB on-demand, cached auf Disk, liefert selbst aus
- [x] DB-Spalte epubCached in book_summaries (boolean)
- [x] Frontend Reader.tsx nutzt /api/epubs/:id statt direkter Gutenberg-URL
- [x] Polite delay für Batch-Downloads (Standard 2000ms), User-Agent Header
- [x] Magic-Byte-Validierung (PK-Header) und Mindestgröße-Check
- [x] getEpubProxyUrl() in shared/gutenberg.ts
- [x] 10 Tests für EPUB-Cache-Service (39 Tests gesamt, alle grün)
- [x] Bug: EPUB-Reader zeigt "Error loading book" — Ursache: epub.js erkennt Dateityp anhand URL-Extension; /api/epubs/:id.epub behebt das Problem

## Gutenberg-konforme Datenquellen (Umbau)
- [x] PRINZIP: Wir respektieren alle Vorgaben von Project Gutenberg — kein Scraping, kein Hotlinking, kein Live-Crawling
- [x] pg_catalog.csv als Datenquelle (2.420 deutsche Bücher importiert)
- [x] Neue DB-Tabelle `books` mit allen Metadaten
- [x] Import-Script scripts/import-catalog.mjs (Batch-UPSERT, < 10 Sekunden)
- [x] rsync-basierter EPUB-Download: scripts/sync-epubs.sh (aleph.gutenberg.org::gutenberg-epub)
- [x] tRPC books.list und books.byId auf lokale DB umgestellt (kein Gutendex mehr)
- [x] Gutendex-Abhängigkeit komplett entfernt
- [x] Cover on-demand über /api/covers/:id (SVG-Fallback für Bücher ohne Bild)
- [x] EPUB-Reader Bug "Error loading book" behoben (URL-Extension .epub für epub.js)

## UI-Verbesserungen
- [x] Autoren-Anzeige: "Nachname, Vorname [Rolle]" → "Vorname Nachname [Rolle]" — parseAuthors() extrahiert [Rolle] vor dem Umdrehen, hängt sie danach wieder an
- [x] Umbenennung: "Gutenberg Leser" → "Gutenberg Navigator" überall (Header, Hero, HTML-Titel, Meta-Description, Fallback-Cover-SVG, Code-Kommentare); Subline mit dynamischer Buchanzahl aus DB
- [x] Favicon: aufgeschlagenes Buch-Icon im App-Stil, als SVG + ICO + Apple-Touch-Icon (180px), über CDN eingebunden
- [x] Bug: Lesestatus zeigt immer 0% — Ursache: epub.js benötigt book.locations.generate() damit start.percentage berechnet wird; wird jetzt nach book.ready aufgerufen
