# Archistry website

The guide and live demo for **[Archistry](https://github.com/abhishakec/archistry)**, the Salesforce diagram skill for AI agents.

**Live site:** https://abhishakec.github.io/archistry-site/

This is a separate repository on purpose: installing the skill (`git clone .../archistry`) never downloads the website.
The site reads the skill's real output (examples, previews, logo) from the skill repo when it builds, so nothing is copied or kept in sync by hand.

## Build and preview

You need Node.js 18 or later. There are no dependencies.

```bash
git clone https://github.com/abhishakec/archistry.git skill        # the skill repo, next to this one
node scripts/build.mjs --skill skill --serve                       # builds _site/ and serves http://127.0.0.1:4173/
```

`--skill` also accepts any other path to a clone of the skill repo (or set `ARCHISTRY_SKILL`).

## Publish

GitHub Pages is set to **GitHub Actions** as its source. `.github/workflows/pages.yml` checks out this repo and the skill repo, runs `node scripts/build.mjs --skill skill`, and deploys `_site/`.
It runs on every push to `main`, every Monday (to pick up new examples) and on demand from the Actions tab.

## What is here

| Path | What |
|---|---|
| `index.html`, `404.html` | The page (one section per screen, plain HTML) |
| `assets/` | `style.css`, `app.js`, file-type icons, and three real exports of an example diagram (light, dark, transparent) |
| `img/sm/` | 800px copies of the diagram previews for phones (`node scripts/small-images.mjs --skill skill` rebuilds them) |
| `scripts/build.mjs` | Assembles `_site/` from this repo plus the skill repo |

Built with plain HTML, CSS and JavaScript: no framework, no build tooling beyond the Node script, works offline once loaded, light and dark themes, keyboard and reduced-motion friendly.

## Licence

MIT, see [LICENSE](LICENSE). Diagram examples, icons and logo come from the [skill repo](https://github.com/abhishakec/archistry) and keep its terms (see its `THIRD-PARTY-NOTICES.md`). Fonts: Sora, Inter and JetBrains Mono under the SIL Open Font License 1.1 (licence texts in this repo).
Salesforce, Agentforce, Data Cloud and MuleSoft are trademarks of Salesforce, Inc.; this is an unofficial community project.
