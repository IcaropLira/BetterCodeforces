# Contributing

Thanks for helping! Bug reports about visual glitches are the most useful contribution: Codeforces has many page types and I can't see them all.

## Reporting a visual glitch
Open an issue with the **page URL**, a **screenshot**, your browser and theme, and (if you can) the element's class from *Inspect*. Please redact anything private from screenshots.

## Code
```bash
npm ci
npm run check      # tests + build + web-ext lint
npm run test:e2e   # optional: real Chromium
```
- No bundler, no framework: plain JS and CSS so store reviewers can read exactly what ships.
- Theme changes go in `content/theme.css` (use the CSS variables). Per-element color fixing lives in `content/contrast.js` / `shared/color.js` (unit-tested).
- Anything that touches translation must keep `test/dom.test.mjs` passing: formula nodes must stay the *same* nodes, in the same order.
- Text for the UI goes through `shared/i18n.js` in **both** languages.
- If you add a network request, host permission or stored data, update `PRIVACY.md`, `PRIVACY.pt-BR.md`, `docs/STORE_LISTING.md` and the manifest in the same PR.
