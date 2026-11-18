// Reads the releases of the skill repo and writes them as JSON for the changelog page.
// Usage: node scripts/fetch-releases.mjs <out.json> [owner/repo]
// Uses GITHUB_TOKEN when it is set (higher rate limit); works without it for a public repo.
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'releases.json';
const repo = process.argv[3] || 'abhishakec/archistry';
const headers = { Accept: 'application/vnd.github.html+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'archistry-site-build' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

let list = [];
try {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const rows = await res.json();
  list = rows.filter((r) => !r.draft).map((r) => ({
    tag: r.tag_name,
    name: r.name || r.tag_name,
    date: r.published_at || r.created_at,
    url: r.html_url,
    prerelease: !!r.prerelease,
    html: r.body_html || '',
  }));
  console.log(`releases: ${list.length} from ${repo}`);
} catch (e) {
  // Do not fail the deploy: the page falls back to reading the GitHub API in the browser.
  console.warn(`releases: could not read ${repo} (${e.message}); writing an empty list`);
}
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, JSON.stringify(list));
