# Gutenberg Leser — TODO

## Core Features
- [x] Buchkatalog: 2.420 deutschsprachige Bücher von Gutendex API
- [x] Raster- und Listenansicht
- [x] Suche nach Titel/Autor (Echtzeit)
- [x] Filter nach Themen (Chips), Sortierung
- [x] Sortieroption "Zufällig" (ORDER BY RAND()) als Standard
- [x] Buchdetailseite mit Metadaten
- [x] Browse-Modus (TikTok-Stil): Wischen, Mausrad, Pfeiltasten
- [x] EPUB-Reader mit react-reader/epub.js
- [x] Reader: Schriftgröße, Zeilenabstand, Textbreite, 3 Themes
- [x] Reader: Blätter-Modus (paginiert) und Scroll-Modus (kontinuierlich)
- [x] Lokaler Speicher: Lesefortschritt (CFI), Lesezeichen, Einstellungen
- [x] Dark Mode
- [x] Responsives Design (Desktop, Tablet, Mobile)

## Datenquellen & Backend
- [x] PRINZIP: Wir respektieren alle Vorgaben von Project Gutenberg — kein Scraping, kein Hotlinking, kein Live-Crawling
- [x] pg_catalog.csv als Datenquelle (2.420 deutsche Bücher importiert)
- [x] Neue DB-Tabelle `books` mit allen Metadaten
- [x] Import-Script scripts/import-catalog.mjs (Batch-UPSERT, < 10 Sekunden)
- [x] rsync-basierter EPUB-Download: scripts/sync-epubs.sh (aleph.gutenberg.org::gutenberg-epub)
- [x] tRPC books.list und books.byId auf lokale DB umgestellt (kein Gutendex mehr)
- [x] Gutendex-Abhängigkeit komplett entfernt
- [x] Cover on-demand über /api/covers/:id (SVG-Fallback für Bücher ohne Bild)
- [x] EPUB-Caching: server/epubs.ts — on-demand herunterladen, lokal in data/epubs/ speichern
- [x] Express-Endpunkt GET /api/epubs/:id — lädt EPUB on-demand, cached auf Disk, liefert selbst aus

## KI-Zusammenfassungen
- [x] KI-Zusammenfassung kurz (für Karten) und lang (für Detailseite)
- [x] KI-Zusammenfassungen neutral, sachlich, auf Deutsch
- [x] DB-Caching der KI-Zusammenfassungen
- [x] Batch-Script server/scripts/generate-summaries.ts — generiert alle fehlenden Zusammenfassungen mit Delay
- [x] summaries.generate Mutation aus Router entfernt (nur noch getCached)
- [x] Zusammenfassungen werden nur noch angezeigt wenn vorhanden, kein Trigger mehr für User
- [x] Alle 2.418 Bücher haben KI-Zusammenfassungen

## Buchkarten & Katalog
- [x] Hover-Overlay auf Buchkarten: Zusammenfassungstext beim Hovern, deckt Coverfläche ab
- [x] 150ms Debounce auf Hover-State gegen Flackern beim schnellen Scrollen
- [x] Grid: 5 Spalten auf Desktop, Tags im Hover-Overlay, kein Vorschautext im Footer
- [x] BookDetail: Sektion 'Ähnliche Bücher' mit 4 thematisch verwandten Büchern (basierend auf Subjects)
- [x] BookDetail: Kategorien/Subjects als klickbare Links zum exakten Subject-Filter (?subject=)
- [x] Exakter Subject-Filter: Banner mit X zum Entfernen, Backend-Filter via LIKE
- [x] Autoren-Seite /author/:name mit gefilterter Buchübersicht (5-Spalten-Grid, Lebensdaten im Header)
- [x] Autorennamen in BookDetail und BookCard klickbar (navigiert zu /author/:name)

## Reader
- [x] Scroll-Modus (flow: scrolled-doc, 100ch Spaltenbreite, zentriert, hellerer Spaltenhintergrund)
- [x] Scroll-Position (scrollTop) alle 2s gespeichert, beim Öffnen wiederhergestellt
- [x] Blätter-Modus als Standard, Scroll-Modus per Toggle in Toolbar

## DSGVO & Rechtliches
- [x] Impressum-Seite (/impressum) mit allen Pflichtangaben gem. § 5 TMG
- [x] Datenschutzerklärung-Seite (/datenschutz) mit Cookie-Tabelle, localStorage-Tabelle, Betroffenenrechten
- [x] Cookie-Consent-Banner (nur technisch notwendige Cookies)
- [x] SiteFooter mit Links zu Impressum, Datenschutz, Project Gutenberg
- [x] Google Fonts durch @fontsource npm-Pakete ersetzt — keine externen Font-Requests mehr

## Bug Fixes
- [x] Bug: Hero-Einleitung verschwindet wenn "Weiterlesen"-Sektion sichtbar ist — Bedingung entfernt, beide Sektionen immer sichtbar
- [x] Weiterlesen-Einträge einzeln löschbar (X-Button erscheint beim Hover, entfernt Eintrag aus localStorage)
- [x] Englische Gutenberg-Fallback-Zusammenfassungen entfernt
- [x] Buchcover nie anschneiden — object-contain überall
- [x] Typografisches SVG-Fallback-Cover für Bücher ohne Bild (8 Farbpaletten, Titel + Autor)
- [x] Bug: EPUB-Reader zeigt "Error loading book" — URL-Extension .epub für epub.js
- [x] Bug: Lesestatus zeigt immer 0% — epub.js benötigt book.locations.generate() nach book.ready
- [x] Bug: Erscheinungsjahr zeigt immer 2026 — issued ist Gutenberg-Upload-Datum, nicht Erscheinungsjahr; entfernt
- [x] Bug: Scroll-Modus instabil — location-Feedback-Loop entfernt, manager:continuous entfernt
- [x] Bug: Autoren-Seite — Klick auf Buchkarte navigiert nicht zur Buchdetailseite (onClick-Handler fehlte)

## Urheberrecht (§ 64 UrhG)
- [x] Automatische Prüfung: Todesjahr des Autors + 70 Jahre — Leselink ausblenden wenn noch geschützt
- [x] BookDetail: Nur Gutenberg.org-Link wenn urheberrechtlich geschützt, Hinweistext anzeigen
- [x] BookCard: Kein "Lesen"-Button wenn urheberrechtlich geschützt (Schloss-Icon + Hinweis im Hover-Overlay)
- [x] Reader: Direkte URL-Navigation blockieren wenn urheberrechtlich geschützt (Redirect zur Buchdetailseite)

## Browse-Modus Verbesserungen
- [x] Cover kleiner, Inhalt immer vertikal zentriert (nicht am oberen Rand klebend)
- [x] Responsives Layout: Portrait = Cover oben / Text unten; Landscape/Breit = Cover links / Text rechts
- [x] Rubberband-Effekt beim Wischen (leichte Überdehnung mit Rückfeder-Animation)

## Urheberrecht — Erweiterung (§ 64 UrhG)
- [x] Neues DB-Feld `copyrightProtectedUntil` (INT, NULL=Heuristik, 0=Gemeinfrei, YYYY=geschützt bis)
- [x] Drizzle-Migration generiert und angewendet
- [x] Antike Autoren (Aristoteles, Homer, Platon, Cicero etc.) auf 0 (gemeinfrei) gesetzt
- [x] Autoren mit offenem Geburtsjahr vor 1880 (kein Todesjahr) auf 0 gesetzt via Node.js-Skript
- [x] isCopyrightProtectedDE() nutzt das neue Feld als expliziten Override (Priorität 1)
- [x] Verbesserte Heuristik: Geburtsjahr < 1880 ohne Todesjahr → gemeinfrei; bekannte antike Namen → gemeinfrei
- [x] BookCard, BookDetail, BrowseMode, Reader: copyrightProtectedUntil wird übergeben
