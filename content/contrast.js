// Motor de contraste (tema escuro).
//
// O CSS do tema cobre os elementos que conhecemos, mas o Codeforces tem
// centenas de páginas e cores "à mão". Este motor olha o resultado final de
// cada elemento (getComputedStyle) e corrige só o que continua ruim:
//   • fundo claro (branco, cinza, pastel)  → escurece
//   • texto sem contraste (preto, azul-marinho…) → clareia, mantendo a matiz
// As mudanças vão em style inline e são registradas, então dá para desfazer
// tudo ao voltar para o tema claro.
(() => {
  'use strict';
  const C = globalThis.CFM_COLOR;
  if (!C || globalThis.CFM_CONTRAST) return;

  const html = document.documentElement;
  const SKIP =
    'script, style, noscript, template, svg, canvas, img, video, iframe, picture, ' +
    '.MathJax, .MathJax_Preview, .MathJax_Display, mjx-container, .cfm-toolbar, [data-cfm-skip]';
  const SKIP_INPUT = /^(checkbox|radio|range|color|hidden|image|file)$/i;
  const SLICE_MS = 12;

  let active = false;
  let changes = [];
  let observer = null;
  let timer = null;
  let runId = 0;
  const queue = new Set();

  function readTheme() {
    const cs = getComputedStyle(html);
    const get = (n) => C.parseColor(cs.getPropertyValue(n).trim());
    const t = { bg: get('--bg'), surface: get('--surface'), surface2: get('--surface-2'), text: get('--text') };
    return t.bg && t.surface && t.surface2 && t.text ? t : null;
  }

  function setProp(el, prop, value) {
    changes.push({ el, prop, prev: el.style.getPropertyValue(prop), prio: el.style.getPropertyPriority(prop) });
    el.style.setProperty(prop, value, 'important');
  }

  const hasDirectText = (el) => {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    return false;
  };

  /** Cor de fundo "efetiva" de um elemento já existente (sobe até achar um fundo opaco). */
  function ancestorBg(el, theme) {
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      const c = C.parseColor(cs.backgroundColor);
      if (c && c.a >= 0.5 && cs.backgroundImage === 'none') return { r: c.r, g: c.g, b: c.b };
    }
    return theme.bg;
  }

  /** Percorre `root` (inclusive) em fatias de ~12 ms para não travar a página. */
  function scan(root, startBg, theme, id) {
    if (!root || !root.isConnected) return;
    if (root.matches && root.matches(SKIP)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => (n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const eff = new WeakMap();
    const parentBg = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (eff.has(p)) return eff.get(p);
      return startBg;
    };

    let node = root;
    const step = () => {
      if (id !== runId || !active) return;
      const t0 = performance.now();
      const writes = [];
      while (node && performance.now() - t0 < SLICE_MS) {
        process(node, writes);
        node = walker.nextNode();
      }
      for (const [el, prop, value] of writes) setProp(el, prop, value);
      if (node) setTimeout(step, 0);
    };

    function process(el, writes) {
      const cs = getComputedStyle(el);
      let bg = parentBg(el);

      const own = C.parseColor(cs.backgroundColor);
      const tagName = el.tagName;
      const isControl = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON';
      // campos de formulário costumam ter só um ícone (lupa…) por cima da cor: dá para escurecer a cor
      const plainBg = cs.backgroundImage === 'none' || (isControl && /^url\(/.test(cs.backgroundImage));
      if (own && own.a >= 0.5 && plainBg) {
        const fixed = C.fixBackground(own, theme.surface, theme.surface2);
        if (!fixed) {
          bg = { r: own.r, g: own.g, b: own.b };
        } else if (!el.firstChild && el.getBoundingClientRect().width <= 14 && el.getBoundingClientRect().height <= 14) {
          writes.push([el, 'background-color', 'transparent']); // cantinhos brancos de tabelas
        } else {
          writes.push([el, 'background-color', C.css(fixed)]);
          bg = fixed;
        }
      }

      const tag = el.tagName;
      const control = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const hasText = control ? !(tag === 'INPUT' && SKIP_INPUT.test(el.type)) : hasDirectText(el);
      if (hasText) {
        const fg = C.parseColor(cs.color);
        const fix = fg && C.fixText(fg, bg);
        if (fix) writes.push([el, 'color', fix.text ? 'var(--text)' : C.css(fix.rgb)]);
      }
      eff.set(el, bg);
    }

    step();
  }

  function fullScan() {
    const theme = readTheme();
    if (!theme || !document.body) return;
    runId++;
    scan(document.body, theme.bg, theme, runId);
  }

  function flushQueue() {
    timer = null;
    if (!active) return;
    const theme = readTheme();
    if (!theme) return;
    const roots = Array.from(queue).filter((n) => n.isConnected);
    queue.clear();
    for (const r of roots) {
      // se um ancestral também está na fila, ele já cobre este
      if (roots.some((o) => o !== r && o.contains(r))) continue;
      scan(r, ancestorBg(r.parentElement || r, theme), theme, runId);
    }
  }

  function observe() {
    if (observer || !document.body) return;
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const n of rec.addedNodes) if (n.nodeType === 1) queue.add(n);
      }
      if (queue.size && !timer) timer = setTimeout(flushQueue, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function revert() {
    for (let i = changes.length - 1; i >= 0; i--) {
      const { el, prop, prev, prio } = changes[i];
      if (prev) el.style.setProperty(prop, prev, prio);
      else el.style.removeProperty(prop);
    }
    changes = [];
  }

  function begin() {
    if (!active) return;
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', begin, { once: true });
      return;
    }
    fullScan();
    observe();
  }

  globalThis.CFM_CONTRAST = {
    start() {
      if (active) return;
      active = true;
      begin();
    },
    stop() {
      if (!active) return;
      active = false;
      runId++;
      if (observer) observer.disconnect();
      observer = null;
      clearTimeout(timer);
      timer = null;
      queue.clear();
      revert();
    },
    /** Reaplica do zero (útil se a paleta mudar). */
    rescan() {
      if (!active) return;
      runId++;
      revert();
      fullScan();
    },
  };
})();
