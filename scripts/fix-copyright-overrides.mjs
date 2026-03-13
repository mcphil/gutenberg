/**
 * fix-copyright-overrides.mjs
 *
 * Sets copyrightProtectedUntil = 0 (public domain) for books whose primary
 * author has an open-ended birth year (format "Name, YYYY-") and was born
 * before 1880 — meaning they almost certainly died before 1956 (70+ years ago).
 *
 * Also handles books with no dates at all but where the author string contains
 * no year digits (completely undated) — these remain NULL (use heuristic).
 *
 * Run: node scripts/fix-copyright-overrides.mjs
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Fetch all books that still have no override and have authors
const [books] = await conn.execute(
  'SELECT gutenbergId, authors FROM books WHERE copyrightProtectedUntil IS NULL AND authors IS NOT NULL'
);

console.log(`Processing ${books.length} books without copyright override...`);

let publicDomainCount = 0;
const publicDomainIds = [];

for (const book of books) {
  const authors = book.authors;

  // Split by semicolon to get individual author entries
  const authorEntries = authors.split(';').map(s => s.trim());

  // Only look at primary authors (skip translators, editors, etc.)
  const primaryEntries = authorEntries.filter(
    e => !e.match(/\[(Translator|Editor|Contributor|Illustrator|Compiler|Annotator|Commentator|Adapter|Arranger|Foreword|Introduction|Preface)\]/i)
  );

  if (primaryEntries.length === 0) continue;

  let allPublicDomain = true;

  for (const entry of primaryEntries) {
    // Try to parse "Lastname, Firstname, YYYY-" (open-ended, no death year)
    const openEndedMatch = entry.match(/,\s*(\d{3,4})-\s*(?:\[|$)/);
    if (openEndedMatch) {
      const birthYear = parseInt(openEndedMatch[1], 10);
      // Born before 1880: almost certainly died before 1956 → public domain
      if (birthYear >= 1880) {
        allPublicDomain = false;
        break;
      }
      // Born before 1880: continue checking other authors
      continue;
    }

    // Try to parse "Lastname, Firstname, YYYY-YYYY" (has death year — handled by heuristic)
    const fullMatch = entry.match(/,\s*(\d{3,4})-(\d{3,4})\s*(?:\[|$)/);
    if (fullMatch) {
      // Has death year — the existing heuristic handles this correctly, skip
      allPublicDomain = false;
      break;
    }

    // No year at all — check if it's a known ancient name
    const hasAnyYear = /\d{3,4}/.test(entry);
    if (!hasAnyYear) {
      const ancientNames = [
        'aristotel', 'homer', 'plato', 'platon', 'sokrates', 'cicero',
        'virgil', 'vergil', 'ovid', 'horaz', 'tacitus', 'caesar',
        'sophokles', 'euripides', 'aischylos', 'herodot', 'thukydides',
        'seneca', 'marcus aurelius', 'epiktet', 'plutarch', 'livius',
        'anonymous', 'anonym', 'unbekannt', 'various',
      ];
      const isAncient = ancientNames.some(n => entry.toLowerCase().includes(n));
      if (!isAncient) {
        // Unknown undated modern author — keep as NULL (heuristic will treat as protected)
        allPublicDomain = false;
        break;
      }
      // Ancient author — public domain
      continue;
    }

    // Has year digits but couldn't parse → conservative
    allPublicDomain = false;
    break;
  }

  if (allPublicDomain) {
    publicDomainIds.push(book.gutenbergId);
    publicDomainCount++;
  }
}

console.log(`Found ${publicDomainCount} books to mark as public domain (open-ended birth year < 1880)`);

// Update in batches
if (publicDomainIds.length > 0) {
  const batchSize = 500;
  for (let i = 0; i < publicDomainIds.length; i += batchSize) {
    const batch = publicDomainIds.slice(i, i + batchSize);
    const placeholders = batch.map(() => '?').join(',');
    await conn.execute(
      `UPDATE books SET copyrightProtectedUntil = 0 WHERE gutenbergId IN (${placeholders})`,
      batch
    );
    console.log(`  Updated batch ${Math.floor(i/batchSize)+1}: ${batch.length} books`);
  }
}

// Summary
const [summary] = await conn.execute(
  'SELECT copyrightProtectedUntil, COUNT(*) as cnt FROM books GROUP BY copyrightProtectedUntil ORDER BY copyrightProtectedUntil'
);
console.log('\nSummary:');
for (const row of summary) {
  const label = row.copyrightProtectedUntil === null ? 'NULL (use heuristic)'
    : row.copyrightProtectedUntil === 0 ? '0 (public domain)'
    : `${row.copyrightProtectedUntil} (protected until)`;
  console.log(`  ${label}: ${row.cnt} books`);
}

await conn.end();
console.log('\nDone.');
