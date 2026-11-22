// "Quem você conhece": na página de um problema, uma caixa na sidebar com o seu status
// e os amigos / colegas de instituição que já resolveram (ou tentaram) o problema.
//
// Para cada pessoa guardamos um índice compacto { problema: ts } (CFM_API.solvedIndex),
// montado a partir de user.status e válido por 12 h — depois do primeiro carregamento,
// abrir qualquer problema é instantâneo. Quem ainda não tem índice é carregado em
// segundo plano, um por vez (a API aceita uma chamada a cada 2 s).
(() => {
  'use strict';
  if (globalThis.CFM_SOLVEDBY) return;
  const S = globalThis.CFM_STATS;
  const API = () => globalThis.CFM_API;
  const ORG_LIMIT = 30;
  const SHOW = 8;

  let T = (k) => k;
  let settings = {};
  let box = null;
  let run = 0; // invalida carregamentos antigos (ex.: "Atualizar")
  let data = null; // { key, me, people: [{ handle, rating, friend, org, idx, t }], progress }

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

  const isDark = () => {
    const html = document.documentElement;
    return html.getAttribute('data-cfm') !== 'off' && html.getAttribute('data-cfm-theme') === 'dark';
  };
  const date = (ts) => new Date(Math.abs(ts) * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });
  const ago = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 60) return `${Math.max(1, m)} min`;
    const hr = Math.round(m / 60);
    return hr < 48 ? `${hr} h` : `${Math.round(hr / 24)} d`;
  };
  const user = (p) => h('a', { href: `/profile/${encodeURIComponent(p.handle)}`, class: 'cfm-sb-user', style: `color:${S.rankColor(p.rating, isDark())}` }, p.handle);

  function section(title, people, key) {
    const solved = people.filter((p) => p.idx && p.idx[key] > 0).sort((a, b) => a.idx[key] - b.idx[key]);
    const tried = people.filter((p) => p.idx && p.idx[key] < 0);
    const shown = solved.slice(0, SHOW);
    return h('div', { class: 'cfm-sb-sec' },
      h('div', { class: 'cfm-sb-head' }, h('b', {}, title), h('span', { class: 'cfm-sb-count' }, T('sbSolved', { n: solved.length }))),
      solved.length
        ? h('ul', { class: 'cfm-sb-list' },
            shown.map((p) => h('li', {}, user(p), h('small', {}, date(p.idx[key])))),
            solved.length > SHOW
              ? h('li', { class: 'cfm-sb-more', title: solved.slice(SHOW).map((p) => p.handle).join(', ') }, T('sbMore', { n: solved.length - SHOW }))
              : null)
        : h('p', { class: 'cfm-sb-empty' }, T('sbNobody')),
      tried.length
        ? h('p', { class: 'cfm-sb-tried' }, T('sbTried'), tried.slice(0, 6).flatMap((p, i) => [i ? ', ' : '', user(p)]), tried.length > 6 ? ` +${tried.length - 6}` : '')
        : null);
  }

  function render() {
    if (!box || !data) return;
    const { key, me, people, progress } = data;
    box.setAttribute('data-state', data.phase); // lists | cache | fetch | done (usado pelos testes)
    const friends = people.filter((p) => p.friend);
    const org = people.filter((p) => p.org && !p.friend);
    const mine = me && me.idx ? me.idx[key] : undefined;
    const you = !me
      ? null
      : h('p', { class: `cfm-sb-you ${mine > 0 ? 'is-ok' : mine < 0 ? 'is-tried' : ''}` },
          h('b', {}, T('sbYou')), ' · ',
          mine > 0 ? T('sbYouSolved', { d: date(mine) }) : mine < 0 ? T('sbYouTried', { d: date(mine) }) : me.idx ? T('sbYouNot') : '…');
    const oldest = people.filter((p) => p.t).reduce((a, p) => Math.min(a, p.t), Infinity);
    const foot = h('div', { class: 'cfm-sb-foot' },
      h('span', {}, progress ? T('sbChecking', progress) : isFinite(oldest) ? T('sbStale', { d: ago(oldest) }) : ''),
      h('button', { type: 'button', class: 'cfm-sb-refresh', onclick: () => load(true), disabled: progress ? true : null }, T('sbRefresh')));
    const body = !friends.length && !org.length && data.phase === 'done'
      ? [h('p', { class: 'cfm-sb-empty' }, T('sbNoGroup'))]
      : [friends.length ? section(T('sbFriends'), friends, key) : null, org.length ? section(T('sbOrg'), org, key) : null];
    box.replaceChildren(
      h('div', { class: 'cfm-sb-title' }, globalThis.CFM_MARK ? globalThis.CFM_MARK() : null, h('span', {}, T('sbTitle'))),
      you, ...body, foot);
  }

  async function load(force = false) {
    const id = ++run;
    const key = S.problemKeyFromPath(location.pathname);
    const meHandle = API().me();
    data = { key, me: meHandle ? { handle: meHandle } : null, people: [], progress: null, phase: 'lists' };
    render();

    // quem acompanhar: amigos e (opcional) os membros mais ativos da instituição
    const byH = new Map();
    const add = (p, tag) => {
      if (meHandle && p.handle.toLowerCase() === meHandle.toLowerCase()) return;
      const k = p.handle.toLowerCase();
      const cur = byH.get(k) || { handle: p.handle, rating: p.rating, friend: false, org: false };
      cur[tag] = true;
      byH.set(k, cur);
    };
    try {
      (await API().group('friends')).people.forEach((p) => add(p, 'friend'));
    } catch (e) {
      /* sem amigos ou sem sessão */
    }
    if (settings.solvedByOrg !== false) {
      try {
        (await API().group('org', { orgId: settings.orgId })).people.slice(0, ORG_LIMIT).forEach((p) => add(p, 'org'));
      } catch (e) {
        /* sem organização */
      }
    }
    if (id !== run) return;
    data.people = Array.from(byH.values());
    data.phase = 'cache';

    // o que já está em cache aparece na hora
    const todo = [];
    const everyone = data.me ? [data.me, ...data.people] : data.people;
    for (const p of everyone) {
      const c = await API().solvedIndex(p.handle, { fetchIfMissing: false });
      if (c) Object.assign(p, { idx: c.idx, t: c.t });
      if (!c || c.stale || force) todo.push(p);
    }
    if (id !== run) return;
    data.phase = 'fetch';
    render();

    // o resto em segundo plano, começando por você e pelos amigos
    todo.sort((a, b) => (b === data.me) - (a === data.me) || (b.friend - a.friend));
    for (let i = 0; i < todo.length; i++) {
      if (id !== run || !box?.isConnected) return;
      data.progress = { n: i + 1, total: todo.length };
      render();
      try {
        const c = await API().solvedIndex(todo[i].handle, { fresh: true });
        if (c) Object.assign(todo[i], { idx: c.idx, t: c.t });
      } catch (e) {
        /* handle sumiu ou API recusou: segue */
      }
    }
    if (id !== run) return;
    data.progress = null;
    data.phase = 'done';
    render();
  }

  function mount() {
    if (box || !S.problemKeyFromPath(location.pathname)) return;
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || !API()) return;
    box = h('section', { class: 'roundbox cfm-sb', translate: 'no', 'data-cfm-skip': '', 'aria-live': 'polite' });
    sidebar.prepend(box);
    load();
  }

  function unmount() {
    run++;
    box?.remove();
    box = null;
    data = null;
  }

  globalThis.CFM_SOLVEDBY = {
    update(s, t) {
      const wasOrg = settings.solvedByOrg;
      settings = s;
      T = t;
      if (!S.problemKeyFromPath(location.pathname)) return;
      if (s.solvedBy === false) return unmount();
      if (!box) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
        else mount();
      } else if (wasOrg !== undefined && wasOrg !== s.solvedByOrg) {
        load();
      } else {
        render();
      }
    },
  };
})();
