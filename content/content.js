// Content script: aplica o tema e cuida da tradução dos enunciados.
(() => {
  'use strict';
  if (window.__cfmLoaded) return;
  window.__cfmLoaded = true;

  const ext = globalThis.browser ?? globalThis.chrome;
  const D = globalThis.CFM_DEFAULTS;
  const LANGS = globalThis.CFM_LANGS;
  const TEX = globalThis.CFM_TEX;
  const I18N = globalThis.CFM_I18N;
  const html = document.documentElement;
  const mq = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : { matches: false, addEventListener() {} };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let settings = { ...D };
  let T = I18N.make(settings.uiLang);

  /* ===================================================================
   * Tema
   * =================================================================== */

  const FONTS = {
    system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    serif: 'Charter, "Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, "JetBrains Mono", "Fira Code", "SF Mono", Consolas, "Liberation Mono", monospace',
  };

  function onAccent(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#ffffff';
    const n = parseInt(m[1], 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.62 ? '#111827' : '#ffffff';
  }

  function applySettings() {
    const s = settings;
    html.setAttribute('data-cfm', s.enabled ? 'on' : 'off');
    html.setAttribute('data-cfm-theme', s.theme === 'auto' ? (mq.matches ? 'dark' : 'light') : s.theme);
    html.style.setProperty('--cfm-accent', s.accent);
    html.style.setProperty('--cfm-on-accent', onAccent(s.accent));
    html.style.setProperty('--cfm-font', FONTS[s.font] || FONTS.system);
    html.style.setProperty('--cfm-statement-size', `${Number(s.fontSize) || 16}px`);
    T = I18N.make(s.uiLang);
    // qualidade de vida: valem mesmo com o visual desligado
    html.toggleAttribute('data-cfm-hide-tags', !!s.hideTags);
    html.toggleAttribute('data-cfm-hide-solved', !!s.hideSolved);
    syncEngines();
    syncLayout();
    if (globalThis.CFM_STANDINGS) globalThis.CFM_STANDINGS.update(s, T);
    if (globalThis.CFM_HEATMAP) globalThis.CFM_HEATMAP.update(s, T);
    if (globalThis.CFM_ANALYTICS) globalThis.CFM_ANALYTICS.update(s, T);
  }

  // Motor de contraste e tratamento de ícones: só no tema escuro.
  let enginesOn = false;
  function syncEngines() {
    const dark = settings.enabled && html.getAttribute('data-cfm-theme') === 'dark';
    if (dark === enginesOn) return;
    enginesOn = dark;
    const engines = [globalThis.CFM_CONTRAST, globalThis.CFM_BRAND, globalThis.CFM_ICONS];
    for (const e of engines) if (e) dark ? e.start() : e.stop();
  }

  // Respiro do cabeçalho: vale nos dois temas, só não com o visual desligado.
  let layoutOn = false;
  function syncLayout() {
    const on = !!settings.enabled;
    if (on === layoutOn) return;
    layoutOn = on;
    const l = globalThis.CFM_LAYOUT;
    if (l) on ? l.start() : l.stop();
  }

  async function loadSettings() {
    try {
      settings = { ...D, ...(await ext.storage.local.get(D)) };
    } catch (e) {
      /* usa os padrões */
    }
    applySettings();
  }

  applySettings(); // padrões já no document_start, evita "piscar"
  const settingsReady = loadSettings();

  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const k of Object.keys(changes)) if (k in D) settings[k] = changes[k].newValue ?? D[k];
    applySettings();
    refreshToolbar();
  });
  if (mq.addEventListener) mq.addEventListener('change', applySettings);

  /* ===================================================================
   * Tradução — leitura do DOM
   * =================================================================== */

  const BLOCK = new Set([
    'P', 'DIV', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'BLOCKQUOTE',
    'CENTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE', 'FIGURE', 'FIGCAPTION', 'DL',
    'DT', 'DD', 'HR', 'PRE',
  ]);
  const ATOM_TAGS = new Set([
    'IMG', 'BR', 'WBR', 'CODE', 'TT', 'KBD', 'SAMP', 'SVG', 'INPUT', 'BUTTON', 'SELECT', 'CANVAS',
    'VIDEO', 'AUDIO', 'IFRAME',
  ]);
  // Blocos que nunca entram na tradução de texto corrido.
  const SKIP_SEL =
    'pre, script, style, noscript, textarea, .sample-tests, .header, .section-title, ' +
    '.input-output-copier, .cfm-toolbar, [translate="no"], .cfm-skip';
  const ATOM_SEL = '.tex-span, [translate="no"], .cfm-skip, .input-output-copier';
  const BLOCK_DESC = 'p, div, ul, ol, li, table, pre, blockquote, h1, h2, h3, h4, h5, h6';

  const isEl = (n) => n.nodeType === 1;
  const clsOf = (n) => n.getAttribute('class') || '';

  // Fórmulas já renderizadas pelo MathJax (v2: .MathJax/.MathJax_Preview/<script type=math/tex>;
  // v3: <mjx-container class="MathJax">).
  function isMath(n) {
    if (!isEl(n)) return false;
    const tag = n.tagName.toUpperCase();
    if (tag === 'SCRIPT') return /^math\/tex/i.test(n.getAttribute('type') || '');
    if (tag.startsWith('MJX-')) return true;
    return /(^|\s)(MathJax|MJX|mjx-)/.test(clsOf(n));
  }
  const isAtomEl = (n) => ATOM_TAGS.has(n.tagName.toUpperCase()) || n.matches(ATOM_SEL);

  /**
   * Transforma uma sequência de nós irmãos (um "trecho" de texto corrido) em
   * partes protegidas. Ver shared/tex-protect.js.
   */
  function buildRun(container, nodes) {
    const atoms = new Map(); // id -> { nodes } | { text }
    const wrappers = new Map(); // id -> elemento original (só os atributos importam)
    const parts = [];
    let seq = 0;

    const addText = (s) => {
      const v = s.replace(/\s+/g, ' ');
      if (v) parts.push({ t: 'text', v });
    };

    const walk = (list) => {
      for (let i = 0; i < list.length; i++) {
        const n = list[i];
        if (n.nodeType === 3) {
          for (const seg of TEX.splitTex(n.nodeValue)) {
            if (seg.t === 'text') addText(seg.v);
            else {
              const id = seq++;
              atoms.set(id, { text: seg.v }); // $$$…$$$ que o MathJax não renderizou
              parts.push({ t: 'atom', id });
            }
          }
        } else if (isEl(n)) {
          if (isMath(n)) {
            // pré-visualização + fórmula renderizada + <script> viram um único átomo
            const group = [n];
            while (i + 1 < list.length && isEl(list[i + 1]) && isMath(list[i + 1])) group.push(list[++i]);
            const id = seq++;
            atoms.set(id, { nodes: group });
            parts.push({ t: 'atom', id });
          } else if (isAtomEl(n)) {
            const id = seq++;
            atoms.set(id, { nodes: [n] });
            parts.push({ t: 'atom', id });
          } else {
            const id = seq++;
            wrappers.set(id, n);
            parts.push({ t: 'open', id });
            walk(Array.from(n.childNodes).filter((c) => c.nodeType !== 8));
            parts.push({ t: 'close', id });
          }
        }
      }
    };

    walk(nodes);
    if (!TEX.hasLetters(parts)) return null;
    return { container, nodes: nodes.slice(), parts, atoms, wrappers, trans: null, shown: 'orig', failed: false };
  }

  /** Percorre um contêiner juntando nós inline consecutivos em "trechos". */
  function collectRuns(container, runs) {
    let cur = [];
    const flush = () => {
      if (cur.length) {
        const run = buildRun(container, cur);
        if (run) runs.push(run);
        cur = [];
      }
    };
    for (const n of Array.from(container.childNodes)) {
      if (n.nodeType === 3) {
        cur.push(n);
      } else if (isEl(n)) {
        if (isMath(n)) {
          cur.push(n);
        } else if (BLOCK.has(n.tagName.toUpperCase()) || (!isAtomEl(n) && n.querySelector(BLOCK_DESC))) {
          flush();
          if (!n.matches(SKIP_SEL)) collectRuns(n, runs);
        } else {
          cur.push(n); // inline (ou átomo inline)
        }
      }
      // comentários ficam onde estão
    }
    flush();
  }

  /** Troca o conteúdo de um trecho pelas partes dadas, reaproveitando os nós de fórmula. */
  function replaceRun(run, parts) {
    const anchor = run.nodes[0];
    if (!anchor || !anchor.parentNode) return;
    const parent = anchor.parentNode;
    const marker = document.createComment('cfm');
    parent.insertBefore(marker, anchor);

    const frag = document.createDocumentFragment();
    const stack = [frag];
    const reused = new Set();
    for (const p of parts) {
      const cur = stack[stack.length - 1];
      if (p.t === 'text') {
        cur.appendChild(document.createTextNode(p.v));
      } else if (p.t === 'atom') {
        const a = run.atoms.get(p.id);
        if (a.nodes) {
          for (const n of a.nodes) {
            cur.appendChild(n); // move o nó: a fórmula renderizada continua a mesma
            reused.add(n);
          }
        } else {
          cur.appendChild(document.createTextNode(a.text));
        }
      } else if (p.t === 'open') {
        const el = run.wrappers.get(p.id).cloneNode(false);
        cur.appendChild(el);
        stack.push(el);
      } else {
        stack.pop();
      }
    }

    const fresh = Array.from(frag.childNodes);
    parent.insertBefore(frag, marker);
    for (const n of run.nodes) if (!reused.has(n) && n.parentNode === parent) parent.removeChild(n);
    parent.removeChild(marker);
    run.nodes = fresh;
  }

  /* ---------- rótulos curtos (Input/Output, limites, título) ---------- */

  const firstText = (el) => {
    for (const c of el.childNodes) if (c.nodeType === 3 && c.nodeValue.trim()) return c;
    return null;
  };

  function collectLabels(roots) {
    const out = [];
    const add = (node, kind) => node && out.push({ node, orig: node.nodeValue, kind, trans: null });
    for (const root of roots) {
      root.querySelectorAll('.section-title, .sample-test .title').forEach((el) => add(firstText(el), 'section'));
      root.querySelectorAll('.property-title').forEach((el) => add(firstText(el), 'prop'));
      root.querySelectorAll('.time-limit, .memory-limit, .input-file, .output-file').forEach((el) => {
        for (const c of el.childNodes) if (c.nodeType === 3 && c.nodeValue.trim()) add(c, 'value');
      });
      root.querySelectorAll('.header .title').forEach((el) => add(firstText(el), 'title'));
    }
    return out;
  }

  const DICT = {
    pt: {
      section: {
        input: 'Entrada', output: 'Saída', example: 'Exemplo', examples: 'Exemplos', note: 'Observação',
        notes: 'Observações', interaction: 'Interação', scoring: 'Pontuação', explanation: 'Explicação',
        'sample input': 'Entrada de exemplo', 'sample output': 'Saída de exemplo', hack: 'Hack', hacks: 'Hacks',
      },
      prop: {
        'time limit per test': 'limite de tempo por teste', 'memory limit per test': 'limite de memória por teste',
        input: 'entrada', output: 'saída',
      },
      value: [
        [/standard input/i, 'entrada padrão'],
        [/standard output/i, 'saída padrão'],
        [/(\d+(?:\.\d+)?)\s+seconds?/i, (m, n) => `${n} ${Number(n) === 1 ? 'segundo' : 'segundos'}`],
      ],
    },
    es: {
      section: {
        input: 'Entrada', output: 'Salida', example: 'Ejemplo', examples: 'Ejemplos', note: 'Nota',
        notes: 'Notas', interaction: 'Interacción', scoring: 'Puntuación', explanation: 'Explicación',
        'sample input': 'Entrada de ejemplo', 'sample output': 'Salida de ejemplo', hack: 'Hack', hacks: 'Hacks',
      },
      prop: {
        'time limit per test': 'límite de tiempo por prueba', 'memory limit per test': 'límite de memoria por prueba',
        input: 'entrada', output: 'salida',
      },
      value: [
        [/standard input/i, 'entrada estándar'],
        [/standard output/i, 'salida estándar'],
        [/(\d+(?:\.\d+)?)\s+seconds?/i, (m, n) => `${n} ${Number(n) === 1 ? 'segundo' : 'segundos'}`],
      ],
    },
  };

  function dictLabel(l, lang) {
    const d = DICT[lang];
    if (!d) return null;
    if (l.kind === 'value') {
      let out = l.orig;
      for (const [re, rep] of d.value) out = out.replace(re, rep);
      return out !== l.orig ? out : null;
    }
    const table = d[l.kind];
    const hit = table && table[l.orig.trim().toLowerCase()];
    return hit ? l.orig.replace(l.orig.trim(), hit) : null;
  }

  /* ===================================================================
   * Tradução — chamadas ao background
   * =================================================================== */

  async function bg(msg) {
    try {
      return (await ext.runtime.sendMessage(msg)) ?? { ok: false, error: T('noResponse') };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  const modeFor = (engine) => (engine === 'deepl' ? 'xml' : 'tok');

  /** Envia um texto (quebrado em pedaços se for longo) e junta a resposta. */
  async function requestText(text, engine, lang, tags) {
    const max = engine === 'deepl' ? 4500 : 1500;
    let out = '';
    for (const c of TEX.chunk(text, max)) {
      const r = await bg({ type: 'translate', engine, lang, text: c, tags });
      if (!r.ok) return r;
      out = out ? `${out} ${r.text}` : r.text;
    }
    return { ok: true, text: out };
  }

  const wrapSpace = (s, lead, trail) => (lead || '') + s + (trail || '');

  /** Plano B: traduz só os pedaços de texto, um a um, sem marcadores. */
  async function translateSegments(run, engine, lang) {
    const out = [];
    for (const p of run.parts) {
      if (p.t === 'text' && /\p{L}{2,}/u.test(p.v)) {
        const lead = p.v.match(/^\s*/)[0];
        const trail = p.v.match(/\s*$/)[0];
        const r = await requestText(p.v.trim(), engine, lang, 'none');
        if (!r.ok) return r;
        out.push({ t: 'text', v: wrapSpace(r.text, lead, trail) });
      } else {
        out.push(p);
      }
    }
    return { ok: true, parts: out, degraded: true };
  }

  async function translateRun(run, engine, lang) {
    const mode = modeFor(engine);
    const enc = TEX.encode(run.parts, mode);
    const lead = enc.match(/^\s*/)[0];
    const trail = enc.match(/\s*$/)[0];

    const r = await requestText(enc.trim(), engine, lang, mode === 'xml' ? 'xml' : 'none');
    if (!r.ok) return r;

    const dec = TEX.decode(r.text, run.parts, mode);
    if (dec) {
      if (lead) dec.unshift({ t: 'text', v: lead });
      if (trail) dec.push({ t: 'text', v: trail });
      return { ok: true, parts: dec };
    }
    return translateSegments(run, engine, lang); // marcadores vieram quebrados
  }

  async function pool(items, size, fn) {
    let i = 0;
    await Promise.all(
      Array.from({ length: Math.min(size, items.length) }, async () => {
        while (i < items.length) await fn(items[i++]);
      })
    );
  }

  /* ===================================================================
   * Tradução — estado e fluxo
   * =================================================================== */

  const state = { roots: [], runs: null, labels: null, mode: 'orig', busy: false, key: null, done: 0, total: 0, note: '' };
  const currentKey = () => `${settings.engine}:${settings.targetLang}`;

  function findRoots() {
    let roots = Array.from(document.querySelectorAll('.problem-statement'));
    if (!roots.length) roots = Array.from(document.querySelectorAll('.topic .ttypography'));
    return roots;
  }

  function hasRawTex(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement && n.parentElement.closest('pre, script, style, code, textarea')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    while (w.nextNode()) if (w.currentNode.nodeValue.includes('$$$')) return true;
    return false;
  }

  /** Espera o MathJax terminar de desenhar as fórmulas (senão a página ainda tem $$$). */
  async function waitForMath() {
    const limit = Number(settings.mathWaitMs) || 6000;
    const t0 = Date.now();
    while (Date.now() - t0 < limit) {
      if (!state.roots.some(hasRawTex)) {
        await sleep(150);
        if (!state.roots.some(hasRawTex)) return;
      }
      await sleep(200);
    }
  }

  function show(which) {
    for (const run of state.runs || []) {
      const target = which === 'trans' && run.trans ? 'trans' : 'orig';
      if (run.shown !== target) {
        replaceRun(run, target === 'trans' ? run.trans : run.parts);
        run.shown = target;
      }
    }
    for (const l of state.labels || []) l.node.nodeValue = which === 'trans' && l.trans != null ? l.trans : l.orig;
    state.mode = which;
    refreshToolbar();
  }

  async function translateLabels(engine, lang) {
    // 1) dicionário local (pt/es) — instantâneo e sem rede
    const pending = [];
    for (const l of state.labels) {
      l.trans = dictLabel(l, lang);
      // 2) o que o dicionário não cobre (títulos, outros idiomas) vai ao tradutor
      if (l.trans == null && l.kind !== 'value') pending.push(l);
    }
    const cache = new Map(); // mesmo texto (ex.: "Input" repetido) só é pedido uma vez
    await pool(pending, 3, async (l) => {
      const prefix = l.kind === 'title' ? (l.orig.match(/^\s*[A-Z]\d?\.\s*/) || [''])[0] : '';
      const text = l.orig.slice(prefix.length).trim();
      if (!text) return;
      if (!cache.has(text)) cache.set(text, requestText(text, engine, lang, 'none'));
      const r = await cache.get(text);
      if (r.ok) l.trans = prefix + r.text;
    });
  }

  async function translate() {
    if (state.busy || !state.roots.length) return;
    const engine = settings.engine;
    const lang = settings.targetLang;
    const key = currentKey();

    if (state.key === key && state.runs && state.runs.every((r) => r.trans || r.failed)) {
      show('trans'); // já traduzido com essas opções: instantâneo
      return;
    }

    state.busy = true;
    state.note = '';
    state.done = 0;
    state.total = 0;
    refreshToolbar(T('preparing'));

    try {
      await waitForMath();
      if (!state.runs) {
        state.runs = [];
        for (const root of state.roots) collectRuns(root, state.runs);
        state.labels = collectLabels(state.roots);
      }
      for (const r of state.runs) {
        r.trans = null;
        r.failed = false;
      }
      state.total = state.runs.length;
      refreshToolbar();

      let fatal = null;
      let firstError = '';
      await pool(state.runs, 3, async (run) => {
        if (fatal) return;
        const res = await translateRun(run, engine, lang);
        if (res.ok) {
          run.trans = res.parts;
          run.degraded = !!res.degraded;
          replaceRun(run, run.trans); // aparece aos poucos
          run.shown = 'trans';
        } else {
          run.failed = true;
          firstError = firstError || res.error;
          if (res.fatal) fatal = res.error;
        }
        state.done++;
        refreshToolbar();
      });

      const ok = state.runs.filter((r) => r.trans).length;
      if (!ok) {
        state.note = T('failed', { error: fatal || firstError || T('unknownError') });
        state.mode = 'orig';
      } else {
        await translateLabels(engine, lang);
        state.key = key;
        const failed = state.runs.filter((r) => r.failed).length;
        const degraded = state.runs.filter((r) => r.degraded).length;
        const bits = [];
        if (failed) bits.push(T('keptOriginal', { n: failed }));
        if (degraded) bits.push(T('simpleMode', { n: degraded }));
        state.note = bits.join(' · ');
        show('trans');
      }
    } catch (e) {
      state.note = T('unexpected', { error: e.message || e });
    } finally {
      state.busy = false;
      refreshToolbar();
    }
  }

  async function toggle() {
    if (state.busy || !state.roots.length) return;
    if (state.mode === 'trans' && currentKey() === state.key) show('orig');
    else await translate();
  }

  /* ===================================================================
   * Barra de ferramentas
   * =================================================================== */

  let ui = null;

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const kid of kids) el.append(kid);
    return el;
  }

  function globeIcon() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    for (const [tag, a] of [
      ['circle', { cx: 12, cy: 12, r: 9 }],
      ['path', { d: 'M3 12h18' }],
      ['path', { d: 'M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z' }],
    ]) {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
      svg.appendChild(e);
    }
    return svg;
  }

  function buildToolbar() {
    const btnLabel = h('span', {}, T('translate'));
    const btn = h('button', { class: 'cfm-btn', type: 'button', onclick: toggle }, globeIcon(), btnLabel);
    const select = h('select', {
      class: 'cfm-lang',
      title: T('targetLangTitle'),
      onchange: (e) => ext.storage.local.set({ targetLang: e.target.value }),
    });
    for (const l of LANGS) select.append(h('option', { value: l.code }, l.name));
    const status = h('span', { class: 'cfm-status' });
    const bar = h('div', { class: 'cfm-bar' });
    const mark = globalThis.CFM_MARK ? globalThis.CFM_MARK() : '';
    const el = h('div', { class: 'cfm-toolbar', translate: 'no', title: '' }, mark, btn, select, status, bar);
    return { el, btn, btnLabel, select, status, bar };
  }

  function refreshToolbar(message) {
    if (!ui) return;
    if (ui.select.value !== settings.targetLang) ui.select.value = settings.targetLang;
    ui.select.title = T('targetLangTitle');
    ui.select.disabled = state.busy;
    ui.btn.disabled = state.busy;
    ui.btn.classList.toggle('is-active', state.mode === 'trans' && !state.busy);

    const engineName = settings.engine === 'deepl' ? 'DeepL' : 'Google';
    let label = T('translate');
    let status = '';
    if (state.busy) {
      label = state.total ? T('translating', { done: state.done, total: state.total }) : T('preparing');
      status = message || '';
    } else if (state.mode === 'trans') {
      const stale = currentKey() !== state.key;
      label = stale ? T('translateAgain') : T('showOriginal');
      status = stale ? T('optionsChanged') : T('translatedWith', { engine: engineName });
      if (state.note && !stale) status += ` · ${state.note}`;
    } else {
      status = state.note || T('idleStatus', { engine: engineName, lang: settings.targetLang });
    }
    ui.btnLabel.textContent = label;
    ui.status.textContent = status;
    ui.status.title = status;
    ui.bar.style.width = state.busy && state.total ? `${Math.round((state.done / state.total) * 100)}%` : '0';
  }

  function mountToolbar() {
    if (!state.roots.length || ui) return;
    ui = buildToolbar();
    const first = state.roots[0];
    first.parentNode.insertBefore(ui.el, first);
    refreshToolbar();
  }

  /* ===================================================================
   * Mensagens (popup / atalho) e inicialização
   * =================================================================== */

  ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return false;
    if (msg.type === 'cfm-toggle') {
      toggle().then(() => sendResponse({ ok: true, mode: state.mode }));
      return true;
    }
    if (msg.type === 'cfm-ping') {
      sendResponse({ ok: true, hasStatement: state.roots.length > 0, mode: state.mode, busy: state.busy });
      return false;
    }
    return false;
  });

  async function init() {
    await settingsReady;
    state.roots = findRoots();
    mountToolbar();
    if (state.roots.length && settings.autoTranslate) translate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
