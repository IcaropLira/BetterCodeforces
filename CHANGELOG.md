# Changelog

## Unreleased

## 0.3.1
- Problem list: solved problems (and ones with wrong attempts) now get the **same** highlight on every row — soft tint plus a side bar — instead of only every other row.
- Dark mode: the Codeforces logo keeps its original colours (no more distorted bars) and the Telegram sponsor badge no longer sits on a white square. Images are recoloured locally in the extension; nothing is sent anywhere.
- Header: logo, language flags and user box no longer touch the edges of the card (`--cfm-gutter` controls the spacing).
- One-command releases (`npm run release -- patch --push`) and a tag-triggered workflow that builds the Chrome and Firefox packages, creates the GitHub Release and, when the store secrets are set, submits the new version to the Chrome Web Store and Firefox Add-ons.
- Tests: end-to-end checks for the solved-row highlight, logo/badge recolouring and header spacing; unit tests for the release helpers.

## 0.3.0
- Dark-mode **contrast engine**: fixes white boxes, black/navy text and light backgrounds that the stylesheet can't predict.
- Detects icons with white backgrounds (or black glyphs) and adapts them to the dark theme.
- Menu "lava" highlight, search box, table corners, rating first-letters and other glitches fixed.
- Interface in English and Portuguese (auto-detected, selectable in the popup).
- Store-ready: `_locales`, Firefox `data_collection_permissions`, privacy policy, listing text, promo images.
- Tests: color math, icon analysis, i18n; end-to-end test in real Chromium; CI and release workflows.

## 0.2.0
- Renamed to Hiraku Codeforces. MathJax readable in dark mode, sidebar tables, rating colors, many visual improvements.

## 0.1.0
- First version: theme, popup, translation with TeX protection (Google/DeepL).
