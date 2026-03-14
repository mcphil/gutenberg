import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

async function main() {
  const url = process.env.DATABASE_URL || '';
  const conn = await mysql.createConnection(url);
  const [rows] = await conn.execute('SELECT gutenbergId, title FROM books WHERE type="Text" ORDER BY RAND() LIMIT 500') as any;
  const coversDir = path.resolve(process.cwd(), 'data', 'covers');
  const covered = new Set((fs.readdirSync(coversDir) as string[]).map((f: string) => f.replace('.jpg', '')));
  let found = 0;
  for (const row of rows as any[]) {
    const id = String(row.gutenbergId);
    if (!covered.has(id)) {
      console.log(id, (row.title as string).substring(0, 60));
      if (++found >= 3) break;
    }
  }
  await conn.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
