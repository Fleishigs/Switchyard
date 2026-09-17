# Documentation website

The GitHub repository homepage renders the root `README.md`, including its SVG banner, screenshot, tables, and links. It does not render `docs/index.html` as an interactive homepage. GitHub Pages serves the full HTML guide separately at <https://fleishigs.github.io/Switchyard/>.

The site uses plain HTML, CSS, and JavaScript with local assets, system fonts, and no analytics or external scripts. It works directly from `docs/index.html` and has no build dependencies. The catalogue remains readable without JavaScript; JavaScript adds search and category filtering.

After changing `shared/catalog.mjs`, refresh its static documentation with:

```powershell
node scripts/build-docs-catalogue.mjs
```

Update version, download size, and feature summaries in both the README and HTML guide when releases change. Historical verification documents describe their own versions.

Publishing source: GitHub Pages, branch `main`, folder `/docs`. `docs/.nojekyll` preserves plain static publishing. Source documentation links in the guide point to GitHub so Markdown reads properly. The repository remains the authoritative location for verification evidence and licenses.

Validation on 2026-09-17: desktop and mobile layouts checked at 1440, 768, 390, and 320 pixels; no horizontal page overflow. All 112 tools rendered; search, category filtering, no-results state, and internal anchors passed browser checks. The catalogue also rendered with JavaScript disabled, with no browser script errors in the enabled checks.
