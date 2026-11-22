#!/usr/bin/env node
// Teste ponta a ponta: carrega a extensão (build do Chrome) num Chromium de verdade,
// abre uma página local que imita os problemas de contraste do Codeforces
// (caixas brancas, texto preto, azul-marinho, ícones com fundo claro…) e confere:
//   • só com o CSS ainda sobram problemas (sanidade do teste);
//   • com o motor de contraste não sobra nenhum;
//   • os ícones são classificados certo e nada é mexido no tema claro.
//
// Uso:  npm run build && CHROMIUM_PATH=/caminho/do/chrome npm run test:e2e
//       (sem CHROMIUM_PATH usa o Chromium do Playwright: npx playwright-core install chromium)
//       O Google Chrome de marca 137+ ignora --load-extension: use Chromium.
import https from 'node:https';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { chromium } from 'playwright-core';
import * as mock from './mock-cf.mjs';
import { createRequire } from 'node:module';


const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const work = mkdtempSync(join(tmpdir(), 'hiraku-e2e-'));

execFileSync('node', [join(root, 'build.mjs')], { stdio: 'ignore' });

// certificado autoassinado para codeforces.com / codeforces.org (só vale neste teste)
execFileSync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2',
  '-keyout', join(work, 'key.pem'), '-out', join(work, 'cert.pem'),
  '-subj', '/CN=codeforces.com', '-addext', 'subjectAltName=DNS:codeforces.com,DNS:codeforces.org,DNS:translate.googleapis.com',
], { stdio: 'ignore' });

const server = https
  .createServer({ key: readFileSync(join(work, 'key.pem')), cert: readFileSync(join(work, 'cert.pem')) }, (req, res) => {
    const { pathname, searchParams } = new URL(req.url, 'https://x');
    if (pathname === '/translate_a/single') {
      // "Google Tradutor" falso: põe o texto em MAIÚSCULAS e preserva os marcadores ⟦n⟧
      const q = searchParams.get('q') ?? '';
      const out = q.split(/(⟦[^⟧]*⟧)/).map((p, i) => (i % 2 ? p : p.toUpperCase())).join('');
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify([[[out, q]], null, 'en']));
    }
    if (mock.handle(pathname, searchParams, res, readFileSync(join(here, 'fixtures', 'profile.html')))) return;
    const icon = join(here, 'fixtures', pathname);
    if (pathname.startsWith('/icons/') && existsSync(icon)) {
      res.writeHead(200, { 'content-type': 'image/png' });
      return res.end(readFileSync(icon));
    }
    const file = pathname === '/mock/contest' ? 'contest.html' : /^\/(problemset|contest)\//.test(pathname) ? 'problem.html' : 'page.html';
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(readFileSync(join(here, 'fixtures', file)));
  })
  .listen(0, '127.0.0.1');
await once(server, 'listening');
const PORT = server.address().port; // porta livre qualquer

// roda dentro da página (serializada pelo Playwright)
const audit = () => {
  const parse = s => {
    let m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+%?))?/.exec(s);
    if (m) return {r:+m[1],g:+m[2],b:+m[3],a:m[4]===undefined?1:(m[4].endsWith('%')?parseFloat(m[4])/100:+m[4])};
    m = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+%?))?\)/.exec(s);
    if (m) return {r:+m[1]*255,g:+m[2]*255,b:+m[3]*255,a:m[4]===undefined?1:(m[4].endsWith('%')?parseFloat(m[4])/100:+m[4])};
    return {r:0,g:0,b:0,a:0};
  };
  const lin = v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
  const lum = c => 0.2126*lin(c.r)+0.7152*lin(c.g)+0.0722*lin(c.b);
  const contrast = (a,b) => { const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const bgOf = el => { for (let p=el; p; p=p.parentElement) { const c=parse(getComputedStyle(p).backgroundColor); if (c && c.a>=0.5) return c; } return {r:255,g:255,b:255,a:1}; };
  const name = el => el.tagName + (el.id ? '#' + el.id : '');
  const low = [], light = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('svg,script,style')) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || !r.width || !r.height) continue;
    if (Array.from(el.childNodes).some(n => n.nodeType === 3 && n.nodeValue.trim())) {
      const c = contrast(parse(cs.color), bgOf(el));
      if (c < 3.9) low.push(name(el) + ' (' + c.toFixed(2) + ')');
    }
    const bg = parse(cs.backgroundColor);
    if (bg.a >= 0.5 && el.tagName !== 'IMG' && lum(bg) > 0.45 && r.width * r.height >= 20) light.push(name(el));
  }
  const icons = {};
  for (const id of ['env', 'folder', 'star', 'listicon']) icons[id] = document.getElementById(id)?.dataset.cfmIcon ?? null;
  return { theme: document.documentElement.dataset.cfmTheme, low, light, icons };
};

async function launch(variant, scheme) {
  const ext = join(work, 'ext-' + variant);
  cpSync(join(root, 'dist', 'chrome'), ext, { recursive: true });
  if (variant === 'css-only') {
    const mp = join(ext, 'manifest.json');
    const m = JSON.parse(readFileSync(mp, 'utf8'));
    m.content_scripts[0].js = m.content_scripts[0].js.filter((f) => !/contrast|icons/.test(f));
    writeFileSync(mp, JSON.stringify(m));
  }
  return chromium.launchPersistentContext(join(work, `profile-${variant}-${scheme}-${Math.random().toString(36).slice(2)}`), {
    headless: false,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    colorScheme: scheme,
    viewport: { width: 1250, height: 800 },
    ignoreHTTPSErrors: true,
    args: [
      '--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`,
      `--host-resolver-rules=MAP codeforces.com 127.0.0.1:${PORT}, MAP codeforces.org 127.0.0.1:${PORT}, MAP translate.googleapis.com 127.0.0.1:${PORT}`,
      '--ignore-certificate-errors', '--no-sandbox', '--no-proxy-server',
    ],
  });
}

async function run(variant, scheme) {
  const ctx = await launch(variant, scheme);
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto('https://codeforces.com/groups');
    await page.waitForTimeout(3500);
    const result = await page.evaluate(audit);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: join(root, `e2e-${variant}-${scheme}.png`), fullPage: true });
    return result;
  } finally {
    await ctx.close();
  }
}

// Página que imita o print do usuário: linhas resolvidas, header colado nas bordas e selo do Telegram.
const contestAudit = () => {
  const bg = (id) => Array.from(document.getElementById(id).children).map((td) => getComputedStyle(td).backgroundColor);
  const rect = (id) => document.getElementById(id).getBoundingClientRect();
  const hdr = document.getElementById('header').getBoundingClientRect();
  const pixels = (id, pts) => {
    const img = document.getElementById(id);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return pts.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data));
  };
  return {
    rows: Object.fromEntries(['rA', 'rB', 'rC', 'rD', 'rE', 'rF', 'rG'].map((r) => [r, bg(r)])),
    firstShadow: ['rA', 'rB', 'rC', 'rD', 'rE'].map((r) => getComputedStyle(document.getElementById(r).firstElementChild).boxShadow),
    logo: { src: document.getElementById('logo').src.slice(0, 22), ready: document.getElementById('logo').dataset.cfmReady ?? null,
            left: rect('logo').left - hdr.left },
    userRight: hdr.right - rect('user').right,
    flagsRight: hdr.right - rect('flags').right,
    flagsTop: rect('flags').top - hdr.top,
    tg: { src: document.getElementById('tg').src.slice(0, 22), ready: document.getElementById('tg').dataset.cfmReady ?? null },
    logoPx: document.getElementById('logo').dataset.cfmReady === 'ok' ? pixels('logo', [[2, 2], [25, 40], [100, 34], [200, 34]]) : null,
    tgPx: document.getElementById('tg').dataset.cfmReady === 'ok' ? pixels('tg', [[1, 1], [30, 8], [30, 31]]) : null,
  };
};

async function contest(scheme) {
  const ctx = await launch('full', scheme);
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto('https://codeforces.com/mock/contest');
    await page.waitForTimeout(3500);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: join(root, `e2e-contest-${scheme}.png`), fullPage: true });
    return await page.evaluate(contestAudit);
  } finally {
    await ctx.close();
  }
}

// Tradução de ponta a ponta: clique no botão → content script → background → "Google" falso → DOM.
async function translation() {
  const ctx = await launch('full', 'dark');
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto('https://codeforces.com/problemset/problem/1/A');
    await page.waitForSelector('.cfm-btn');
    const snap = () =>
      page.evaluate(() => ({
        ids: Array.from(document.querySelectorAll('.MathJax, script[type="math/tex"], .MathJax_Preview')).map((n) => n.id || n.className),
        text: document.querySelector('.problem-statement').textContent.replace(/\s+/g, ' '),
        sampleIn: document.getElementById('sample-in').textContent,
        sections: Array.from(document.querySelectorAll('.section-title')).map((n) => n.textContent),
        label: document.querySelector('.cfm-btn span').textContent,
        status: document.querySelector('.cfm-status').textContent,
        boldHasMath: !!document.querySelector('.problem-statement b .MathJax'),
        href: document.querySelector('.problem-statement a')?.getAttribute('href'),
      }));
    const before = await snap();
    await page.click('.cfm-btn');
    await page.waitForFunction(() => document.querySelector('.cfm-btn span').textContent === 'Show original', null, { timeout: 15000 });
    const after = await snap();
    await page.click('.cfm-btn');
    await page.waitForFunction(() => document.querySelector('.cfm-btn span').textContent === 'Translate');
    const back = await snap();
    return { before, after, back };
  } finally {
    await ctx.close();
  }
}

// Heatmap do perfil + página de analytics, contra o Codeforces falso (e2e/mock-cf.mjs).
async function analytics(scheme) {
  const ctx = await launch('full', scheme);
  const shots = process.env.E2E_SHOTS;
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`https://codeforces.com/profile/${mock.OWNER}`);
    await page.waitForSelector('.cfm-hm-select');
    const out = {};
    out.nav = await page.evaluate(() => document.querySelector('[data-cfm-an-nav] a')?.getAttribute('href'));
    const fills = () => page.evaluate(() => Array.from(document.querySelectorAll('#userActivityGraph rect.day')).map((r) => r.getAttribute('fill')));
    out.before = new Set(await fills()).size;
    await page.selectOption('.cfm-hm-select', 'solved');
    page.on('console', (m) => process.env.E2E_DEBUG && console.log('   [console]', m.text()));
    page.on('pageerror', (e) => console.log('   [pageerror]', e.message));
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#userActivityGraph rect.day')).some((r) => r.getAttribute('fill') !== '#EBEDF0' && r.getAttribute('data-cfm-tip')), null, { timeout: 30000 })
      .catch(async (e) => {
        console.log('   status:', await page.evaluate(() => document.querySelector('.cfm-hm-bar .cfm-status')?.textContent));
        throw e;
      });
    out.solvedFills = new Set(await fills()).size;
    out.legend = await page.evaluate(() => document.querySelectorAll('.cfm-hm-legend .cfm-hm-item').length);
    out.tip = await page.evaluate(() => Array.from(document.querySelectorAll('#userActivityGraph rect[data-cfm-tip]')).map((r) => r.getAttribute('data-cfm-tip')).find((t) => /\d+ (solved|resolvidos)/.test(t) && !/^\S+ 0 /.test(t)));
    await page.selectOption('.cfm-hm-select', 'max');
    await page.waitForTimeout(300);
    out.maxLegend = await page.evaluate(() => document.querySelectorAll('.cfm-hm-legend .cfm-hm-item').length);
    if (shots) await page.locator('.cfm-hm-bar').evaluate((n) => n.scrollIntoView());
    if (shots) await page.screenshot({ path: join(root, `e2e-heatmap-${scheme}.png`) });
    await page.selectOption('.cfm-hm-select', 'cf');
    await page.waitForTimeout(300);
    out.restored = new Set(await fills()).size;

    // analytics (visão geral)
    await page.goto(`https://codeforces.com/profile/${mock.OWNER}#hiraku`);
    await page.waitForSelector('.cfm-an-kpis', { timeout: 60000 });
    await page.waitForSelector('.cfm-an-sug .cfm-an-list li a[href^="/problemset/problem/"]', { timeout: 60000 }); // sugestões
    // exportação da pessoa (CSV)
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.cfm-an-head .cfm-an-xbtn:first-of-type')]);
    out.csvName = dl.suggestedFilename();
    out.csv = readFileSync(await dl.path(), 'utf8');
    const [dlj] = await Promise.all([page.waitForEvent('download'), page.click('.cfm-an-head .cfm-an-xbtn:last-of-type')]);
    out.json = JSON.parse(readFileSync(await dlj.path(), 'utf8'));
    out.overview = await page.evaluate(() => ({
      kpis: document.querySelectorAll('.cfm-an-kpi').length,
      solved: document.querySelector('.cfm-an-kpi b')?.textContent,
      cards: Array.from(document.querySelectorAll('.cfm-an-card h3')).map((n) => n.textContent),
      svgs: document.querySelectorAll('.cfm-an svg.cfm-an-svg').length,
      sidebarHidden: getComputedStyle(document.getElementById('sidebar')).display === 'none',
      originalHidden: getComputedStyle(document.getElementById('userbox')).display === 'none',
      trying: Array.from(document.querySelectorAll('.cfm-an-list li a')).map((a) => a.textContent).includes('Pending Problem'),
    }));
    if (shots) await page.screenshot({ path: join(root, `e2e-analytics-${scheme}.png`), fullPage: true });

    // amigos
    await page.click('.cfm-an-tabs button:nth-child(2)');
    await page.waitForFunction((n) => document.querySelectorAll('table.cfm-an-table tbody tr').length === n
      && !document.querySelector('table.cfm-an-table .cfm-an-spin'), mock.FRIENDS.length + 1, { timeout: 90000 });
    out.friends = await page.evaluate(() => ({
      rows: Array.from(document.querySelectorAll('table.cfm-an-table tbody tr')).map((tr) => tr.children[1].textContent.trim()),
      owner: document.querySelectorAll('table.cfm-an-table tr.is-owner').length,
      deltas: document.querySelectorAll('table.cfm-an-table .cfm-an-delta').length,
      chart: document.querySelectorAll('.cfm-an-hrow').length,
      groupKpis: document.querySelectorAll('.cfm-an-kpi').length,
    }));
    const [dlg] = await Promise.all([page.waitForEvent('download'), page.click('.cfm-an-cmpside .cfm-an-xbtn:first-of-type')]);
    out.groupCsv = readFileSync(await dlg.path(), 'utf8');
    if (shots) await page.screenshot({ path: join(root, `e2e-friends-${scheme}.png`), fullPage: true });

    // ordenar por rating (clique no cabeçalho)
    await page.click('table.cfm-an-table th:nth-child(3)');
    out.sorted = await page.evaluate(() => Array.from(document.querySelectorAll('table.cfm-an-table tbody tr')).map((tr) => Number(tr.children[2].textContent) || 0));

    // instituição
    await page.click('.cfm-an-tabs button:nth-child(3)');
    await page.waitForFunction(() => document.querySelectorAll('table.cfm-an-table tbody tr').length >= 4
      && !document.querySelector('table.cfm-an-table .cfm-an-spin'), null, { timeout: 90000 });
    out.org = await page.evaluate(() => ({
      rows: Array.from(document.querySelectorAll('table.cfm-an-table tbody tr')).map((tr) => tr.children[1].textContent.trim()),
      title: document.querySelector('.cfm-an-cmphead h3')?.textContent,
    }));

    // sair do analytics devolve o perfil
    await page.click('.cfm-an-back');
    await page.waitForFunction(() => !document.querySelector('.cfm-an'));
    out.back = await page.evaluate(() => getComputedStyle(document.getElementById('userbox')).display !== 'none' && getComputedStyle(document.getElementById('sidebar')).display !== 'none');

    // página do problema: quem você conhece resolveu (os índices já estão em cache)
    await page.goto(`https://codeforces.com/problemset/problem/${SB.contestId}/${SB.index}`);
    await page.waitForSelector('.cfm-sb[data-state="done"]', { timeout: 120000 });
    out.sb = await page.evaluate(() => ({
      first: document.querySelector('#sidebar > :first-child')?.classList.contains('cfm-sb'),
      you: document.querySelector('.cfm-sb-you')?.className,
      solvers: Array.from(document.querySelectorAll('.cfm-sb-list .cfm-sb-user')).map((a) => a.textContent),
      sections: Array.from(document.querySelectorAll('.cfm-sb-head b')).map((b) => b.textContent),
    }));
    if (shots) await page.screenshot({ path: join(root, `e2e-solvedby-${scheme}.png`) });
    return out;
  } finally {
    await ctx.close();
  }
}

let failed = false;
const check = (name, fn) => {
  try { fn(); console.log('  ✔', name); } catch (e) { failed = true; console.log('  ✖', name, '\n   ', e.message.split('\n')[0]); }
};

try {
  const cssOnly = await run('css-only', 'dark');
  const full = await run('full', 'dark');
  const light = await run('full', 'light');

  console.log(`CSS apenas: ${cssOnly.low.length} textos ruins, ${cssOnly.light.length} caixas claras`);
  console.log(`Completo  : ${full.low.length} textos ruins, ${full.light.length} caixas claras`);
  check('tema escuro foi aplicado', () => assert.equal(full.theme, 'dark'));
  check('sanidade: só com o CSS ainda sobram problemas (o teste enxerga os bugs)', () => assert.ok(cssOnly.low.length + cssOnly.light.length > 0));
  check('motor de contraste: nenhum texto abaixo de 3.9:1', () => assert.deepEqual(full.low, []));
  check('motor de contraste: nenhuma caixa clara sobrando', () => assert.deepEqual(full.light, []));
  check('ícone com fundo claro detectado', () => { assert.equal(full.icons.env, 'light'); assert.equal(full.icons.listicon, 'light'); });
  check('ícone escuro detectado', () => assert.equal(full.icons.folder, 'dark'));
  check('ícone colorido transparente intacto', () => assert.equal(full.icons.star, 'none'));
  check('tema claro: nada é marcado nem alterado', () => {
    assert.equal(light.theme, 'light');
    assert.deepEqual(Object.values(light.icons), [null, null, null, null]);
  });

  const cd = await contest('dark');
  const cl = await contest('light');
  const sameRow = (r) => new Set(r).size === 1;
  check('linhas resolvidas (A–D): TODAS com o mesmo destaque verde, inclusive as pares', () => {
    for (const r of ['rA', 'rB', 'rC', 'rD']) assert.ok(sameRow(cd.rows[r]), `${r} tem células diferentes: ${cd.rows[r]}`);
    const [a, b, c, d] = ['rA', 'rB', 'rC', 'rD'].map((r) => cd.rows[r][0]);
    assert.ok(a === b && b === c && c === d, `cores diferentes: ${[a, b, c, d]}`);
    const [r, g, bl] = a.match(/[\d.]+/g).map(Number);
    assert.ok(g > r && g > bl, `não é esverdeado: ${a}`);
  });
  check('linhas não resolvidas não ficam verdes', () => {
    for (const r of ['rE', 'rF', 'rG']) assert.notEqual(cd.rows[r][0], cd.rows.rA[0]);
  });
  check('linhas resolvidas ganham a barra lateral; as outras não', () => {
    assert.ok(cd.firstShadow.slice(0, 4).every((s) => s !== 'none'), cd.firstShadow.join(' | '));
    assert.equal(cd.firstShadow[4], 'none');
  });
  check('tema claro: resolvidas também uniformes', () => {
    const [a, b, c, d] = ['rA', 'rB', 'rC', 'rD'].map((r) => cl.rows[r][0]);
    assert.ok(a === b && b === c && c === d, `cores diferentes: ${[a, b, c, d]}`);
  });
  check('logo: imagem tratada (sem filtro): fundo transparente, barra amarela intacta, texto claro', () => {
    assert.equal(cd.logo.ready, 'ok');
    assert.match(cd.logo.src, /^data:image\/png/);
    const [bgPx, yellow, black, navy] = cd.logoPx;
    assert.equal(bgPx[3], 0, 'fundo transparente');
    assert.deepEqual(yellow, [255, 190, 0, 255]);
    assert.ok(black[0] > 200 && black[3] === 255, `texto preto não clareou: ${black}`);
    assert.ok(navy[2] > navy[0] && navy[0] + navy[1] + navy[2] > 250, `marinho: ${navy}`);
  });
  check('selo do Telegram: sem fundo branco, círculo e aviãozinho preservados', () => {
    assert.equal(cd.tg.ready, 'ok');
    const [corner, ring, plane] = cd.tgPx;
    assert.equal(corner[3], 0, 'canto transparente');
    assert.deepEqual(ring, [41, 169, 224, 255]);
    assert.deepEqual(plane, [255, 255, 255, 255]);
  });
  check('tema claro: logo e selo originais', () => {
    assert.equal(cl.logo.ready, null);
    assert.match(cl.logo.src, /^https:\/\/codeforces/);
    assert.equal(cl.tg.ready, null);
  });
  check('header: logo, bandeiras e usuário ganham respiro nas bordas', () => {
    for (const c of [cd, cl]) {
      assert.ok(c.logo.left >= 12, `logo encostada (${c.logo.left}px)`);
      assert.ok(c.userRight >= 12, `usuário encostado (${c.userRight}px)`);
      assert.ok(c.flagsRight >= 12, `bandeiras encostadas (${c.flagsRight}px)`);
      assert.ok(c.flagsTop >= 6, `bandeiras coladas no topo (${c.flagsTop}px)`);
    }
  });

  const t = await translation();
  console.log('Tradução ponta a ponta:', t.after.status);
  check('traduz o texto (clique → background → serviço → página)', () => {
    assert.match(t.after.text, /YOU ARE GIVEN AN ARRAY/);
    assert.match(t.after.text, /PRINT THE ANSWER/);
    assert.match(t.after.text, /FIRST ITEM HAS/);
  });
  check('fórmulas: os MESMOS nós, na mesma ordem, e ainda dentro do <b>', () => {
    assert.equal(t.before.ids.length, 9); // 1 prévia + 4 renderizadas + 4 <script>
    assert.deepEqual(t.after.ids, t.before.ids);
    assert.ok(t.after.boldHasMath);
  });
  check('exemplos e links preservados', () => {
    assert.equal(t.after.sampleIn, t.before.sampleIn);
    assert.equal(t.after.href, '/x');
  });
  check('rótulos Entrada / Saída / Exemplo (dicionário pt)', () => assert.deepEqual(t.after.sections, ['Entrada', 'Saída', 'Exemplo']));
  check('barra informa o serviço', () => assert.match(t.after.status, /Translated with Google/));
  check('voltar ao original restaura tudo', () => {
    assert.equal(t.back.text, t.before.text);
    assert.deepEqual(t.back.ids, t.before.ids);
    assert.deepEqual(t.back.sections, t.before.sections);
  });

  const STATS = createRequire(import.meta.url)('../shared/stats.js');
  const expected = STATS.summarize(mock.submissions(mock.OWNER));
  // problema que mais amigos resolveram: é o que a caixa "Quem você conhece" vai mostrar
  const others = [...new Set([...mock.FRIENDS, ...mock.ORG.members.filter((m) => m !== 'ghost404')])].filter((x) => x !== mock.OWNER);
  const idx = Object.fromEntries(others.map((h) => [h, STATS.solvedIndex(STATS.summarize(mock.submissions(h)))]));
  const count = {};
  for (const h of others) for (const [k, v] of Object.entries(idx[h])) if (v > 0) count[k] = (count[k] || 0) + 1;
  const best = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
  globalThis.SB = { key: best, contestId: best.match(/^\d+/)[0], index: best.replace(/^\d+/, ''), solvers: others.filter((h) => idx[h][best] > 0).sort(), you: expected.solvedList.some((p) => p.key === best) };
  for (const scheme of ['dark', 'light']) {
    const a = await analytics(scheme);
    console.log(`Heatmap e analytics (${scheme})`);
    check('menu do topo ganha "Analytics" apontando para o seu perfil', () => assert.equal(a.nav, '/profile/tester#hiraku'));
    check('heatmap: "Problemas resolvidos" recolore os dias (várias intensidades)', () => assert.ok(a.solvedFills >= 4, `só ${a.solvedFills} cores`));
    check('heatmap: legenda da contagem (5 níveis) e da dificuldade (7 ranks)', () => { assert.equal(a.legend, 5); assert.equal(a.maxLegend, 7); });
    check('heatmap: tooltip com resolvidos e envios do dia', () => assert.match(a.tip || '', /solved|resolvidos/));
    check('heatmap: voltar para "Cores do Codeforces" restaura o original', () => assert.equal(a.restored, a.before));
    check('analytics: números, gráficos e o total de resolvidos certo', () => {
      assert.equal(a.overview.solved.replace(/\D/g, ''), String(expected.solved));
      assert.ok(a.overview.svgs >= 4, `${a.overview.svgs} gráficos`);
      assert.ok(a.overview.cards.length >= 9, a.overview.cards.join(', '));
    });
    check('analytics: ocupa a página (sidebar e perfil escondidos) e mostra "tentando agora"', () => {
      assert.ok(a.overview.sidebarHidden && a.overview.originalHidden);
      assert.ok(a.overview.trying);
    });
    check('amigos: você + amigos, sua linha destacada, comparação e gráfico', () => {
      assert.equal(a.friends.rows.length, mock.FRIENDS.length + 1);
      assert.equal(a.friends.owner, 1);
      assert.ok(a.friends.deltas >= mock.FRIENDS.length, `${a.friends.deltas} comparações`);
      assert.equal(a.friends.chart, mock.FRIENDS.length + 1);
    });
    check('amigos: ordenar por rating pelo cabeçalho', () => assert.deepEqual(a.sorted, a.sorted.slice().sort((x, y) => y - x)));
    check('instituição: membros da organização do perfil (handle inexistente descartado)', () => {
      assert.deepEqual(a.org.rows.map((r) => r.replace(/\s*(você|you)$/, '')).sort(), ['alice', 'dave', 'erin', 'tester']);
      assert.match(a.org.title || '', /UFCG/);
    });
    check('voltar ao perfil restaura a página', () => assert.ok(a.back));
    check('analytics 0.6: 12 números e os cartões novos (upsolve, contests, ritmo, tags, semana, horas…)', () => {
      assert.equal(a.overview.kpis, 12);
      assert.ok(a.overview.cards.length >= 17, a.overview.cards.join(', '));
    });
    check('exportar pessoa: CSV dos resolvidos (com BOM) e JSON completo', () => {
      assert.match(a.csvName, /^tester-solved-\d{4}-\d{2}-\d{2}\.csv$/);
      assert.ok(a.csv.startsWith('\ufeffdate,problem,name,rating'));
      assert.equal(a.csv.trim().split('\r\n').length, 1 + expected.solved);
      assert.equal(a.json.handle, 'tester');
      assert.equal(a.json.solved.length, expected.solved);
      assert.ok(a.json.contests.count > 0);
    });
    check('exportar grupo: CSV com você e os amigos + resumo do grupo', () => {
      assert.equal(a.groupCsv.trim().split('\r\n').length, 1 + mock.FRIENDS.length + 1);
      assert.ok(a.friends.groupKpis >= 6);
    });
    check('problema: caixa "Quem você conhece" no topo da sidebar com quem resolveu', () => {
      assert.ok(a.sb.first, 'primeira caixa da sidebar');
      assert.deepEqual(a.sb.solvers.slice().sort(), SB.solvers, JSON.stringify({ sb: a.sb, SB }));
      assert.equal(/is-ok/.test(a.sb.you), SB.you);
    });
  }
} finally {
  server.close();
  rmSync(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
