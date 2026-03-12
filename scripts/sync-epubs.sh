#!/usr/bin/env bash
# sync-epubs.sh
#
# Downloads EPUB files for all German-language books via rsync from Project Gutenberg.
# Uses the approved rsync method as described at:
#   https://www.gutenberg.org/help/mirroring.html
#
# We respect all Project Gutenberg terms of use:
#   - rsync is the recommended method for bulk downloads
#   - We only download files we need (EPUB + cover images, no audio/zip/mobi)
#   - We run this at most once per week (catalog is updated weekly)
#
# Usage:
#   bash scripts/sync-epubs.sh [book_ids_file]
#
# If a book_ids_file is provided (one Gutenberg ID per line), only those books
# are synced. Otherwise all German books are synced from the database.
#
# Requirements: rsync, mysql client (for reading book IDs from DB)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
EPUB_DIR="$ROOT/data/epubs"
COVER_DIR="$ROOT/data/covers"

# Gutenberg rsync endpoint for generated content (EPUB, MOBI, covers)
RSYNC_HOST="aleph.gutenberg.org::gutenberg-epub"

mkdir -p "$EPUB_DIR" "$COVER_DIR"

# ─── Get list of German book IDs ─────────────────────────────────────────────

if [[ "${1:-}" != "" && -f "$1" ]]; then
  echo "Using provided book IDs file: $1"
  mapfile -t BOOK_IDS < "$1"
else
  echo "Reading German book IDs from database..."
  # Load .env for DATABASE_URL
  if [[ -f "$ROOT/.env" ]]; then
    export $(grep -v '^#' "$ROOT/.env" | xargs)
  fi

  # Extract host, port, user, password, dbname from DATABASE_URL
  # Format: mysql://user:pass@host:port/dbname
  DB_URL="${DATABASE_URL:-}"
  if [[ -z "$DB_URL" ]]; then
    echo "ERROR: DATABASE_URL not set"
    exit 1
  fi

  # Use Node.js to query the DB (avoids mysql client dependency)
  mapfile -t BOOK_IDS < <(node -e "
    import('mysql2/promise').then(async ({default: mysql}) => {
      const db = await mysql.createConnection('$DB_URL');
      const [rows] = await db.execute('SELECT gutenbergId FROM books ORDER BY gutenbergId');
      rows.forEach(r => console.log(r.gutenbergId));
      await db.end();
    }).catch(e => { console.error(e); process.exit(1); });
  ")
fi

TOTAL=${#BOOK_IDS[@]}
echo "Syncing EPUBs and covers for $TOTAL books..."
echo "This may take a while. Only files not yet downloaded will be transferred."
echo ""

SYNCED=0
ERRORS=0

for ID in "${BOOK_IDS[@]}"; do
  ID="${ID// /}"  # trim whitespace
  [[ -z "$ID" ]] && continue

  # Only download EPUB and cover files — skip mobi, txt, zip, audio, logs
  rsync -a --timeout=30 \
    --include="pg${ID}.epub" \
    --include="pg${ID}-images.epub" \
    --include="pg${ID}-images-3.epub" \
    --include="pg${ID}.cover.medium.jpg" \
    --include="pg${ID}.cover.small.jpg" \
    --include="${ID}-cover.png" \
    --exclude="*" \
    "${RSYNC_HOST}/${ID}/" \
    "$EPUB_DIR/${ID}/" 2>/dev/null && SYNCED=$((SYNCED + 1)) || {
      echo "  Warning: rsync failed for book $ID"
      ERRORS=$((ERRORS + 1))
    }

  # Progress every 100 books
  if (( (SYNCED + ERRORS) % 100 == 0 )); then
    echo "  Progress: $((SYNCED + ERRORS))/$TOTAL (synced: $SYNCED, errors: $ERRORS)"
  fi
done

echo ""
echo "Sync complete. Synced: $SYNCED, Errors: $ERRORS"

# ─── Move covers to cover cache directory ────────────────────────────────────
echo "Moving cover images to cover cache..."
for ID in "${BOOK_IDS[@]}"; do
  ID="${ID// /}"
  [[ -z "$ID" ]] && continue

  # Prefer medium JPG, fall back to PNG cover
  for COVER_FILE in \
    "$EPUB_DIR/${ID}/pg${ID}.cover.medium.jpg" \
    "$EPUB_DIR/${ID}/${ID}-cover.png"; do
    if [[ -f "$COVER_FILE" ]]; then
      EXT="${COVER_FILE##*.}"
      cp "$COVER_FILE" "$COVER_DIR/${ID}.${EXT}" 2>/dev/null || true
      break
    fi
  done
done

echo "Done."
