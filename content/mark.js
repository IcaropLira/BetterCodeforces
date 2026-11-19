// Marca do Hiraku Codeforces (a mesma de icons/, versão para tamanhos pequenos),
// usada nas barras que a extensão coloca na página.
(() => {
  'use strict';
  if (globalThis.CFM_MARK) return;
  const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="Hiraku Codeforces"><defs><linearGradient id="cfm-mark-g" gradientUnits="userSpaceOnUse" x1="0" y1="36" x2="0" y2="220"><stop offset="0" stop-color="#ee0f7f"/><stop offset="0.4" stop-color="#ff8db8"/><stop offset="0.68" stop-color="#d4a2c8"/><stop offset="1" stop-color="#3b2477"/></linearGradient></defs><rect width="256" height="256" rx="56" fill="#1a1230"/><g fill="url(#cfm-mark-g)"><path d="M30,44 L106,68 L106,188 L30,212 Z"/><path d="M226,44 L150,68 L150,188 L226,212 Z"/><path d="M128,52 Q132,122 146,128 Q132,134 128,204 Q124,134 110,128 Q124,122 128,52 Z"/></g><line x1="204" y1="100" x2="168" y2="110" stroke="#1a1230" stroke-width="16" stroke-linecap="round"/></svg>';
  globalThis.CFM_MARK = () => {
    const svg = new DOMParser().parseFromString(SVG, 'image/svg+xml').documentElement;
    svg.setAttribute('class', 'cfm-mark');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('aria-hidden', 'true');
    svg.removeAttribute('role');
    return document.importNode(svg, true);
  };
})();
