# Changelog

## Unreleased

## 0.5.0
- **Profile heatmap with modes:** the green squares on your Codeforces profile can now be colored by *problems solved*, *submissions*, *hardest problem of the day* or *average difficulty of the day* (in the rank colors). Pick it right above the calendar or in the popup; a legend and a tooltip per day (solved, submissions, hardest, average) come along. Count modes adapt their scale to your busiest day, like GitHub.
- **Hiraku Analytics** (`/profile/<handle>#hiraku`, also in the top menu, on the profile and in the popup), for any handle:
  - *Overview:* solved, last 30/7 days, current and best streak, level (average of the last 50 solved), hardest solved, acceptance, active days, rated contests; a 12-month calendar; solved by difficulty and per month; rating history over the rank bands; most solved tags; verdicts; languages.
  - *Trying now:* problems you attempted in the last 30 days and have not solved yet.
  - *What to solve next:* unsolved problems just above your level, most solved by the community first, filterable by tag.
  - *Friends* and *Institution:* everyone side by side — rating, solved, last 7/30 days, level, hardest in 30 days, streak, what they are trying now, last submission — with a "vs you" column (more/fewer problems, harder/easier level), a 30-day ranking chart and sortable columns.
- Data comes from the public Codeforces API (one call every 2 s, as Codeforces asks) and from your own `/friends` page; summaries are cached for 30 minutes and the problem list for a day.

## 0.4.0
- **New identity**, in line with the other Hiraku tools: the open book from the old mark, now in the Hiraku gradient (pink → lilac → purple) on `#1a1230`, with the 開 sparkle between the pages. New icons (a simplified mark for 16/32 px), store images and popup; the mark now also appears in the bars the extension adds to Codeforces. Sources in `brand/`.
- **Hiraku palette:** plum dark theme (`#0d0817`), pink default accent, Playfair Display + Fira Code in the popup.
- **College standings:** a bar above every standings table with a search box and *Everyone / My institution*. Your organization is read from your Codeforces profile (or set in the popup). On regular contests it shows every participant from your institution with their position inside it and overall; on gyms/groups (where the API needs a key) it filters the open page.
- **Anti-spoiler:** optionally blur tags and difficulty until you hover. **Hide solved problems** in the problem list.
- Fix: dark-mode Codeforces logo — the inside of the letters (O, D, R…) stayed white and the letters had a grey outline. The logo now goes through "color to alpha", so only the ink remains.
- Fix: in multi-test samples, hovering a line painted the test in cream (`#FFFDE7`) with light text on top — unreadable. It now uses the accent tint, and the test-number marker is readable.
- Fix: focused, autofilled and placeholder text in inputs readable in the dark theme; dropdown options follow the theme.

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
