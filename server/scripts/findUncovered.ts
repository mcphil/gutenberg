import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

async function main() {
  const url = process.env.DATABASE_URL || '';
  const conn = await mysql.createConnection(url);
  const [rows] = await conn.execute('SELECT gutenbergId, title FROM books WHERE type="Text" LIMIT 200') as any;
  const coversDir = path.resolve(process.cwd(), 'data', 'covers');
  const covered = new Set(fs.readdirSync(coversDir).map((f: string) => f.replace('.jpg', '')));
  for (const row of rows as any[]) {
    if (!covered.has(String(row.gutenbergId))) {
      console.log('No JPEG for:', row.gutenbergId, row.title);
      break;
    }
  }
  await conn.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
