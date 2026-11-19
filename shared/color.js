// Matemática de cores usada pelo "motor de contraste" (content/contrast.js)
// e pela análise de ícones (background.js). Funções puras, testadas em test/.
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.CFM_COLOR = lib;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const alphaOf = (s) => {
    if (s === undefined || s === null || s === '') return 1;
    return s.endsWith('%') ? clamp(parseFloat(s) / 100, 0, 1) : clamp(parseFloat(s), 0, 1);
  };

  /** Aceita #rgb, #rrggbb, #rrggbbaa, rgb()/rgba() (vírgulas ou espaços) e color(srgb …). */
  function parseColor(input) {
    if (!input) return null;
    const str = String(input).trim().toLowerCase();
    if (str === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

    let m = /^#([0-9a-f]{3,8})$/.exec(str);
    if (m) {
      let h = m[1];
      if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
      if (h.length !== 6 && h.length !== 8) return null;
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    }

    m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(str);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: alphaOf(m[4]) };

    m = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/.exec(str);
    if (m) return { r: +m[1] * 255, g: +m[2] * 255, b: +m[3] * 255, a: alphaOf(m[4]) };

    return null;
  }

  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  /** Luminância relativa (WCAG), 0 = preto, 1 = branco. */
  const luminance = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);

  /** Razão de contraste (WCAG), de 1 a 21. */
  function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  const chroma = (c) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);

  function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h, s, l };
  }

  function hslToRgb(h, s, l) {
    if (s === 0) {
      const v = Math.round(l * 255);
      return { r: v, g: v, b: v };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return { r: Math.round(f(h + 1 / 3) * 255), g: Math.round(f(h) * 255), b: Math.round(f(h - 1 / 3) * 255) };
  }

  /** Mistura: `w` = peso de `a` (0..1). */
  const mix = (a, b, w) => ({
    r: Math.round(a.r * w + b.r * (1 - w)),
    g: Math.round(a.g * w + b.g * (1 - w)),
    b: Math.round(a.b * w + b.b * (1 - w)),
  });

  const css = (c) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;

  /**
   * Tema escuro: um fundo claro precisa escurecer.
   *  - branco/cinza claro  → superfície elevada do tema
   *  - pastel (verde, amarelo…) → a mesma matiz, mas bem escura
   * Devolve null se o fundo pode ficar como está.
   */
  function fixBackground(bg, surface, surface2) {
    if (!bg || bg.a < 0.5) return null;
    if (luminance(bg) <= 0.55) return null;
    if (chroma(bg) < 16) return { r: surface2.r, g: surface2.g, b: surface2.b };
    return mix(bg, surface, 0.2);
  }

  /**
   * Texto com pouco contraste sobre `bg`.
   *  - null                → está bom
   *  - { text: true }      → usar a cor de texto do tema (preto ou cinza quase preto)
   *  - { rgb }             → mesma matiz, mais clara (mantém verde, azul, violeta… dos ratings)
   */
  function fixText(fg, bg) {
    if (!fg || fg.a < 0.35) return null;
    if (contrast(fg, bg) >= 4) return null;
    if (luminance(bg) > 0.35) return null; // fundo ainda claro: clarear o texto só pioraria
    const { h, s, l } = rgbToHsl(fg);
    // preto / cinza muito escuro vira a cor de texto padrão do tema
    if (chroma(fg) < 45 && l < 0.3) return { text: true };
    // o resto (cinzas médios, azuis, verdes…) só clareia, mantendo a matiz e a hierarquia
    for (let x = l; x <= 0.92; x += 0.02) {
      const c = hslToRgb(h, s, x);
      if (contrast(c, bg) >= 4.8) return { rgb: c };
    }
    return { text: true };
  }

  /**
   * Olha os pixels RGBA de um ícone pequeno e decide como ele se comporta no escuro:
   *  'light' → tem fundo opaco claro/cinza (vira "quadradinho branco")
   *  'dark'  → desenho preto sobre transparente (some no escuro)
   *  'none'  → está ok
   */
  function classifyIcon(data, w, h) {
    if (!w || !h || data.length < w * h * 4) return 'none';
    let edge = 0;
    let edgeOpaque = 0;
    let edgeLum = 0;
    let opaque = 0;
    let lumSum = 0;
    let chromaSum = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const a = data[i + 3];
        const px = { r: data[i], g: data[i + 1], b: data[i + 2] };
        const onEdge = x < 2 || y < 2 || x >= w - 2 || y >= h - 2;
        if (onEdge) {
          edge++;
          if (a >= 230) {
            edgeOpaque++;
            edgeLum += luminance(px);
          }
        }
        if (a >= 128) {
          opaque++;
          lumSum += luminance(px);
          chromaSum += chroma(px);
        }
      }
    }
    if (edge && edgeOpaque / edge >= 0.8 && edgeLum / edgeOpaque >= 0.45) return 'light';
    if (opaque >= w * h * 0.08 && lumSum / opaque < 0.2 && chromaSum / opaque < 40) return 'dark';
    return 'none';
  }

  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  /**
   * Um pixel da logo no tema escuro.
   * Cores vivas e opacas (as barras amarela/azul/vermelha) ficam como estão.
   * O resto passa por "color to alpha" contra o branco: o branco some (inclusive o
   * miolo das letras, que o flood fill não alcança), o cinza do antisserrilhado vira
   * tinta com alfa parcial (sem contorno cinza em volta das letras) e a tinta escura
   * resultante é clareada mantendo a matiz.
   */
  function logoPixel(data, p, a, target) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    if (chroma({ r, g, b }) >= 120) return; // cor viva: intacta
    const k = Math.max(255 - r, 255 - g, 255 - b) / 255; // quanto o pixel "não é branco"
    if (k < 0.02) {
      data[p + 3] = 0;
      return;
    }
    const pure = { r: 255 - (255 - r) / k, g: 255 - (255 - g) / k, b: 255 - (255 - b) / k };
    const { h: hue, s, l } = rgbToHsl(pure);
    const dark = 1 - smooth(0.3, 0.42, l); // 1 = tinta escura, 0 = cor clara
    const lit = s < 0.12 ? target : hslToRgb(hue, s, Math.min(0.9, Math.max(0.68, 1 - l)));
    data[p] = Math.round(pure.r * (1 - dark) + lit.r * dark);
    data[p + 1] = Math.round(pure.g * (1 - dark) + lit.g * dark);
    data[p + 2] = Math.round(pure.b * (1 - dark) + lit.b * dark);
    data[p + 3] = Math.round(a * k);
  }

  /**
   * Adapta ao tema escuro uma imagem "de marca" (logo do site, selo do patrocinador),
   * alterando os pixels RGBA em `data` (Uint8ClampedArray de w×h).
   *
   *  1. Fundo: pixels claros e neutros ligados à borda (flood fill) ficam transparentes.
   *     O que está cercado por cor (o aviãozinho branco do Telegram) é preservado.
   *  2. Franja: pixels de borda misturados com o branco do fundo perdem opacidade,
   *     para não sobrar um "halo" claro em volta do desenho.
   *  3. mode 'logo': todo o branco some (color to alpha, ver logoPixel), a tinta escura
   *     (texto preto, azul-marinho…) clareia mantendo a matiz e as cores vivas ficam intactas.
   *     mode 'badge': só o fundo é removido.
   *
   * `ink` = cor do texto quando a tinta é cinza/preta (padrão: texto do tema escuro).
   */
  function recolorBrand(data, w, h, mode, ink) {
    if (!w || !h || data.length < w * h * 4) return data;
    const target = ink || { r: 236, g: 230, b: 247 }; // --text do tema escuro
    const n = w * h;
    const backdrop = (i) => {
      const a = data[i * 4 + 3];
      if (a < 16) return true;
      const px = { r: data[i * 4], g: data[i * 4 + 1], b: data[i * 4 + 2] };
      return a >= 200 && chroma(px) < 24 && luminance(px) >= 0.62;
    };

    // 1) flood fill a partir da borda
    const bg = new Uint8Array(n);
    const stack = [];
    const seed = (x, y) => {
      const i = y * w + x;
      if (!bg[i] && backdrop(i)) {
        bg[i] = 1;
        stack.push(i);
      }
    };
    for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
    for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      const y = (i - x) / w;
      if (x > 0) seed(x - 1, y);
      if (x < w - 1) seed(x + 1, y);
      if (y > 0) seed(x, y - 1);
      if (y < h - 1) seed(x, y + 1);
    }

    const touchesBg = (x, y) => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if ((dx || dy) && xx >= 0 && yy >= 0 && xx < w && yy < h && bg[yy * w + xx]) return true;
        }
      }
      return false;
    };

    // decide tudo antes de escrever (a franja olha o fundo original)
    const fringe = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) if (!bg[y * w + x] && touchesBg(x, y)) fringe[y * w + x] = 1;
    }

    for (let i = 0; i < n; i++) {
      const p = i * 4;
      if (bg[i]) {
        data[p + 3] = 0;
        continue;
      }
      let a = data[p + 3];
      if (!a) continue;
      if (mode === 'logo') {
        logoPixel(data, p, a, target);
        continue;
      }
      if (fringe[i]) {
        const whiteness = Math.min(data[p], data[p + 1], data[p + 2]) / 255;
        if (whiteness > 0.5) a *= clamp(1 - (whiteness - 0.5) * 2, 0, 1);
      }
      data[p + 3] = Math.round(a);
    }
    return data;
  }

  return { parseColor, luminance, contrast, chroma, rgbToHsl, hslToRgb, mix, css, fixBackground, fixText, classifyIcon, recolorBrand };
});
