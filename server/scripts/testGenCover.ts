/**
 * Quick test: generate a cover SVG and convert to WebP via sharp.
 * Run with: npx tsx server/scripts/testGenCover.ts
 */
import { generateGenerativeCoverSvg } from '../generativeCoverSvg';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function main() {
  const svg = generateGenerativeCoverSvg(
    'Die Leiden des jungen Werthers',
    'Johann Wolfgang von Goethe',
    'Roman Liebe Gesellschaft Verzweiflung Natur Freundschaft Briefe Werther Lotte'
  );
  console.log('SVG OK, length:', svg.length);
  const buf = await sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
  const outPath = path.resolve(process.cwd(), 'data', 'test_cover.webp');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  console.log('WebP OK, size:', buf.length, 'bytes, saved to:', outPath);
}
main().catch(e => { console.error(e); process.exit(1); });
