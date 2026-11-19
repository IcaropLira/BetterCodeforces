#!/usr/bin/env node
// Regenera as imagens das lojas em store/ (promo tiles + screenshot do popup) a partir
// de HTML, com a mesma identidade das outras ferramentas Hiraku: fundo #0d0817,
// brilhos rosa/roxo, Playfair Display + Fira Code e a logo de brand/.
//
// Uso:  CHROMIUM_PATH=/caminho/do/chrome node scripts/make-store-assets.mjs
//       (sem CHROMIUM_PATH usa o Chromium do Playwright: npx playwright-core install chromium)
// As capturas dentro do próprio Codeforces você tira à mão (ver docs/PUBLISHING.md).
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright-core';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'store');
const url = (p) => pathToFileURL(join(root, p)).href;
const logo = readFileSync(join(root, 'brand/hiraku-codeforces.svg'), 'utf8');

const FONTS = `
@font-face { font-family: "Playfair Display"; font-weight: 700; src: url("${url('popup/fonts/playfair-display-700.woff2')}"); }
@font-face { font-family: "Fira Code"; font-weight: 500; src: url("${url('popup/fonts/fira-code-500.woff2')}"); }
* { box-sizing: border-box; margin: 0; }
body { width: var(--w); height: var(--h); overflow: hidden; background: #0d0817; color: #ece6f7;
  font-family: Inter, system-ui, sans-serif; position: relative; }
.glow { position: absolute; inset: 0; background:
  radial-gradient(calc(var(--w) * .55) calc(var(--h) * .9) at 18% 20%, #ee0f7f2e, transparent 70%),
  radial-gradient(calc(var(--w) * .6) calc(var(--h)) at 85% 100%, #3b247780, transparent 70%),
  radial-gradient(calc(var(--w) * .4) calc(var(--h) * .7) at 70% 10%, #ff8db81c, transparent 70%); }
.kanji { position: absolute; right: -2%; top: 50%; transform: translateY(-52%); font: 900 calc(var(--h) * 1.05)/1 "Noto Sans CJK JP", "Noto Sans CJK TC", sans-serif;
  color: transparent; -webkit-text-stroke: 2px #ff8db826; }
.row { position: absolute; inset: 0; display: flex; align-items: center; gap: calc(var(--w) * .045); padding-left: calc(var(--w) * .07); }
.mark { width: var(--logo); height: var(--logo); flex: none; filter: drop-shadow(0 18px 40px #ee0f7f40); }
.mark svg { width: 100%; height: 100%; }
h1 { font: 700 var(--t)/1 "Playfair Display", Georgia, serif; letter-spacing: -.01em; }
h1 em { display: block; font-style: normal; background: linear-gradient(135deg, #ee0f7f, #ff8db8 45%, #b58ad8);
  -webkit-background-clip: text; background-clip: text; color: transparent; padding-bottom: .08em; }
.k { font: 500 var(--s) "Fira Code", monospace; color: #ff8db8; margin-top: calc(var(--s) * 1.1); max-width: 30ch; line-height: 1.5; }
.fine { position: absolute; left: calc(var(--w) * .07); bottom: calc(var(--h) * .07); font: 500 var(--f) "Fira Code", monospace; color: #9d90b8; }
.spark { position: absolute; width: calc(var(--h) * .07); fill: url(#sg); }
`;

const SG = `<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#ee0f7f"/><stop offset=".5" stop-color="#ff8db8"/><stop offset="1" stop-color="#d4a2c8"/></linearGradient></defs></svg>`;
const spark = (style) => `<svg class="spark" viewBox="0 0 24 24" style="${style}"><path d="M12,0Q13,11 24,12Q13,13 12,24Q11,13 0,12Q11,11 12,0Z"/></svg>`;

function tile(w, h, { t, s, l, f }, tagline) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
:root { --w: ${w}px; --h: ${h}px; --t: ${t}px; --s: ${s}px; --logo: ${l}px; --f: ${f}px; } ${FONTS}
</style></head><body>${SG}<div class="glow"></div><div class="kanji">開</div>
${spark(`left:${w * 0.07 + l * 0.92}px; top:${h * 0.13}px`)}
${spark(`left:${w * 0.93}px; top:${h * 0.78}px; width:${h * 0.04}px`)}
<div class="row"><div class="mark">${logo}</div><div><h1>Hiraku<em>Codeforces</em></h1><p class="k">${tagline}</p></div></div>
<p class="fine">Unofficial extension — not affiliated with Codeforces</p></body></html>`;
}

const STUB = (theme, accent) => `window.chrome={storage:{local:{get:async d=>({...d,uiLang:'en',theme:'${theme}',accent:'${accent}'}),set:async()=>{}}},
tabs:{query:async()=>[{id:1}],sendMessage:async()=>({ok:true,hasStatement:true,mode:'orig'})},
runtime:{sendMessage:async()=>({ok:true,text:'ok'})},i18n:{getUILanguage:()=>'en'}};`;

async function popupShot(browser, scheme, theme, accent) {
  const ctx = await browser.newContext({ viewport: { width: 340, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.addInitScript(STUB(theme, accent));
  await page.goto(url('popup/popup.html'));
  await page.waitForTimeout(400);
  const png = await page.locator('main').screenshot();
  await ctx.close();
  return `data:image/png;base64,${png.toString('base64')}`;
}

function screenshotPage(dark, light) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
:root { --w: 1280px; --h: 800px; --t: 64px; --s: 19px; --logo: 0px; --f: 14px; } ${FONTS}
.copy { position: absolute; left: 80px; top: 150px; width: 470px; }
.copy h1 { font-size: 60px; }
ul { list-style: none; padding: 0; margin-top: 34px; display: grid; gap: 14px; font-size: 19px; color: #d8cfea; }
li::before { content: "✦"; color: #ff8db8; margin-right: 12px; }
.card { position: absolute; width: 290px; border-radius: 20px; overflow: hidden; box-shadow: 0 30px 70px #00000080, 0 0 0 1px #2d2148; }
.card img { display: block; width: 100%; }
</style></head><body>${SG}<div class="glow"></div>
<div class="copy"><p class="k" style="margin:0 0 14px">// hiraku codeforces</p><h1>Make Codeforces<em>yours.</em></h1>
<ul><li>Light, dark or automatic theme</li><li>College standings for your institution</li><li>Math-safe statement translation</li><li>Spoiler-free tags, hide solved problems</li></ul></div>
<div class="card" style="left:620px; top:50px"><img src="${dark}"></div>
<div class="card" style="left:940px; top:120px"><img src="${light}"></div>
<p class="fine">Unofficial extension — not affiliated with Codeforces</p></body></html>`;
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
async function render(html, w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, file) });
  await page.close();
  console.log('✔', file);
}

mkdirSync(join(out, 'screenshots'), { recursive: true });
await render(tile(440, 280, { t: 40, s: 11.5, l: 112, f: 9 }, 'Modern look · math-safe translation'), 440, 280, 'promo-small-440x280.png');
await render(tile(1400, 560, { t: 96, s: 22, l: 270, f: 15 }, 'Modern look, college standings and translation that keeps every formula.'), 1400, 560, 'promo-marquee-1400x560.png');
const dark = await popupShot(browser, 'dark', 'dark', '#ee3d8b');
const light = await popupShot(browser, 'light', 'light', '#a77bdb');
await render(screenshotPage(dark, light), 1280, 800, 'screenshots/01-popup-1280x800.png');
await browser.close();
