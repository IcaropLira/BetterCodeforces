// Página de analytics do Hiraku: /profile/<handle>#hiraku
//
// Roda dentro do próprio Codeforces (assim a sua sessão vale para ler /friends e o tema
// da extensão se aplica). Troca o conteúdo da página do perfil por um painel com:
//   - visão geral do handle: números, calendário, dificuldade, meses, rating, tags,
//     veredictos, linguagens, "tentando agora" e sugestões de próximos problemas;
//   - comparação com seus amigos e com a sua instituição.
// Entradas: item "Analytics" no menu do topo, link no heatmap do perfil e botão no popup.
(() => {
  'use strict';
  if (globalThis.CFM_ANALYTICS) return;
  const S = globalThis.CFM_STATS;
  const API = () => globalThis.CFM_API;
  const PROFILE = /^\/profile\/([^/?#]+)\/?$/;
  const HASH = '#hiraku';
  const DAY = 86400;

  let T = (k) => k;
  let settings = {};
  let state = null; // { handle, root, tab, info, sum, ratingHist, cmp: { friends, org } }
  let navAdded = false;

  const isDark = () => {
    const html = document.documentElement;
    return html.getAttribute('data-cfm') !== 'off' && html.getAttribute('data-cfm-theme') === 'dark';
  };
  const pageHandle = () => {
    const m = PROFILE.exec(location.pathname);
    return m ? decodeURIComponent(m[1]) : '';
  };
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());
  const fmt1 = (n) => (n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: n > 0 && n < 10 ? 1 : 0 }));

  /** Baixa um arquivo gerado aqui mesmo (nada sai do navegador). */
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h('a', { href: url, download: name, hidden: true });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const stamp = () => S.dayKey(Date.now() / 1000);
  const slug = (x) => String(x).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'export';

  function exportButtons(items) {
    return h('div', { class: 'cfm-an-export', role: 'group', 'aria-label': T('anExport') },
      h('span', { class: 'cfm-an-export-l' }, T('anExport')),
      items.map(([label, fn, tip]) => h('button', { type: 'button', class: 'cfm-an-xbtn', title: tip || '', onclick: fn }, label)));
  }
  const pct = (x) => `${Math.round(x * 100)}%`;

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  const NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs = {}, ...kids) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  }

  function ago(ts) {
    if (!ts) return '—';
    const d = Math.floor((Date.now() / 1000 - ts) / DAY);
    if (d <= 0) return T('anToday');
    if (d === 1) return T('anYesterday');
    if (d < 30) return T('anDaysAgo', { n: d });
    return new Date(ts * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const userLink = (handle, rating) =>
    h('a', { href: `/profile/${encodeURIComponent(handle)}`, class: 'cfm-an-user', style: `color:${S.rankColor(rating, isDark())}` }, handle);
  const ratingChip = (r) =>
    r ? h('span', { class: 'cfm-an-chip', style: `--c:${S.rankColor(r, isDark())}` }, String(r)) : h('span', { class: 'cfm-an-chip is-none' }, '?');

  /* ------------------------------ gráficos ------------------------------ */

  /** Barras verticais em SVG (uma série). data: [{ label, value, color?, tip }] */
  function vbars(data, { height = 190, labelEvery = 1 } = {}) {
    const W = 440; // perto da largura real do cartão: o texto não encolhe
    const H = height;
    const padL = 34;
    const padB = 22;
    const max = Math.max(1, ...data.map((d) => d.value));
    const step = (W - padL) / Math.max(1, data.length);
    const bw = Math.max(3, step - 2); // 2px de respiro entre barras
    const nice = niceMax(max);
    const y = (v) => H - padB - (v / nice) * (H - padB - 8);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'cfm-an-svg', role: 'img' });
    for (const t of [0, 0.5, 1]) {
      const v = Math.round(nice * t);
      svg.append(s('line', { x1: padL, x2: W, y1: y(v), y2: y(v), class: 'cfm-an-grid' }));
      svg.append(s('text', { x: padL - 6, y: y(v) + 4, class: 'cfm-an-axis', 'text-anchor': 'end' }, String(v)));
    }
    data.forEach((d, i) => {
      const x = padL + i * step + (step - bw) / 2;
      const top = y(d.value);
      const hgt = Math.max(0, H - padB - top);
      if (hgt > 0) {
        const r = Math.min(4, bw / 2, hgt);
        // topo arredondado, base reta na linha de base
        svg.append(s('path', {
          d: `M${x},${H - padB} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - padB} Z`,
          style: `fill:${d.color || 'var(--cfm-accent)'}`,
          class: 'cfm-an-bar',
        }));
      }
      // alvo de hover maior que a barra
      svg.append(s('rect', { x: padL + i * step, y: 0, width: step, height: H - padB, fill: 'transparent', 'data-cfm-tip': d.tip || `${d.label}: ${d.value}` }));
      if (i % labelEvery === 0) svg.append(s('text', { x: x + bw / 2, y: H - 6, class: 'cfm-an-axis', 'text-anchor': 'middle' }, d.label));
    });
    return svg;
  }

  function niceMax(v) {
    if (v <= 5) return 5;
    const p = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  /** Barras horizontais em HTML (texto nítido). data: [{ label, value, color?, tip? }] */
  function hbars(data, { total } = {}) {
    const max = Math.max(1, ...data.map((d) => d.value));
    return h('div', { class: 'cfm-an-hbars' },
      data.map((d) =>
        h('div', { class: 'cfm-an-hrow', 'data-cfm-tip': d.tip || `${d.label}: ${fmt(d.value)}${total ? ` (${pct(d.value / total)})` : ''}` },
          h('span', { class: 'cfm-an-hlabel' }, d.label),
          h('span', { class: 'cfm-an-htrack' }, h('i', { style: `width:${(d.value / max) * 100}%;${d.color ? `background:${d.color}` : ''}` })),
          h('span', { class: 'cfm-an-hval' }, fmt(d.value)))));
  }

  /** Linha do rating, com as faixas de rank ao fundo. */
  function ratingLine(hist) {
    const W = 440;
    const H = 190;
    const padL = 40;
    const padB = 22;
    if (!hist.length) return h('p', { class: 'cfm-an-empty' }, T('anNoContests'));
    const xs = hist.map((r) => r.ratingUpdateTimeSeconds);
    const ys = hist.map((r) => r.newRating);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs) || x0 + 1;
    const lo = Math.max(0, Math.floor((Math.min(...ys) - 150) / 100) * 100);
    const hi = Math.ceil((Math.max(...ys) + 150) / 100) * 100;
    const X = (t) => padL + ((t - x0) / Math.max(1, x1 - x0)) * (W - padL - 10);
    const Y = (v) => H - padB - ((v - lo) / (hi - lo)) * (H - padB - 8);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'cfm-an-svg', role: 'img' });
    S.RANKS.forEach((r, i) => {
      const top = i + 1 < S.RANKS.length ? S.RANKS[i + 1].min : Infinity;
      const a = Math.max(lo, r.min === -Infinity ? lo : r.min);
      const b = Math.min(hi, top);
      if (b <= a) return;
      svg.append(s('rect', { x: padL, width: W - padL - 10, y: Y(b), height: Y(a) - Y(b), style: `fill:${isDark() ? r.dark : r.light};opacity:.10` }));
      svg.append(s('text', { x: padL - 6, y: Y(a) + 4, class: 'cfm-an-axis', 'text-anchor': 'end' }, String(a)));
    });
    const d = hist.map((r, i) => `${i ? 'L' : 'M'}${X(r.ratingUpdateTimeSeconds).toFixed(1)},${Y(r.newRating).toFixed(1)}`).join(' ');
    svg.append(s('path', { d, class: 'cfm-an-line' }));
    hist.forEach((r) => {
      const delta = r.newRating - r.oldRating;
      const tip = `${r.contestName} · ${r.newRating} (${delta >= 0 ? '+' : ''}${delta}) · #${r.rank}`;
      svg.append(s('circle', { cx: X(r.ratingUpdateTimeSeconds), cy: Y(r.newRating), r: 4, class: 'cfm-an-dot', style: `fill:${S.rankColor(r.newRating, isDark())}` }));
      svg.append(s('circle', { cx: X(r.ratingUpdateTimeSeconds), cy: Y(r.newRating), r: 10, fill: 'transparent', 'data-cfm-tip': tip }));
    });
    // mês/ano quando o histórico cabe num ano; só o ano quando é mais longo
    const short = x1 - x0 < 400 * DAY;
    const when = (t) => new Date(t * 1000).toLocaleDateString(undefined, short ? { month: 'short', year: '2-digit' } : { year: 'numeric' });
    svg.append(s('text', { x: padL, y: H - 6, class: 'cfm-an-axis' }, when(x0)));
    svg.append(s('text', { x: W - 10, y: H - 6, class: 'cfm-an-axis', 'text-anchor': 'end' }, when(x1)));
    return svg;
  }

  /** Calendário dos últimos 12 meses (53 semanas), colorido pelo modo escolhido. */
  function calendar(sum, mode) {
    const cell = 11;
    const gap = 2;
    const today = S.dayKey(Date.now() / 1000);
    const end = new Date();
    const start = S.addDays(today, -(52 * 7 + end.getDay()));
    const W = 30 + 53 * (cell + gap);
    const H = 16 + 7 * (cell + gap);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'cfm-an-svg cfm-an-cal', role: 'img' });
    const thr = S.heatThresholds(sum.byDay, mode === 'subs' ? 'subs' : 'solved', start);
    let k = start;
    let lastMonth = '';
    for (let w = 0; w < 53; w++) {
      for (let d = 0; d < 7; d++) {
        if (k > today) break;
        const x = 30 + w * (cell + gap);
        const y = 16 + d * (cell + gap);
        const day = sum.byDay[k];
        const tip = `${new Date(k + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${T('hmSolvedN', { n: day ? day.solved : 0 })} · ${T('hmSubsN', { n: day ? day.subs : 0 })}${day && day.ratings.length ? ` · ${T('hmMaxN', { n: S.dayValue(day, 'max') })}` : ''}`;
        svg.append(s('rect', { x, y, width: cell, height: cell, rx: 2, fill: S.heatColor(day, mode, isDark(), thr), 'data-cfm-tip': tip }));
        if (d === 0 && k.slice(0, 7) !== lastMonth) {
          lastMonth = k.slice(0, 7);
          if (w < 52) svg.append(s('text', { x, y: 10, class: 'cfm-an-axis' }, new Date(k + 'T12:00').toLocaleDateString(undefined, { month: 'short' })));
        }
        k = S.addDays(k, 1);
      }
    }
    [1, 3, 5].forEach((d) => svg.append(s('text', { x: 0, y: 16 + d * (cell + gap) + 9, class: 'cfm-an-axis' },
      new Date(2026, 10, 15 + d).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3))));
    return svg;
  }

  function legend(mode, sum, from) {
    const thr = S.heatThresholds(sum.byDay, mode === 'subs' ? 'subs' : 'solved', from);
    return h('div', { class: 'cfm-hm-legend' },
      h('span', { class: 'cfm-hm-cap' }, mode === 'max' || mode === 'avg' ? T('hmRatingLegend') : T('hmCountLegend')),
      S.heatLegend(mode, isDark(), thr).map((it) => h('span', { class: 'cfm-hm-item' }, h('i', { class: 'cfm-hm-sw', style: `background:${it.color}` }), it.label)));
  }

  /* ------------------------------ tooltip ------------------------------ */

  let tip = null;
  function onOver(e) {
    const t = e.target.closest && e.target.closest('[data-cfm-tip]');
    if (!t || !state || !state.root.contains(t)) {
      if (tip) tip.hidden = true;
      return;
    }
    tip ||= document.body.appendChild(h('div', { class: 'cfm-tip', role: 'tooltip', 'data-cfm-skip': '' }));
    tip.textContent = t.getAttribute('data-cfm-tip');
    tip.hidden = false;
    const b = t.getBoundingClientRect();
    const w = tip.offsetWidth;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, b.left + b.width / 2 - w / 2))}px`;
    tip.style.top = `${Math.max(scrollY + 4, b.top + scrollY - tip.offsetHeight - 8)}px`;
  }

  /* ------------------------------ visão geral ------------------------------ */

  const card = (title, body, extra) => h('section', { class: 'cfm-an-card' }, h('header', {}, h('h3', {}, title), extra || null), body);
  const kpi = (label, value, sub) => h('div', { class: 'cfm-an-kpi' }, h('span', { class: 'cfm-an-kpi-l' }, label), h('b', {}, value), sub ? h('small', {}, sub) : null);

  function overview() {
    const { sum, info, ratingHist } = state;
    const verdictName = (v) => T(`v_${v}`) !== `v_${v}` ? T(`v_${v}`) : v.replace(/_/g, ' ').toLowerCase();

    const kpis = h('div', { class: 'cfm-an-kpis' },
      kpi(T('anSolved'), fmt(sum.solved), T('anOfSubs', { n: fmt(sum.total) })),
      kpi(T('an30'), fmt(sum.solved30), T('an7', { n: sum.solved7 })),
      kpi(T('anStreak'), T('anDaysN', { n: sum.streak }), T('anLongest', { n: sum.longestStreak })),
      kpi(T('anAvgRecent'), sum.avgRecent ? String(sum.avgRecent) : '—', T('anAvgRecentSub')),
      kpi(T('anHardest'), sum.maxRating ? String(sum.maxRating) : '—', sum.max30 ? T('anIn30', { n: sum.max30 }) : null),
      kpi(T('anAcRate'), pct(sum.acRate), T('anAcSubs', { n: fmt(sum.acSubs) })),
      kpi(T('anActive'), `${sum.activeDays30}/30`, T('anActiveSub')),
      kpi(T('anContests'), fmt(ratingHist.length), info && info.maxRating ? T('anMaxRating', { n: info.maxRating }) : null),
      kpi(T('anPerDay'), fmt1(sum.perDay.d30), T('anPerDaySub', { n: fmt1(sum.perDay.active30) })),
      kpi(T('anFirstTry'), pct(sum.firstTryRate), T('anTriesPer', { n: fmt1(sum.triesPerSolved) })),
      kpi(T('an365'), fmt(sum.solved365), T('an90', { n: fmt(sum.solved90) })),
      kpi(T('anUpsolve'), fmt(sum.upsolve.length), T('anUpsolveSub')));

    // calendário
    let calMode = settings.heatmapMode && settings.heatmapMode !== 'cf' ? settings.heatmapMode : 'solved';
    const calBox = h('div', { class: 'cfm-an-calbox' });
    const calFrom = S.addDays(S.dayKey(Date.now() / 1000), -(52 * 7 + new Date().getDay()));
    const drawCal = () => calBox.replaceChildren(calendar(sum, calMode), legend(calMode, sum, calFrom));
    const calSelect = h('select', { class: 'cfm-hm-select', 'aria-label': T('hmColorBy'), onchange: (e) => { calMode = e.target.value; drawCal(); } },
      S.HEAT_MODES.filter((m) => m !== 'cf').map((m) => h('option', { value: m, selected: m === calMode }, T(`hm_${m}`))));
    drawCal();

    // dificuldade
    const buckets = [];
    for (let r = 800; r <= 3500; r += 100) buckets.push(r);
    const diff = vbars(buckets.map((r) => ({
      label: String(r), value: sum.byRating[r] || 0, color: S.rankColor(r, isDark()),
      tip: T('anDiffTip', { r, n: sum.byRating[r] || 0 }),
    })), { labelEvery: 3 });

    const months = Object.entries(sum.perMonth).map(([m, n]) => ({
      label: new Date(`${m}-15T12:00`).toLocaleDateString(undefined, { month: 'short' }),
      value: n,
      tip: `${new Date(`${m}-15T12:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}: ${T('hmSolvedN', { n })}`,
    }));

    const tags = Object.entries(sum.byTag).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([label, value]) => ({ label, value }));
    const verdicts = Object.entries(sum.verdicts).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([v, value]) => ({ label: verdictName(v), value, color: v === 'OK' ? 'var(--cfm-an-ok)' : null }));
    const langs = Object.entries(sum.langs).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));

    const trying = sum.tryingNow.length
      ? h('ul', { class: 'cfm-an-list' }, sum.tryingNow.slice(0, 8).map((t) =>
          h('li', {}, ratingChip(t.rating), t.url ? h('a', { href: t.url }, t.name) : h('span', {}, t.name),
            h('small', {}, `${T('anTries', { n: t.tries })} · ${ago(t.ts)}`))))
      : h('p', { class: 'cfm-an-empty' }, T('anNothingTrying'));

    const sugBox = h('div', { class: 'cfm-an-sug' }, h('p', { class: 'cfm-an-empty' }, T('anLoading')));
    const sugTag = h('select', { class: 'cfm-hm-select', 'aria-label': T('anTag') },
      h('option', { value: '' }, T('anAnyTag')),
      Object.keys(sum.byTag).sort().map((t) => h('option', { value: t }, t)));
    const drawSug = async () => {
      try {
        const ps = await API().problemset();
        const list = S.suggest(ps.problems, ps.problemStatistics, sum, { count: 8, tag: sugTag.value || null });
        const base = sum.avgRecent || sum.maxRating || 1000;
        const lo = Math.max(800, Math.round(base / 100) * 100);
        sugBox.replaceChildren(
          h('p', { class: 'cfm-an-note' }, T('anSuggestRange', { lo, hi: lo + 300 })),
          list.length
            ? h('ul', { class: 'cfm-an-list' }, list.map((p) =>
                h('li', {}, ratingChip(p.rating), h('a', { href: p.url }, p.name), h('small', {}, T('anSolvedBy', { n: fmt(p.solvedBy) })))))
            : h('p', { class: 'cfm-an-empty' }, T('anNoSuggest')));
      } catch (e) {
        sugBox.replaceChildren(h('p', { class: 'cfm-an-empty' }, e.message));
      }
    };
    sugTag.addEventListener('change', drawSug);
    drawSug();

    // ritmo
    const pace = hbars([
      { label: T('anPace30'), value: +sum.perDay.d30.toFixed(2), tip: T('anPaceTip', { n: fmt1(sum.perDay.d30), p: T('anPace30') }) },
      { label: T('anPace90'), value: +sum.perDay.d90.toFixed(2), tip: T('anPaceTip', { n: fmt1(sum.perDay.d90), p: T('anPace90') }) },
      { label: T('anPace365'), value: +sum.perDay.d365.toFixed(2), tip: T('anPaceTip', { n: fmt1(sum.perDay.d365), p: T('anPace365') }) },
      { label: T('anPaceActive'), value: +sum.perDay.active30.toFixed(2), tip: T('anPaceActiveTip', { n: fmt1(sum.perDay.active30) }) },
    ]);

    // dia da semana (começando na segunda) e horário
    const wd = [1, 2, 3, 4, 5, 6, 0];
    const wdName = (d) => new Date(2026, 10, 15 + d).toLocaleDateString(undefined, { weekday: 'short' }).replace('.', '');
    const week = vbars(wd.map((d) => ({ label: wdName(d), value: sum.weekdaySolved[d], tip: `${wdName(d)}: ${T('hmSolvedN', { n: sum.weekdaySolved[d] })}` })), { height: 160 });
    const hours = vbars(sum.hours.map((n, hr) => ({ label: `${hr}h`, value: n, tip: T('anHourTip', { h: hr, n }) })), { height: 160, labelEvery: 3 });

    // nível mês a mês (na cor do rank) e acumulado
    const lvl = vbars(Object.entries(sum.levelByMonth).map(([m, v]) => ({
      label: new Date(`${m}-15T12:00`).toLocaleDateString(undefined, { month: 'short' }),
      value: v || 0,
      color: v ? S.rankColor(v, isDark()) : null,
      tip: `${new Date(`${m}-15T12:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}: ${v ? T('anLevelTip', { n: v }) : T('anNoRated')}`,
    })), { height: 160 });
    const cum = vbars(Object.entries(sum.cumulative).map(([m, v]) => ({
      label: new Date(`${m}-15T12:00`).toLocaleDateString(undefined, { month: 'short' }),
      value: v,
      tip: `${new Date(`${m}-15T12:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}: ${T('anCumTip', { n: fmt(v) })}`,
    })), { height: 160 });

    // tags: mais fortes e mais fracas (entre as que você tentou pelo menos 3 vezes)
    const ts = S.tagStrength(sum.tagStats);
    const tagRow = (x) => h('li', { 'data-cfm-tip': T('anTagTip', { tag: x.tag, s: x.solved, t: x.total }) },
      h('span', { class: 'cfm-an-chip', style: `--c:${x.rate >= 0.8 ? 'var(--cfm-an-ok)' : x.rate < 0.5 ? '#e5484d' : 'var(--an-muted)'}` }, pct(x.rate)),
      h('span', {}, x.tag), h('small', {}, `${x.solved}/${x.total}`));
    const strong = ts.slice().sort((a, b) => b.rate - a.rate || b.total - a.total).slice(0, 5);
    const weak = ts.slice().sort((a, b) => a.rate - b.rate || b.total - a.total).filter((x) => x.rate < 1).slice(0, 5);
    const tagsSW = ts.length
      ? h('div', { class: 'cfm-an-two' },
          h('div', {}, h('h4', {}, T('anStrong')), h('ul', { class: 'cfm-an-list' }, strong.map(tagRow))),
          h('div', {}, h('h4', {}, T('anWeak')), weak.length ? h('ul', { class: 'cfm-an-list' }, weak.map(tagRow)) : h('p', { class: 'cfm-an-empty' }, T('anNoWeak'))))
      : h('p', { class: 'cfm-an-empty' }, T('anTagsFew'));

    // contests
    const cs = S.contestStats(ratingHist);
    const tone = (d) => (d > 0 ? 'cfm-an-up' : d < 0 ? 'cfm-an-down' : ''); // a cor segue o sinal
    const signed = (d) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}`;
    const contests = cs.count
      ? h('dl', { class: 'cfm-an-dl' },
          h('dt', {}, T('anCsCount')), h('dd', {}, fmt(cs.count), h('small', {}, ` · ${T('anCsPositive', { n: cs.positive })}`)),
          h('dt', {}, T('anCsCurrent')), h('dd', {}, ratingChip(cs.current), ' ', h('small', {}, `${T('anMax')} ${cs.max}`)),
          h('dt', {}, T('anCsBestRank')), h('dd', {}, `#${fmt(cs.bestRank.rank)}`, h('small', {}, ` · ${cs.bestRank.name}`)),
          h('dt', {}, T('anCsBest')), h('dd', {}, h('b', { class: tone(cs.best.d) }, signed(cs.best.d)), h('small', {}, ` · ${cs.best.name}`)),
          h('dt', {}, T('anCsWorst')), h('dd', {}, h('b', { class: tone(cs.worst.d) }, signed(cs.worst.d)), h('small', {}, ` · ${cs.worst.name}`)),
          h('dt', {}, T('anCsAvg')), h('dd', {}, h('b', { class: tone(cs.avgDelta) }, signed(cs.avgDelta))),
          h('dt', {}, T('anCsLast5')), h('dd', {}, h('b', { class: tone(cs.last5) }, signed(cs.last5))))
      : h('p', { class: 'cfm-an-empty' }, T('anNoContests'));

    const upsolve = sum.upsolve.length
      ? h('ul', { class: 'cfm-an-list' }, sum.upsolve.slice(0, 8).map((u) =>
          h('li', {}, ratingChip(u.rating), u.url ? h('a', { href: u.url }, u.name) : h('span', {}, u.name), h('small', {}, ago(u.ts)))))
      : h('p', { class: 'cfm-an-empty' }, T('anNoUpsolve'));

    return h('div', { class: 'cfm-an-body' },
      kpis,
      card(T('anCalendar'), calBox, calSelect),
      h('div', { class: 'cfm-an-grid' },
        card(T('anByDifficulty'), diff),
        card(T('anByMonth'), vbars(months)),
        card(T('anRating'), ratingLine(ratingHist)),
        card(T('anTags'), tags.length ? hbars(tags) : h('p', { class: 'cfm-an-empty' }, '—')),
        card(T('anTrying'), trying),
        card(T('anSuggest'), sugBox, sugTag),
        card(T('anUpsolveTitle'), upsolve),
        card(T('anContestsTitle'), contests),
        card(T('anPace'), pace),
        card(T('anLevelMonth'), lvl),
        card(T('anCumulative'), cum),
        card(T('anTagStrength'), tagsSW),
        card(T('anWeekday'), week),
        card(T('anHours'), hours),
        card(T('anVerdicts'), hbars(verdicts, { total: sum.total })),
        card(T('anLangs'), hbars(langs, { total: sum.total }))));
  }

  /* ------------------------------ comparação ------------------------------ */

  const COLS = [
    { k: 'handle', label: 'anWho', get: (r) => r.handle.toLowerCase(), left: true },
    { k: 'rating', label: 'anRatingCol', get: (r) => r.rating ?? -1 },
    { k: 'solved', label: 'anSolved', get: (r) => r.sum?.solved ?? -1 },
    { k: 'solved7', label: 'an7col', get: (r) => r.sum?.solved7 ?? -1 },
    { k: 'solved30', label: 'an30', get: (r) => r.sum?.solved30 ?? -1 },
    { k: 'perDay', label: 'anPerDayCol', get: (r) => r.sum?.perDay30 ?? -1 },
    { k: 'avgRecent', label: 'anAvgRecent', get: (r) => r.sum?.avgRecent ?? -1 },
    { k: 'max30', label: 'anHardest30', get: (r) => r.sum?.max30 ?? -1 },
    { k: 'streak', label: 'anStreak', get: (r) => r.sum?.streak ?? -1 },
    { k: 'trying', label: 'anTryingCol', get: (r) => r.sum?.tryingNow?.[0]?.ts ?? 0, left: true },
    { k: 'last', label: 'anLast', get: (r) => r.sum?.lastTs ?? 0 },
    { k: 'vs', label: 'anVsYou', get: (r) => r.sum?.solved30 ?? -1 },
  ];

  function vsCell(row, base) {
    if (!row.sum || !base || row.isOwner) return row.isOwner ? h('span', { class: 'cfm-an-you' }, T('anYou')) : '—';
    const parts = [];
    const d30 = row.sum.solved30 - base.solved30;
    parts.push(h('span', { class: `cfm-an-delta ${d30 > 0 ? 'up' : d30 < 0 ? 'down' : ''}`, 'data-cfm-tip': T('anVs30Tip', { n: Math.abs(d30), more: d30 >= 0 ? T('anMore') : T('anLess') }) },
      `${d30 > 0 ? '▲' : d30 < 0 ? '▼' : '='} ${Math.abs(d30)}`));
    if (row.sum.avgRecent && base.avgRecent) {
      const dl = row.sum.avgRecent - base.avgRecent;
      parts.push(h('span', { class: `cfm-an-delta ${dl > 0 ? 'up' : dl < 0 ? 'down' : ''}`, 'data-cfm-tip': T('anVsLvlTip', { n: Math.abs(dl), more: dl >= 0 ? T('anHarder') : T('anEasier') }) },
        `${T('anLvl')} ${dl > 0 ? '+' : dl < 0 ? '−' : ''}${Math.abs(dl)}`));
    }
    return h('span', { class: 'cfm-an-vs' }, parts);
  }

  function compareTable(group) {
    const rows = group.rows;
    const base = rows.find((r) => r.isOwner)?.sum;
    const col = COLS.find((c) => c.k === group.sortKey) || COLS[4];
    const sorted = rows.slice().sort((a, b) => {
      const x = col.get(a);
      const y = col.get(b);
      return (x < y ? -1 : x > y ? 1 : 0) * (group.sortDir || -1);
    });
    const head = h('tr', {}, h('th', {}, '#'), COLS.map((c) =>
      h('th', {
        class: `${c.left ? 'l ' : ''}${c.k === col.k ? 'is-sorted' : ''}`,
        'aria-sort': c.k === col.k ? (group.sortDir === 1 ? 'ascending' : 'descending') : null,
        onclick: () => {
          group.sortDir = group.sortKey === c.k ? -(group.sortDir || -1) : c.left ? 1 : -1;
          group.sortKey = c.k;
          renderCompare();
        },
      }, T(c.label), c.k === col.k ? (group.sortDir === 1 ? ' ↑' : ' ↓') : '')));
    const body = sorted.map((r, i) => {
      const sm = r.sum;
      const t = sm?.tryingNow?.[0];
      return h('tr', { class: r.isOwner ? 'is-owner' : '' },
        h('td', { class: 'muted' }, String(i + 1)),
        h('td', { class: 'l' }, userLink(r.handle, r.rating), r.isOwner ? h('small', { class: 'cfm-an-you' }, ` ${T('anYou')}`) : null),
        h('td', {}, r.rating ? h('span', { style: `color:${S.rankColor(r.rating, isDark())};font-weight:600` }, String(r.rating)) : '—'),
        h('td', {}, sm ? fmt(sm.solved) : r.error ? h('span', { class: 'muted', title: r.error }, '!') : h('span', { class: 'cfm-an-spin' })),
        h('td', {}, sm ? fmt(sm.solved7) : ''),
        h('td', {}, sm ? h('b', {}, fmt(sm.solved30)) : ''),
        h('td', {}, sm && sm.perDay30 != null ? fmt1(sm.perDay30) : sm ? '—' : ''),
        h('td', {}, sm?.avgRecent ? ratingChip(sm.avgRecent) : sm ? '—' : ''),
        h('td', {}, sm?.max30 ? ratingChip(sm.max30) : sm ? '—' : ''),
        h('td', {}, sm ? (sm.streak ? `🔥 ${sm.streak}` : '0') : ''),
        h('td', { class: 'l cfm-an-try' }, t ? [ratingChip(t.rating), ' ', t.url ? h('a', { href: t.url, title: t.name }, t.name) : t.name] : sm ? '—' : ''),
        h('td', { class: 'muted' }, sm ? ago(sm.lastTs) : ''),
        h('td', {}, vsCell(r, base)));
    });
    return h('div', { class: 'cfm-an-tablewrap' }, h('table', { class: 'cfm-an-table' }, h('thead', {}, head), h('tbody', {}, body)));
  }

  /** Ranking dos últimos 30 dias (barras), só quem já carregou. */
  function compareChart(group) {
    const done = group.rows.filter((r) => r.sum).sort((a, b) => b.sum.solved30 - a.sum.solved30).slice(0, 12);
    if (!done.length) return null;
    return hbars(done.map((r) => ({
      label: r.isOwner ? `${r.handle} (${T('anYou')})` : r.handle,
      value: r.sum.solved30,
      color: r.isOwner ? 'var(--cfm-accent)' : S.rankColor(r.rating, isDark()),
      tip: `${r.handle}: ${T('hmSolvedN', { n: r.sum.solved30 })} · ${T('anAvgRecent')} ${r.sum.avgRecent ?? '—'}`,
    })));
  }

  async function loadGroup(kind) {
    const owner = state.handle;
    const group = (state.cmp[kind] ||= { rows: [], status: '', sortKey: 'solved30', sortDir: -1, limit: 30, loading: false, all: null, title: '' });
    if (group.loading) return;
    group.loading = true;
    try {
      if (!group.all) {
        group.status = T('anLoadingList');
        renderCompare();
        const g = await API().group(kind, {
          orgId: settings.orgId,
          onProgress: (p, total) => {
            group.status = T('stLoadingOrgPage', { p, total });
            renderCompare();
          },
        });
        const others = g.people.filter((x) => x.handle.toLowerCase() !== owner.toLowerCase());
        group.title = kind === 'friends' ? T('anFriendsTitle', { n: others.length }) : T('anOrgTitle', { org: g.name, n: g.people.length });
        let me = g.people.find((x) => x.handle.toLowerCase() === owner.toLowerCase());
        if (!me) me = { handle: owner, rating: state.info?.rating, lastOnline: 0 };
        // você primeiro, depois os mais ativos (instituições podem ter milhares de membros)
        group.all = [{ ...me, isOwner: true }, ...others.map((x) => ({ ...x, isOwner: false }))];
      }
      group.rows = group.all.slice(0, group.limit + 1);
      const todo = group.rows.filter((r) => !r.sum && !r.error);
      let n = group.rows.length - todo.length;
      for (const r of todo) {
        if (!state || state.tab !== kind) break; // o usuário saiu da aba: para de baixar
        group.status = T('anLoadingPeople', { n: n + 1, total: group.rows.length });
        renderCompare();
        try {
          r.sum = r.isOwner ? S.compact(state.sum) : await API().summary(r.handle);
        } catch (e) {
          r.error = e.message;
        }
        n++;
      }
      group.status = '';
    } catch (e) {
      group.status = e.message || String(e);
    } finally {
      group.loading = false;
      renderCompare();
    }
  }

  function renderCompare() {
    if (!state || (state.tab !== 'friends' && state.tab !== 'org')) return;
    const kind = state.tab;
    const group = state.cmp[kind];
    const box = state.panel;
    if (!group) {
      box.replaceChildren(h('p', { class: 'cfm-an-empty' }, T('anLoading')));
      return;
    }
    const more = group.all && group.all.length > group.rows.length && !group.loading
      ? h('button', { type: 'button', class: 'cfm-btn', onclick: () => { group.limit += 30; loadGroup(kind); } },
          T('anLoadMore', { n: Math.min(30, group.all.length - group.rows.length) }))
      : null;
    const chart = compareChart(group);
    const gs = S.groupSummary(group.rows);
    const gname = slug(`${state.handle}-${kind === 'friends' ? 'friends' : group.title.replace(/\s*\(.*$/, '') || 'org'}`);
    const gExport = gs.n
      ? exportButtons([
          ['CSV', () => download(`${gname}-${stamp()}.csv`, S.groupCSV(group.rows), 'text/csv;charset=utf-8'), T('anExportGroupTip')],
          ['JSON', () => download(`${gname}-${stamp()}.json`, JSON.stringify({
            exportedAt: new Date().toISOString(), source: 'Hiraku Codeforces', group: group.title, owner: state.handle, summary: gs,
            people: group.rows.map((r) => ({ handle: r.handle, rating: r.rating ?? null, isOwner: !!r.isOwner, ...(r.sum || {}) })),
          }, null, 2), 'application/json'), T('anExportGroupTip')],
        ])
      : null;
    const gk = gs.n
      ? h('div', { class: 'cfm-an-kpis' },
          kpi(T('anGPeople'), fmt(gs.n), T('anGActive7', { n: gs.active7 })),
          kpi(T('anGTotal30'), fmt(gs.total30), T('anGAvg30', { n: fmt1(gs.avg30) })),
          kpi(T('anGPerDay'), fmt1(gs.perDayPerPerson), T('anGPerDaySub')),
          kpi(T('anGLevel'), gs.avgLevel ? String(gs.avgLevel) : '—', T('anGLevelSub')),
          kpi(T('anGMost'), gs.mostActive.handle, T('hmSolvedN', { n: gs.mostActive.n })),
          kpi(T('anGStreak'), gs.longestStreak.handle, T('anDaysN', { n: gs.longestStreak.n })))
      : null;
    box.replaceChildren(h('div', { class: 'cfm-an-body' },
      h('div', { class: 'cfm-an-cmphead' },
        h('div', {}, h('h3', {}, group.title || (kind === 'friends' ? T('anFriends') : T('anOrg'))),
          h('p', { class: 'cfm-an-note' }, kind === 'org' ? T('anOrgNote') : T('anFriendsNote'))),
        h('div', { class: 'cfm-an-cmpside' }, h('span', { class: 'cfm-status' }, group.status), gExport)),
      gk,
      chart ? card(T('anRank30'), chart) : null,
      group.rows.length ? compareTable(group) : null,
      more));
  }

  /* ------------------------------ montagem ------------------------------ */

  function header() {
    const { info, handle } = state;
    const rating = info?.rating;
    const rank = S.rankOf(rating);
    const tabs = [['overview', T('anOverview')], ['friends', T('anFriends')], ['org', T('anOrg')]];
    return h('div', { class: 'cfm-an-head' },
      info?.titlePhoto ? h('img', { class: 'cfm-an-avatar', src: info.titlePhoto, alt: '' }) : null,
      h('div', { class: 'cfm-an-who' },
        h('p', { class: 'cfm-an-kicker' }, globalThis.CFM_MARK ? globalThis.CFM_MARK() : null, 'Hiraku Analytics'),
        h('h2', {}, userLink(handle, rating)),
        h('p', { class: 'cfm-an-sub' },
          rank ? T(`rank_${rank.key}`) : T('anUnrated'),
          rating ? ` · ${rating}` : '',
          info?.maxRating ? ` (${T('anMax')} ${info.maxRating})` : '',
          info?.organization ? ` · ${info.organization}` : '')),
      h('nav', { class: 'cfm-an-tabs', role: 'tablist' },
        tabs.map(([k, label]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(state.tab === k), class: state.tab === k ? 'on' : '', onclick: () => switchTab(k) }, label))),
      state.sum && state.tab === 'overview'
        ? exportButtons([
            ['CSV', () => download(`${slug(handle)}-solved-${stamp()}.csv`, S.solvedCSV(state.sum), 'text/csv;charset=utf-8'), T('anExportSolvedTip')],
            ['JSON', () => download(`${slug(handle)}-analytics-${stamp()}.json`, personJSON(), 'application/json'), T('anExportJsonTip')],
          ])
        : null,
      h('a', { class: 'cfm-an-back', href: `/profile/${encodeURIComponent(handle)}` }, T('anBack')));
  }

  /** Tudo o que a visão geral mostra, num JSON (sem a lista crua de envios). */
  function personJSON() {
    const { handle, info, sum, ratingHist } = state;
    const { solvedList, byDay, trying, ...rest } = sum;
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      source: 'Hiraku Codeforces',
      handle,
      rating: info?.rating ?? null,
      maxRating: info?.maxRating ?? null,
      organization: info?.organization || null,
      summary: rest,
      contests: S.contestStats(ratingHist),
      ratingHistory: ratingHist.map((r) => ({ contestId: r.contestId, contest: r.contestName, rank: r.rank, oldRating: r.oldRating, newRating: r.newRating, date: S.dayKey(r.ratingUpdateTimeSeconds) })),
      solved: solvedList.map((p) => ({ date: S.dayKey(p.ts), problem: p.key, name: p.name, rating: p.rating, tries: p.tries, tags: p.tags })),
      tryingNow: sum.tryingNow,
      daily: byDay,
    }, null, 2);
  }

  function switchTab(k) {
    state.tab = k;
    state.headBox.replaceChildren(header());
    if (k === 'overview') state.panel.replaceChildren(overview());
    else {
      renderCompare();
      loadGroup(k);
    }
  }

  async function open() {
    const handle = pageHandle();
    const content = document.getElementById('pageContent');
    if (!handle || !content) return;
    if (state && state.handle === handle && state.root.isConnected) return;
    close();
    document.documentElement.setAttribute('data-cfm-an', '');
    const headBox = h('div');
    const panel = h('div', {}, h('p', { class: 'cfm-an-empty cfm-an-loading' }, T('anLoadingSubs')));
    const root = h('div', { class: 'cfm-an', translate: 'no', 'data-cfm-skip': '' }, headBox, panel);
    for (const c of content.children) c.setAttribute('data-cfm-an-hidden', '');
    content.prepend(root);
    root.addEventListener('mouseover', onOver);
    root.addEventListener('mouseleave', () => tip && (tip.hidden = true));
    state = { handle, root, headBox, panel, tab: 'overview', info: null, sum: null, ratingHist: [], cmp: {} };
    scrollTo({ top: 0 });
    try {
      const [info] = await API().info([handle]);
      state.info = info;
      headBox.replaceChildren(header());
      state.sum = await API().fullSummary(handle);
      globalThis.CFM_HEATMAP?.setSummary(handle, state.sum);
      try {
        state.ratingHist = await API().rating(handle);
      } catch (e) {
        state.ratingHist = [];
      }
      if (state && state.root === root && state.tab === 'overview') {
        headBox.replaceChildren(header());
        panel.replaceChildren(overview());
      }
    } catch (e) {
      panel.replaceChildren(h('p', { class: 'cfm-an-empty' }, e.message || String(e)));
    }
  }

  function close() {
    if (!state) return;
    state.root.remove();
    for (const c of document.querySelectorAll('[data-cfm-an-hidden]')) c.removeAttribute('data-cfm-an-hidden');
    document.documentElement.removeAttribute('data-cfm-an');
    if (tip) tip.hidden = true;
    state = null;
  }

  function route() {
    if (location.hash !== HASH) return close();
    if (PROFILE.test(location.pathname)) return open();
    // #hiraku fora do perfil (ex.: botão do popup): vai para o seu perfil
    const me = API()?.me();
    if (me) location.replace(`/profile/${encodeURIComponent(me)}${HASH}`);
  }

  function addNav() {
    if (navAdded) return;
    const ul = document.querySelector('.menu-list.main-menu-list, .menu-list-container .menu-list');
    const me = API()?.me();
    if (!ul || !me) return;
    navAdded = true;
    const a = h('a', { href: `/profile/${encodeURIComponent(me)}${HASH}`, class: 'cfm-an-nav' }, T('anNav'));
    ul.append(h('li', { 'data-cfm-an-nav': '' }, a));
    // lembra o handle para o popup abrir o analytics direto
    API().setStore({ 'an:me': me });
  }

  function ready() {
    addNav();
    route();
  }

  globalThis.CFM_ANALYTICS = {
    update(s, t) {
      const relabel = t !== T;
      const sig = `${isDark()}|${s.uiLang}`;
      const repaint = state && state.sig && state.sig !== sig;
      settings = s;
      T = t;
      if (state) state.sig = sig;
      if (repaint && state.sum) switchTab(state.tab);
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready, { once: true });
      } else {
        ready();
        if (relabel) {
          const a = document.querySelector('[data-cfm-an-nav] a');
          if (a) a.textContent = T('anNav');
        }
      }
    },
  };
  addEventListener('hashchange', route);
})();
