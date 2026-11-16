// Respiro do cabeçalho: no Codeforces a logo, as bandeiras e o bloco do usuário
// ficam coladas nas bordas do cartão. Em vez de depender das classes do site (que
// mudam), medimos o que está encostado na borda esquerda/direita e marcamos com
// data-cfm-edge; o theme.css aplica a margem (variável --cfm-gutter).
(() => {
  'use strict';
  if (globalThis.CFM_LAYOUT) return;

  const SKIP = '.menu-box, script, style, br, .clear';
  const EDGE = 3; // px de tolerância para "encostado"
  let active = false;
  let tagged = [];
  let timer = null;
  let ro = null;

  function clear() {
    for (const el of tagged) el.removeAttribute('data-cfm-edge');
    tagged = [];
  }

  function tidy() {
    const header = document.getElementById('header');
    if (!active || !header) return;
    clear(); // mede sem as nossas margens, senão o resultado oscila a cada execução
    const hr = header.getBoundingClientRect();
    if (!hr.width) return;

    const walk = (parent, depth) => {
      for (const el of parent.children) {
        if (el.matches(SKIP) || el.closest('.menu-box')) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.width >= hr.width * 0.6) {
          if (depth < 3) walk(el, depth + 1); // faixa larga: olha o que tem dentro
          continue;
        }
        const left = r.left - hr.left;
        const right = hr.right - r.right;
        let flags = '';
        if (right <= EDGE && left > 40) flags = 'r';
        else if (left <= EDGE && right > 40) flags = 'l';
        if (flags === 'r' && r.top - hr.top <= 8) flags += ' t'; // bandeiras no topo
        if (flags) {
          el.setAttribute('data-cfm-edge', flags);
          tagged.push(el); // só o elemento mais externo
        }
      }
    };
    walk(header, 0);
  }

  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(tidy, 120);
  };

  globalThis.CFM_LAYOUT = {
    start() {
      if (active) return;
      active = true;
      const go = () => {
        tidy();
        window.addEventListener('load', later, { once: true });
        window.addEventListener('resize', later);
        const header = document.getElementById('header');
        if (header && typeof ResizeObserver === 'function') {
          ro = new ResizeObserver(later);
          ro.observe(header);
        }
        setTimeout(tidy, 800); // imagens que chegam depois mudam as medidas
      };
      if (document.getElementById('header')) go();
      else document.addEventListener('DOMContentLoaded', go, { once: true });
    },
    stop() {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('resize', later);
      if (ro) ro.disconnect();
      ro = null;
      clear();
    },
  };
})();
