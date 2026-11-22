# Privacy Policy — Hiraku Codeforces

_Last updated: 2026-11-22 · Português: [PRIVACY.pt-BR.md](PRIVACY.pt-BR.md)_

Hiraku Codeforces is a browser extension that changes how Codeforces looks and can translate problem statements. This policy explains what it does with your data. The short version: **the developer collects nothing.** There is no server, no account, no analytics and no tracking.

## What stays on your device
- **Settings** (theme, accent color, font, text size, translation language, service, interface language, auto-translate, anti-spoiler, hide solved, organization, heatmap mode, people-you-know options) are stored in the browser's extension storage (`storage.local`).
- **Your DeepL API key**, if you choose to use DeepL, is stored in the same place. It never leaves your browser except to authenticate requests to DeepL (see below).
- **A translation cache** (translated text snippets, up to 21 days / 1,000 entries) and an **icon cache** (whether a small icon needs adjusting for the dark theme) are stored locally to avoid repeating work.

You can remove all of this at any time by uninstalling the extension or clearing its data.

## What is sent over the network, and only when you ask
- **Translation.** When you press *Translate* (or have *Translate automatically* turned on), the text of the problem statement on the current page is sent **directly from your browser** to the service you selected:
  - **Google Translate** (`translate.googleapis.com`, the public endpoint used by Google's own translation tools), or
  - **DeepL** (`api-free.deepl.com` / `api.deepl.com`), authenticated with your own API key.

  Mathematical formulas, code and sample inputs/outputs are replaced by placeholders before sending and are **not** transmitted. Those services process the text under their own privacy policies: [Google](https://policies.google.com/privacy), [DeepL](https://www.deepl.com/privacy). The developer of this extension never receives this text.
- **Icons.** To fix small icons that have a white background in the dark theme, the extension downloads icons **from Codeforces domains only** (`codeforces.com`, `codeforces.org`, `codeforc.es`) and inspects their pixels locally. Nothing about this is sent anywhere else.

- **College standings,** only when you press *My institution* on a standings page: the extension reads, **from Codeforces itself**, your public profile (to find your organization), the organization's public rating list and the contest's public standings (`codeforces.com/api/contest.standings`, an anonymous request). The member list is cached locally for 3 days. Nothing is sent anywhere else.

- **"People you know" on problem pages** (can be turned off in the popup): uses the same public data below for your friends and, optionally, the 30 most active members of your organization, keeping only which problems each person solved or tried, cached locally for 12 hours.
- **Exports** (CSV / JSON) are generated in your browser and saved straight to your computer; nothing is uploaded.
- **Heatmap and Hiraku Analytics,** only when you pick a heatmap mode other than the Codeforces colors or open the analytics page: the extension reads, **from Codeforces itself**, public data through the official API (`user.status`, `user.info`, `user.rating`, `problemset.problems`, anonymous requests) and, for the *Friends* tab, your own `codeforces.com/friends` page. Summaries are cached locally for 30 minutes and the problem list for a day. Nothing is sent anywhere else.

No other network requests are made. The extension does not load or run remote code.

## What the extension does not do
It does not collect personal information, browsing history, credentials or identifiers; it does not read pages outside Codeforces; it does not use cookies of its own; it does not sell, share or transfer data to third parties other than the translation service you choose, and only for the purpose of translating.

## Permissions, in plain words
- `storage` — save your settings and the local caches.
- Access to `codeforces.com`, `codeforces.org` and `codeforc.es` — apply the theme and translate statements on those sites.
- Access to `translate.googleapis.com`, `api-free.deepl.com`, `api.deepl.com` — send statement text to the translation service you selected.

## Children
The extension is not directed to children and collects no personal data from anyone.

## Changes
If this policy changes, the new version will be published in this repository with an updated date, and the extension's listing will be updated accordingly.

## Contact
Open an issue at <https://github.com/IcaropLira/BetterCodeforces/issues>.

_Hiraku Codeforces is an independent, unofficial project. It is not affiliated with, endorsed by or sponsored by Codeforces, Google or DeepL._
