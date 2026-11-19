# Store listing text (copy & paste)

Everything you need to fill in the Chrome Web Store and Firefox AMO forms. Replace `YOUR_USER` with your GitHub user.

> **Name.** The extension is currently called **Hiraku Codeforces**. Both stores forbid implying that a product is made or endorsed by another organization, and "Codeforces" is someone else's brand. A safer name is **Hiraku for Codeforces** (same pattern Mozilla requires for "… for Firefox"). To rename, edit `extName` in `_locales/en/messages.json` and `_locales/pt_BR/messages.json`, then change the title in `scripts/make-store-assets.mjs` and rerun `npm run assets`. Keep the "unofficial / not affiliated" sentence in the description.

## Short description (≤132 chars) — already in `_locales`
> A modern look for Codeforces: light/dark themes and one-click problem translation that keeps LaTeX formulas intact.

## Detailed description (English)
```
Hiraku Codeforces gives Codeforces a modern, readable look and can translate problem statements without breaking the math.

LOOK
• Light, dark or automatic theme, with your own accent color
• Cleaner problem pages: readable statements, tidy sample tests, rounded cards, tables and menus
• Automatic contrast fixes in dark mode (white boxes, black text and dark-blue links are corrected on every page)
• Choose the statement font and text size

TRANSLATE WITHOUT BREAKING MATH
• One click (or Alt+Shift+T) translates the statement; click again to see the original
• Formulas, code and sample tests are protected, so TeX never turns into garbage like it does with whole-page translators
• Google Translate (no key needed) or DeepL (bring your own API key)
• 17 target languages; the interface is available in English and Portuguese
• Results are cached locally

PRIVACY
• No account, no analytics, no tracking, no developer server
• Statement text is sent to the translation service you choose only when you translate; formulas and samples are not sent
• Full policy: https://github.com/YOUR_USER/hiraku-codeforces/blob/main/PRIVACY.md

Open source (MIT): https://github.com/YOUR_USER/hiraku-codeforces

Unofficial extension. Not affiliated with, endorsed by or sponsored by Codeforces, Google or DeepL.
```

## Descrição detalhada (Português)
```
O Hiraku Codeforces dá ao Codeforces um visual moderno e legível e pode traduzir enunciados sem quebrar a matemática.

VISUAL
• Tema claro, escuro ou automático, com a sua cor de destaque
• Páginas de problemas mais limpas: enunciado legível, exemplos organizados, cartões, tabelas e menus arredondados
• Correção automática de contraste no modo escuro (caixas brancas, texto preto e links azul-marinho são corrigidos em qualquer página)
• Escolha a fonte e o tamanho do texto do enunciado

TRADUZA SEM QUEBRAR A MATEMÁTICA
• Um clique (ou Alt+Shift+T) traduz o enunciado; outro clique mostra o original
• Fórmulas, código e exemplos são protegidos, então o TeX não vira bagunça como nos tradutores de página inteira
• Google Tradutor (sem chave) ou DeepL (com a sua chave de API)
• 17 idiomas de destino; interface em português e inglês
• Resultados ficam em cache local

PRIVACIDADE
• Sem conta, sem análise de uso, sem rastreamento, sem servidor do desenvolvedor
• O texto do enunciado só é enviado ao serviço de tradução escolhido quando você traduz; fórmulas e exemplos não são enviados
• Política completa: https://github.com/YOUR_USER/hiraku-codeforces/blob/main/PRIVACY.pt-BR.md

Código aberto (MIT): https://github.com/YOUR_USER/hiraku-codeforces

Extensão não oficial. Sem afiliação, endosso ou patrocínio do Codeforces, Google ou DeepL.
```

---

## Chrome Web Store — Privacy tab

**Single purpose**
> Improve the appearance of Codeforces pages and translate Codeforces problem statements on request.

**Permission justifications**
| Permission | Justification |
|---|---|
| `storage` | Saves the user's settings (theme, accent color, font, translation language/service, DeepL key) and local caches of translations and icon analysis. |
| Host access: `codeforces.com`, `*.codeforces.com`, `codeforc.es` | Content scripts apply the theme, fix contrast and add the translate button on Codeforces pages. |
| Host access: `codeforces.org`, `*.codeforces.org` | Codeforces serves its small interface icons from this domain; the extension reads them to adjust icons with white backgrounds in dark mode. |
| Host access: `translate.googleapis.com` | Sends the statement text to Google Translate when the user chooses that service and presses Translate. |
| Host access: `api-free.deepl.com`, `api.deepl.com` | Sends the statement text to DeepL, with the user's own API key, when the user chooses that service and presses Translate. |

**Remote code:** No, I am not using remote code. (All code is packaged; there is no `eval`, no remotely hosted scripts.)

**Data usage disclosure** (check only what applies, then certify the three statements):
- ☑ **Website content** — statement text is sent to the translation service the user selects, only on request.
- ☑ **Authentication information** — the optional DeepL API key is stored locally and sent only to DeepL to authenticate the user's requests. _(If you prefer not to tick this, remove DeepL support; ticking it is the conservative choice.)_
- ☐ everything else (personally identifiable info, health, financial, location, web history, user activity, personal communications).
- Certify: data is not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used for creditworthiness or lending.

**Privacy policy URL:** `https://github.com/YOUR_USER/hiraku-codeforces/blob/main/PRIVACY.md`

---

## Firefox (AMO)

**Summary (≤250 chars)**
> Modern light/dark look for Codeforces and one-click problem translation that keeps math formulas intact. Google Translate or DeepL. Open source.

**Categories:** Appearance, Language Support

**Data collection (declared in `manifest.json`):** `websiteContent` is **required** — the statement text is transmitted to the chosen translation service when the user translates. Firefox shows this to the user at install time.

**Notes to reviewer**
```
No build step: the submitted ZIP contains the source files exactly as in the repository (no minification, bundling or transpilation). `npm run build` only copies files and writes manifest.json (see build.mjs).

How to test: open any problem on https://codeforces.com (e.g. /problemset/problem/4/A), press the "Translate" button above the statement. The text is sent to translate.googleapis.com (default) — no account needed. DeepL is optional and needs the reviewer's own API key.

Network use: translate.googleapis.com, api-free.deepl.com, api.deepl.com (translation, on user action only); codeforces.com/.org (icon analysis, read-only). No other requests, no remote code, no analytics.
```
