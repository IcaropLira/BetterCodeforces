// Heatmap do perfil: recolore os quadradinhos do calendário do Codeforces
// (#userActivityGraph, um <rect class="day" data-date="M/D/AAAA"> por dia) por
// problemas resolvidos, envios ou dificuldade (máxima/média) do dia.
// Os dados vêm de user.status; a cor original fica guardada para voltar ao normal.
(() => {
  'use strict';
  if (globalThis.CFM_HEATMAP) return;
  const ext = globalThis.browser ?? globalThis.chrome;
  const S = globalThis.CFM_STATS;
  const PROFILE = /^\/profile\/([^/?#]+)\/?$/;

  let T = (k) => k;
  let settings = {};
  let ui = null;
  let sum = null;
  let loading = null;
  let observer = null;
  let lastSig = '';
  let thr = [1, 2, 3, 4];

  const isDark = () => {
    const html = document.documentElement;
    return html.getAttribute('data-cfm') !== 'off' && html.getAttribute('data-cfm-theme') === 'dark';
  };
  const handleOfPage = () => {
    const m = PROFILE.exec(location.pathname);
    return m ? decodeURIComponent(m[1]) : '';
  };
  const graph = () => document.getElementById('userActivityGraph');
  const rects = () => (graph() ? graph().querySelectorAll('rect.day[data-date]') : []);

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const kid of kids) if (kid != null) el.append(kid);
    return el;
  }

  /** Texto do tooltip de um dia. */
  function tipText(key, day) {
    const d = key.split('-');
    const date = new Date(+d[0], +d[1] - 1, +d[2]).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    if (!day) return `${date} · ${T('hmNone')}`;
    const parts = [date, T('hmSolvedN', { n: day.solved }), T('hmSubsN', { n: day.subs })];
    if (day.ratings.length) {
      parts.push(T('hmMaxN', { n: S.dayValue(day, 'max') }));
      parts.push(T('hmAvgN', { n: S.dayValue(day, 'avg') }));
    }
    return parts.join(' · ');
  }

  function paint() {
    const mode = settings.heatmapMode || 'cf';
    // limites calculados só com os dias que o calendário mostra
    const keys = Array.from(rects()).map((r) => S.cfDateToKey(r.getAttribute('data-date'))).filter(Boolean).sort();
    thr = sum ? S.heatThresholds(sum.byDay, mode === 'subs' ? 'subs' : 'solved', keys[0] || '') : thr;
    try {
      for (const r of rects()) {
        if (!r.hasAttribute('data-cfm-fill')) r.setAttribute('data-cfm-fill', r.getAttribute('fill') || '');
        if (mode === 'cf' || !sum) {
          r.setAttribute('fill', r.getAttribute('data-cfm-fill'));
          r.removeAttribute('data-cfm-tip');
          continue;
        }
        const key = S.cfDateToKey(r.getAttribute('data-date'));
        const day = key && sum.byDay[key];
        r.setAttribute('fill', S.heatColor(day, mode, isDark(), thr));
        r.setAttribute('data-cfm-tip', key ? tipText(key, day) : '');
      }
    } finally {
      renderLegend(mode);
    }
  }

  function renderLegend(mode) {
    if (!ui) return;
    ui.legend.replaceChildren();
    const items = sum ? S.heatLegend(mode, isDark(), thr) : [];
    ui.legend.hidden = !items.length;
    if (!items.length) return;
    ui.legend.append(h('span', { class: 'cfm-hm-cap' }, mode === 'max' || mode === 'avg' ? T('hmRatingLegend') : T('hmCountLegend')));
    for (const it of items) {
      const sw = h('i', { class: 'cfm-hm-sw' });
      sw.style.background = it.color;
      ui.legend.append(h('span', { class: 'cfm-hm-item' }, sw, it.label));
    }
  }

  async function ensureData() {
    if (sum || (settings.heatmapMode || 'cf') === 'cf') return;
    const handle = handleOfPage();
    if (!handle || !globalThis.CFM_API) return;
    loading ||= (async () => {
      ui.status.textContent = T('hmLoading');
      try {
        sum = S.summarize(await globalThis.CFM_API.status(handle));
        ui.status.textContent = '';
      } catch (e) {
        ui.status.textContent = e.message || String(e);
      } finally {
        loading = null;
      }
    })();
    await loading;
  }

  async function apply() {
    if (!ui) return;
    ui.select.value = settings.heatmapMode || 'cf';
    await ensureData();
    paint();
  }

  /* ----------------------------- tooltip ----------------------------- */

  let tip = null;
  function onOver(e) {
    const r = e.target.closest && e.target.closest('rect[data-cfm-tip]');
    if (!r || !r.getAttribute('data-cfm-tip')) return hideTip();
    tip ||= document.body.appendChild(h('div', { class: 'cfm-tip', role: 'tooltip', 'data-cfm-skip': '' }));
    tip.textContent = r.getAttribute('data-cfm-tip');
    const b = r.getBoundingClientRect();
    tip.hidden = false;
    const w = tip.offsetWidth;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, b.left + b.width / 2 - w / 2))}px`;
    tip.style.top = `${b.top + scrollY - tip.offsetHeight - 8}px`;
  }
  function hideTip() {
    if (tip) tip.hidden = true;
  }

  /* ------------------------------- UI ------------------------------- */

  function mount() {
    const g = graph();
    if (!g || ui) return;
    const select = h('select', { class: 'cfm-hm-select', 'aria-label': T('hmColorBy') });
    for (const m of S.HEAT_MODES) select.append(h('option', { value: m }, T(`hm_${m}`)));
    select.addEventListener('change', () => {
      settings = { ...settings, heatmapMode: select.value };
      Promise.resolve(ext.storage.local.set({ heatmapMode: select.value })).catch(() => {});
      apply();
    });
    const status = h('span', { class: 'cfm-status' });
    const handle = handleOfPage();
    const analytics = h('a', { class: 'cfm-hm-link', href: `/profile/${encodeURIComponent(handle)}#hiraku` }, T('anOpen'));
    const bar = h('div', { class: 'cfm-hm-bar', translate: 'no', 'data-cfm-skip': '' },
      globalThis.CFM_MARK ? globalThis.CFM_MARK() : null,
      h('label', {}, h('span', {}, T('hmColorBy')), select), status, analytics);
    const legend = h('div', { class: 'cfm-hm-legend', translate: 'no', 'data-cfm-skip': '', hidden: '' });
    const frame = g.closest('.roundbox') || g.parentElement;
    frame.before(bar);
    frame.after(legend); // fora do quadro observado (senão a legenda dispararia o observer)
    ui = { bar, select, status, legend, analytics };

    g.addEventListener('mouseover', onOver);
    g.addEventListener('mouseleave', hideTip);
    // o Codeforces redesenha o SVG ao trocar "All / Only public": só reage a isso
    // (mudar atributos dos rects não gera childList, então pintar não realimenta)
    observer = new MutationObserver((muts) => {
      const redrawn = muts.some((m) =>
        Array.from(m.addedNodes).some((n) => n.nodeType === 1 && (n.matches('svg, rect.day, g') || n.querySelector?.('rect.day'))));
      if (redrawn) paint();
    });
    observer.observe(frame, { childList: true, subtree: true });
    apply();
  }

  globalThis.CFM_HEATMAP = {
    PROFILE,
    update(s, t) {
      settings = s;
      const sig = `${s.heatmapMode}|${isDark()}|${s.uiLang}`;
      const themeChanged = ui && sig !== lastSig;
      lastSig = sig;
      T = t;
      if (!PROFILE.test(location.pathname)) return;
      if (!ui) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
        else mount();
      } else if (themeChanged) {
        apply();
      }
    },
    /** Usado pelo analytics, que já baixou os envios. */
    setSummary(handle, s) {
      if (handle && handle.toLowerCase() === handleOfPage().toLowerCase()) sum = s;
    },
  };
})();
