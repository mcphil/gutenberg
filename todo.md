# Gutenberg Leser — TODO

## Setup & Infrastructure
- [x] Project initialized with React 19 + Tailwind 4 + tRPC + DB
- [x] Install epub.js / react-reader and jszip dependencies
- [x] Design system: warm book-inspired palette, Lora/Inter/Merriweather fonts, dark mode
- [x] Global layout with sticky top navigation (AppHeader)

## Server / API
- [x] tRPC route: proxy Gutendex API for German books (paginated, search, filter, sort)
- [x] tRPC route: fetch single book metadata by ID
- [x] tRPC route: generate AI summary (short ~2 sentences, long ~5-6 sentences)
- [x] tRPC route: getCached — retrieve summaries without generating
- [x] Server-side caching of summaries in DB to avoid repeated LLM calls
- [x] Shared types: GutenbergBook, helpers (getCoverUrl, getEpubUrl, getAuthorDisplay)

## Database
- [x] `book_summaries` table: gutenberg_id, short_summary, long_summary, generated_at

## Book List / Catalog View
- [x] BookCard component: cover, title, author, short summary, download count, subject badges
- [x] Grid/list layout toggle
- [x] Pagination (32 books per page)
- [x] Loading skeletons for grid and list

## Search & Filter
- [x] Real-time search by title and author
- [x] Filter by subject/topic (chip bar)
- [x] Sort by: popularity, title A–Z, title Z–A
- [x] Filter state resets page on change

## Book Detail Page
- [x] Cover image, full metadata (author, download count, subjects, bookshelves)
- [x] Long AI summary (neutral, decision-focused) with on-demand generation
- [x] Fallback to Gutenberg's own summary
- [x] Subject and bookshelf tags
- [x] "Jetzt lesen" button → opens EPUB reader
- [x] Reading progress indicator (from localStorage)
- [x] Link to Gutenberg.org

## Browse / Swipe Mode
- [x] TikTok-style vertical swipe between books
- [x] Touch swipe support (touch events)
- [x] Mouse wheel navigation
- [x] Keyboard navigation (arrow keys, Escape)
- [x] Smooth CSS transitions between cards
- [x] Short summary visible in browse card (with on-demand generation)
- [x] "Lesen" and "Mehr Details" CTAs on browse card
- [x] Progress dots indicator
- [x] Pre-fetch next page when near end
- [x] Swipe hint overlay (auto-hides after 3s)

## EPUB Reader
- [x] Integrate react-reader (epub.js wrapper)
- [x] Readability layout: adjustable max-width (500–900px), font-size (12–26px), line-height (1.3–2.0)
- [x] Font size controls (+/- buttons + slider)
- [x] Line height slider
- [x] Dark / sepia / light theme for reader
- [x] Font family selector (serif Merriweather / sans-serif Inter)
- [x] Progress bar and percentage display
- [x] Save reading position to localStorage on every page turn
- [x] Restore position on re-open
- [x] Bookmark current position (toggle)
- [x] Fullscreen mode (desktop)

## Local Storage
- [x] Reading progress per book (CFI position + percentage + timestamp)
- [x] Bookmarks per book (CFI + label)
- [x] User preferences (font size, theme, line height, font family, max width)
- [x] Recently viewed books list (last 20)
- [x] App preferences (dark mode, default view)
- [x] "Continue reading" section on home page

## Responsive Design
- [x] Mobile-first layout
- [x] Touch-friendly controls (min 44px tap targets)
- [x] Tablet layout optimization
- [x] Desktop layout optimization
- [x] Mobile search toggle in header

## Tests
- [x] Vitest: books.list (5 tests: default, search, topic, sort, popular default)
- [x] Vitest: books.byId (1 test)
- [x] Vitest: summaries.generate — LLM call + DB cache (2 tests)
- [x] Vitest: books.subjects (1 test)
- [x] Vitest: auth.logout (1 test)

## Future Enhancements
- [ ] Offline reading (Service Worker + EPUB caching)
- [ ] Reading statistics dashboard
- [ ] Export bookmarks as JSON
- [ ] Share book link
