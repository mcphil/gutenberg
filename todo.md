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
