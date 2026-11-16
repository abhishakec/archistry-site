#!/usr/bin/env node
// Makes the small copies of the diagram previews that the site serves to phones and tablets (srcset).
//   node scripts/small-images.mjs --skill <path to the archistry skill repo>
// Reads docs/previews/*.png (1600px) and docs/how-it-works.png from the skill repo, writes img/sm/*.png here.
// Uses the skill's own headless Chrome / Edge renderer. Run it again when the skill's previews change.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--skill');
const skill = path.resolve([i > -1 ? process.argv[i + 1] : null, process.env.ARCHISTRY_SKILL, path.join(here, 'skill'), path.join(here, '..', '.claude', 'skills', 'archistry')].filter(Boolean).find((p) => fs.existsSync(path.join(path.resolve(p), 'scripts', 'lib', 'raster.mjs'))) || '.');
if (!fs.existsSync(path.join(skill, 'scripts', 'lib', 'raster.mjs'))) { console.error('Pass --skill <path to the archistry skill repo>.'); process.exit(1); }
const { rasterize } = await import(pathToFileURL(path.join(skill, 'scripts', 'lib', 'raster.mjs')).href);

const out = path.join(here, 'img', 'sm');
fs.mkdirSync(out, { recursive: true });
const jobs = [];
const add = (file, targetW, name) => {
  const b = fs.readFileSync(file);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  const tw = Math.min(targetW, w), th = Math.round((h * tw) / w);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${tw}" height="${th}" viewBox="0 0 ${tw} ${th}"><image href="data:image/png;base64,${b.toString('base64')}" width="${tw}" height="${th}"/></svg>`;
  jobs.push({ name, svg, width: tw, height: th, scale: 1, format: 'png' });
};
for (const f of fs.readdirSync(path.join(skill, 'docs', 'previews')).filter((n) => n.endsWith('.png'))) add(path.join(skill, 'docs', 'previews', f), 800, f);
if (fs.existsSync(path.join(skill, 'docs', 'how-it-works.png'))) add(path.join(skill, 'docs', 'how-it-works.png'), 1400, 'how-it-works.png');

let bytes = 0;
for (let k = 0; k < jobs.length; k += 10) {
  const part = jobs.slice(k, k + 10);
  const pngs = rasterize(part);
  part.forEach((j, n) => { fs.writeFileSync(path.join(out, j.name), pngs[n]); bytes += pngs[n].length; });
  process.stdout.write(`\r${Math.min(k + 10, jobs.length)}/${jobs.length}`);
}
console.log(`\nwrote ${jobs.length} images to img/sm/  (${(bytes / 1024).toFixed(0)} KB)`);
