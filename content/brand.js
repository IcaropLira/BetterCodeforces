// Logo do Codeforces e selo do patrocinador (Telegram) no tema escuro.
//
// Em vez de aplicar filtros CSS (que distorcem as cores), o background baixa a
// imagem, tira o fundo branco e clareia só a tinta escura (shared/color.js →
// recolorBrand). Aqui só achamos as <img>, pedimos a versão tratada e trocamos
// o src; ao sair do tema escuro o original é restaurado.
(() => {
  'use strict';
  if (globalThis.CFM_BRAND) return;
  const ext = globalThis.browser ?? globalThis.chrome;

  const LOGO = '#header a[href="/"] img, #header .logo img';
  const BADGE = '#footer img, .sponsor img, a[href*="telegram" i] img, a[href*="t.me/" i] img';
  const HOSTS = /(^|\.)(codeforces\.(org|com)|codeforc\.es)$/i;

  let active = false;
  let observer = null;

  async function treat(img, mode) {
    const src = img.currentSrc || img.src;
    let host = '';
    try { host = new URL(src).hostname; } catch (e) { return; }
    if (!/^https:/i.test(src) || !HOSTS.test(host)) return;

    img.dataset.cfmBrand = mode; // já marca: o motor de ícones não mexe nesta imagem
    img.dataset.cfmOrigSrc = src;
    if (img.hasAttribute('srcset')) img.dataset.cfmOrigSrcset = img.getAttribute('srcset');

    let res = null;
    try {
      res = await Promise.race([
        ext.runtime.sendMessage({ type: 'cfm-brand', url: src, mode }),
        new Promise((resolve) => setTimeout(resolve, 5000)), // não deixa a imagem escondida para sempre
      ]);
    } catch (e) { /* cai no plano B */ }
    if (!active || !img.isConnected || img.dataset.cfmBrand !== mode) return;
    if (res && res.ok && res.dataUrl) {
      img.removeAttribute('srcset');
      img.src = res.dataUrl;
      img.dataset.cfmReady = 'ok';
    } else {
      img.dataset.cfmReady = 'fail'; // o CSS usa um filtro simples como reserva
    }
  }

  function scan(root) {
    if (!active || !root || root.nodeType !== 1) return;
    const pick = (sel) => (root.matches(sel) ? [root] : []).concat(Array.from(root.querySelectorAll(sel)));
    const logos = new Set(pick(LOGO));
    const badges = pick(BADGE).filter((img) => !logos.has(img));
    for (const img of logos) if (img.dataset.cfmBrand === undefined) treat(img, 'logo');
    for (const img of badges) if (img.dataset.cfmBrand === undefined) treat(img, 'badge');
  }

  function restore() {
    for (const img of document.querySelectorAll('img[data-cfm-brand]')) {
      if (img.dataset.cfmOrigSrcset) img.setAttribute('srcset', img.dataset.cfmOrigSrcset);
      if (img.dataset.cfmOrigSrc && img.src !== img.dataset.cfmOrigSrc) img.src = img.dataset.cfmOrigSrc;
      for (const k of ['cfmBrand', 'cfmReady', 'cfmOrigSrc', 'cfmOrigSrcset']) delete img.dataset[k];
    }
  }

  globalThis.CFM_BRAND = {
    start() {
      if (active) return;
      active = true;
      const go = () => {
        if (!active) return;
        scan(document.documentElement);
        observer = new MutationObserver((records) => {
          for (const rec of records) for (const n of rec.addedNodes) scan(n);
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
      };
      if (document.body) go();
      else document.addEventListener('DOMContentLoaded', go, { once: true });
    },
    stop() {
      active = false;
      if (observer) observer.disconnect();
      observer = null;
      restore();
    },
  };
})();
