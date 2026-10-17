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

  return { parseColor, luminance, contrast, chroma, rgbToHsl, hslToRgb, mix, css, fixBackground, fixText, classifyIcon };
});
