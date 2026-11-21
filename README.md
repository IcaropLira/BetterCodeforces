# Hiraku Codeforces

<img src="brand/hiraku-codeforces.svg" width="96" alt="">

[![CI](https://github.com/IcaropLira/BetterCodeforces/actions/workflows/ci.yml/badge.svg)](https://github.com/IcaropLira/BetterCodeforces/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A **Chrome and Firefox** extension that gives [Codeforces](https://codeforces.com) a modern look and translates problem statements **without breaking the TeX formulas**.

🇧🇷 Português: [README.pt-BR.md](README.pt-BR.md)

> Unofficial project. Not affiliated with, endorsed by or sponsored by Codeforces, Google or DeepL.

## Features

**Look**
- Light, dark or automatic theme with your own accent color, font and statement text size.
- Redesigned problem pages (readable statement, tidy sample tests with copy buttons), cards, tables, menus and forms.
- **Contrast engine for dark mode:** Codeforces has hundreds of hand-colored elements (white boxes, black text, navy links, light icons). Besides the stylesheet, a small script inspects the *computed* colors and fixes whatever is still unreadable, keeping rating colors recognizable.
- Interface in English and Portuguese.

**Quality of life**
- **College standings:** on any standings page, filter by handle/team or switch to *My institution* — every participant from your Codeforces organization with their position inside it and overall (regular contests); on gyms/groups it filters the open page.
- **Profile heatmap with modes:** color the green squares by problems solved, submissions, or the hardest / average difficulty of each day.
- **Hiraku Analytics** (`/profile/<handle>#hiraku`, "Analytics" in the top menu): your numbers and charts (difficulty, months, rating, tags, verdicts, languages, streaks), what you are trying now, what to solve next, and a side-by-side comparison with your friends and your institution.
- **Anti-spoiler:** blur tags and difficulty until you hover.
- **Hide solved problems** in the problem list.

**Translation**
- One click (or `Alt+Shift+T`) translates the statement; click again for the original.
- Formulas, code and samples are swapped for placeholders before translating and restored afterwards — the *same already-rendered* MathJax nodes are moved back, never rebuilt from text.
- The answer is validated (every placeholder present once and properly nested). If the service mangles it, the snippet is retried in "plain" mode (sentences only) and, failing that, left in the original.
- Google Translate (no key) or DeepL (your own API key); 17 target languages; local cache.

## Install

| Browser | How |
|---|---|
| Chrome / Edge / Brave | **[Chrome Web Store](https://chromewebstore.google.com/detail/hiraku-codeforces/kbjfgloamahakmngfecokkmffeakjnpk)**. Or load the zip: download `hiraku-codeforces-<version>-chrome.zip` from [Releases](../../releases), unzip, open `chrome://extensions`, enable *Developer mode* → *Load unpacked*. |
| Firefox | **[Firefox Add-ons](https://addons.mozilla.org/firefox/addon/hiraku-for-codeforces/)**. Or `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → pick the Firefox zip (temporary until restart). |

Requires Chrome 120+ / Firefox 140+.

## Usage

Click the toolbar icon to set theme, accent, font, size, translation language/service and interface language. On a problem page, use the **Translate** bar above the statement.

## Privacy

No account, no analytics, no developer server. Statement text is sent to the translation service **you** choose, only when you translate; formulas and samples are not sent. Details: [PRIVACY.md](PRIVACY.md).

## Development

```bash
npm ci
npm test          # unit + DOM tests (node:test, jsdom)
npm run build     # dist/chrome, dist/firefox and the store zips
npm run lint      # web-ext lint on the Firefox build
npm run check     # all of the above
npm run test:e2e  # real Chromium with the extension loaded (needs Chromium; see e2e/run.mjs)
```

Load `dist/chrome` / `dist/firefox` as described above after each build.

```
manifest.base.json     base manifest (build.mjs writes one per browser)
background.js          translation requests, cache, icon analysis, shortcut
content/theme.css      the whole look, driven by CSS variables
content/contrast.js    dark-mode contrast engine
content/icons.js       light/dark icon detection
content/content.js     settings, DOM reading, translation, toolbar
content/standings.js   standings search and college standings
content/cfapi.js       Codeforces API queue (1 call / 2 s) and caches
content/heatmap.js     profile heatmap modes
content/analytics.js   Hiraku Analytics page (#hiraku on a profile)
shared/stats.js        metrics from submissions (pure, tested)
content/mark.js        the extension mark used in the injected bars
brand/                 logo sources (SVG; the -small variant is for 16/32 px)
shared/                defaults, i18n, color math, TeX protection
popup/                 settings popup
_locales/              store name/description (en, pt_BR)
store/                 promo images and screenshots for the stores
docs/                  store listing text and publishing guide
e2e/                   end-to-end test (mock page + real Chromium)
```

### Fixing a visual glitch
Right-click the element → *Inspect*, note its class, and add a rule in the matching section of `content/theme.css`. Most one-off colors are already handled by the contrast engine, so also check `content/contrast.js` before adding special cases. Please include a screenshot and the page URL when opening an issue.

### Publishing
See [docs/PUBLISHING.md](docs/PUBLISHING.md) and [docs/STORE_LISTING.md](docs/STORE_LISTING.md).

## License

[MIT](LICENSE)
