// Ícones pequenos com fundo claro/cinza (viram "quadradinhos brancos" no tema
// escuro) ou desenhados em preto (somem). O background baixa a imagem, olha os
// pixels e diz como tratá-la; aqui só marcamos o <img> com data-cfm-icon e o
// CSS faz o resto.
(() => {
  'use strict';
  if (globalThis.CFM_ICONS) return;
  const ext = globalThis.browser ?? globalThis.chrome;

  const MAX = 64; // só ícones: até 64 px
  const SKIP_SRC = /flag|userpic|avatar|titlephoto|\.svg(\?|$)/i;
  const SKIP_PARENT =
    '.problem-statement, .ttypography, .MathJax, .MathJax_Preview, mjx-container, .cfm-toolbar, [data-cfm-skip]';
  const HOSTS = /(^|\.)(codeforces\.(org|com)|codeforc\.es)$/i;

  let active = false;
  let observer = null;
  const cache = new Map(); // url -> Promise<'light'|'dark'|'none'>

  function classify(url) {
    if (!cache.has(url)) {
      cache.set(
        url,
        (async () => {
          try {
            const r = await ext.runtime.sendMessage({ type: 'cfm-icon', url });
            return (r && r.mode) || 'none';
          } catch (e) {
            return 'none';
          }
        })()
      );
    }
    return cache.get(url);
  }

  function consider(img) {
    if (!active || img.dataset.cfmIcon !== undefined) return;
    const src = img.currentSrc || img.src;
    if (!src || !/^https:/i.test(src) || SKIP_SRC.test(src) || img.closest(SKIP_PARENT)) return;
    let host = '';
    try { host = new URL(src).hostname; } catch (e) { return; }
    if (!HOSTS.test(host)) return;

    const run = () => {
      if (!active || img.dataset.cfmIcon !== undefined) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h || w > MAX || h > MAX) return;
      img.dataset.cfmIcon = 'pending';
      classify(src).then((mode) => {
        if (mode === 'light' || mode === 'dark') img.dataset.cfmIcon = mode;
        else img.dataset.cfmIcon = 'none';
      });
    };
    if (img.complete) run();
    else img.addEventListener('load', run, { once: true });
  }

  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.tagName === 'IMG') consider(root);
    else root.querySelectorAll('img').forEach(consider);
  }

  globalThis.CFM_ICONS = {
    start() {
      if (active) return;
      active = true;
      const go = () => {
        if (!active) return;
        scan(document.body);
        observer = new MutationObserver((records) => {
          for (const rec of records) for (const n of rec.addedNodes) scan(n);
        });
        observer.observe(document.body, { childList: true, subtree: true });
      };
      if (document.body) go();
      else document.addEventListener('DOMContentLoaded', go, { once: true });
    },
    stop() {
      active = false;
      if (observer) observer.disconnect();
      observer = null;
    },
  };
})();
