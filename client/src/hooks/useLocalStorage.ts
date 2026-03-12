import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.warn(`[localStorage] Failed to set "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue] as const;
}

// ─── Reading Progress ─────────────────────────────────────────

export interface ReadingProgress {
  gutenbergId: number;
  cfi: string;       // EPUB CFI position
  percentage: number;
  lastReadAt: number; // timestamp
  title: string;
  coverUrl?: string;
}

export function useReadingProgress() {
  const [progress, setProgress] = useLocalStorage<Record<number, ReadingProgress>>(
    "gl_reading_progress",
    {}
  );

  const saveProgress = useCallback(
    (gutenbergId: number, cfi: string, percentage: number, title: string, coverUrl?: string) => {
      setProgress((prev) => ({
        ...prev,
        [gutenbergId]: { gutenbergId, cfi, percentage, lastReadAt: Date.now(), title, coverUrl },
      }));
    },
    [setProgress]
  );

  const getProgress = useCallback(
    (gutenbergId: number): ReadingProgress | undefined => progress[gutenbergId],
    [progress]
  );

  const getAllProgress = useCallback(
    () =>
      Object.values(progress).sort((a, b) => b.lastReadAt - a.lastReadAt),
    [progress]
  );

  return { saveProgress, getProgress, getAllProgress };
}

// ─── Bookmarks ────────────────────────────────────────────────

export interface Bookmark {
  id: string;
  gutenbergId: number;
  cfi: string;
  label: string;
  createdAt: number;
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useLocalStorage<Bookmark[]>("gl_bookmarks", []);

  const addBookmark = useCallback(
    (gutenbergId: number, cfi: string, label: string) => {
      const bookmark: Bookmark = {
        id: `${gutenbergId}-${Date.now()}`,
        gutenbergId,
        cfi,
        label,
        createdAt: Date.now(),
      };
      setBookmarks((prev) => [bookmark, ...prev]);
      return bookmark;
    },
    [setBookmarks]
  );

  const removeBookmark = useCallback(
    (id: string) => setBookmarks((prev) => prev.filter((b) => b.id !== id)),
    [setBookmarks]
  );

  const getBookmarksForBook = useCallback(
    (gutenbergId: number) => bookmarks.filter((b) => b.gutenbergId === gutenbergId),
    [bookmarks]
  );

  return { bookmarks, addBookmark, removeBookmark, getBookmarksForBook };
}

// ─── Reader Preferences ──────────────────────────────────────

export interface ReaderPreferences {
  fontSize: number;       // 14–24px
  lineHeight: number;     // 1.4–2.0
  fontFamily: "serif" | "sans";
  theme: "light" | "sepia" | "dark";
  maxWidth: number;       // 600–900px (only used in paginated mode)
  readingMode: "scroll" | "paginated"; // scroll = continuous Apple-Books-style, paginated = page-flip
}

const DEFAULT_PREFS: ReaderPreferences = {
  fontSize: 17,
  lineHeight: 1.65,
  fontFamily: "serif",
  theme: "light",
  maxWidth: 720,
  readingMode: "paginated",
};

export function useReaderPreferences() {
  const [prefs, setPrefs] = useLocalStorage<ReaderPreferences>("gl_reader_prefs", DEFAULT_PREFS);

  const updatePref = useCallback(
    <K extends keyof ReaderPreferences>(key: K, value: ReaderPreferences[K]) =>
      setPrefs((prev) => ({ ...prev, [key]: value })),
    [setPrefs]
  );

  return { prefs, updatePref };
}

// ─── Recently Viewed ─────────────────────────────────────────

export interface RecentBook {
  gutenbergId: number;
  title: string;
  authors: string;
  coverUrl?: string;
  viewedAt: number;
}

export function useRecentBooks() {
  const [recentBooks, setRecentBooks] = useLocalStorage<RecentBook[]>("gl_recent_books", []);

  const addRecentBook = useCallback(
    (book: Omit<RecentBook, "viewedAt">) => {
      setRecentBooks((prev) => {
        const filtered = prev.filter((b) => b.gutenbergId !== book.gutenbergId);
        // Always store our own cover endpoint URL, never a gutenberg.org URL
        const coverUrl = `/api/covers/${book.gutenbergId}`;
        return [{ ...book, coverUrl, viewedAt: Date.now() }, ...filtered].slice(0, 20);
      });
    },
    [setRecentBooks]
  );

  return { recentBooks, addRecentBook };
}

// ─── App Preferences ─────────────────────────────────────────

export interface AppPreferences {
  darkMode: boolean;
  defaultView: "grid" | "list";
  lastBrowseIndex: number;
}

const DEFAULT_APP_PREFS: AppPreferences = {
  darkMode: false,
  defaultView: "grid",
  lastBrowseIndex: 0,
};

export function useAppPreferences() {
  const [appPrefs, setAppPrefs] = useLocalStorage<AppPreferences>("gl_app_prefs", DEFAULT_APP_PREFS);

  const updateAppPref = useCallback(
    <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) =>
      setAppPrefs((prev) => ({ ...prev, [key]: value })),
    [setAppPrefs]
  );

  return { appPrefs, updateAppPref };
}
