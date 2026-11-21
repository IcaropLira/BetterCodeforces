// Standings: busca rápida e "college standings" (só a sua instituição).
//
// Como o Codeforces não tem filtro por organização, montamos um:
//   1. Descobrimos a organização (a do usuário logado, lida do perfil, ou a que foi
//      escolhida no popup) e baixamos a lista de membros em /ratings/organization/<id>.
//      As páginas são pedidas uma por vez, com pausa — o Cloudflare do Codeforces
//      bloqueia rajadas. A lista fica em cache por alguns dias.
//   2. Contest normal: o Codeforces só libera a classificação completa numa chamada
//      anônima da API, sem parâmetros (contest.standings?contestId=<id>). Pegamos as
//      linhas dos membros e montamos uma tabela com a posição na instituição e a geral.
//   3. Gym / grupo: a API exige chave, então filtramos as linhas da página aberta.
// Nada sai do Codeforces: todas as chamadas vão para o próprio site.
(() => {
  'use strict';
  if (globalThis.CFM_STANDINGS) return;
  const ext = globalThis.browser ?? globalThis.chrome;

  const PATH = /^\/(?:contest|gym|group\/[^/]+\/contest)\/(\d+)\/standings(?:\/|$)/;
  const ORG_TTL = 3 * 24 * 3600 * 1000;
  const ME_TTL = 7 * 24 * 3600 * 1000;
  const MAX_ORG_PAGES = 25; // 25 × 200 = 5000 membros
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let T = (k) => k;
  let settings = {};
  let ui = null;
  let table = null; // table.standings original
  let mode = 'all';
  let busy = false;
  const apiCache = new Map();

  const norm = (h) => String(h || '').trim().toLowerCase();

  /* ----------------------------- dados ----------------------------- */

  async function getStore(key) {
    try {
      return (await ext.storage.local.get(key))[key];
    } catch (e) {
      return undefined;
    }
  }
  const setStore = (obj) => ext.storage.local.set(obj).catch(() => {});

  async function fetchDoc(url) {
    const res = await fetch(url, { credentials: 'include' });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (res.status === 403 || /just a moment/i.test(doc.title)) throw new Error(T('stBlocked'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return doc;
  }

  /** "58605", "https://codeforces.com/ratings/organization/58605" → "58605". */
  function parseOrgId(v) {
    const m = /(?:organization\/)?(\d+)\s*\/?\s*$/.exec(String(v || '').trim());
    return m ? m[1] : '';
  }

  function loggedHandle() {
    const a = document.querySelector('#header a[href^="/profile/"], .lang-chooser a[href^="/profile/"]');
    return a ? decodeURIComponent(a.getAttribute('href').split('/').pop()) : '';
  }

  /** Organização do usuário logado, lida do próprio perfil (link /ratings/organization/<id>). */
  async function myOrg() {
    const handle = loggedHandle();
    if (!handle) return null;
    const cached = await getStore('st:me');
    if (cached && cached.handle === handle && Date.now() - cached.ts < ME_TTL) return cached.id ? cached : null;
    const doc = await fetchDoc(`/profile/${encodeURIComponent(handle)}`);
    const a = doc.querySelector('a[href*="/ratings/organization/"]');
    const id = a ? parseOrgId(a.getAttribute('href')) : '';
    const info = { handle, id, name: a ? a.textContent.trim() : '', ts: Date.now() };
    setStore({ 'st:me': info });
    return id ? info : null;
  }

  /** Membros da organização: { name, members: { handle(minúsculo): { h, cls } } }. */
  async function orgMembers(id, nameHint, onProgress) {
    const key = `st:org:${id}`;
    const cached = await getStore(key);
    if (cached && Date.now() - cached.ts < ORG_TTL && cached.members) return cached;

    const members = {};
    let name = nameHint || '';
    let pages = 1;
    for (let p = 1; p <= pages && p <= MAX_ORG_PAGES; p++) {
      if (p > 1) await sleep(900);
      onProgress && onProgress(p, pages);
      const doc = await fetchDoc(p === 1 ? `/ratings/organization/${id}` : `/ratings/organization/${id}/page/${p}`);
      if (p === 1) {
        for (const e of doc.querySelectorAll('.pagination .page-index[pageindex]')) {
          pages = Math.max(pages, Number(e.getAttribute('pageindex')) || 1);
        }
        if (!name) name = `#${id}`; // a página de ranking não mostra o nome
      }
      for (const a of doc.querySelectorAll('.datatable a[href^="/profile/"]')) {
        const h = a.textContent.trim();
        if (!h) continue;
        const cls = (a.className.match(/\buser-\w+/) || [''])[0];
        members[norm(h)] = { h, cls };
      }
    }
    const out = { id, name, members, ts: Date.now() };
    setStore({ [key]: out });
    return out;
  }

  async function contestStandings(contestId) {
    if (apiCache.has(contestId)) return apiCache.get(contestId);
    // Só a chamada anônima e sem parâmetros é aceita para contests normais.
    const res = await fetch(`/api/contest.standings?contestId=${contestId}`, { credentials: 'omit' });
    const data = await res.json();
    if (data.status !== 'OK') throw new Error(data.comment || 'API');
    apiCache.set(contestId, data.result);
    return data.result;
  }

  /* --------------------------- renderização --------------------------- */

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

  const clock = (sec) => {
    const m = Math.floor(sec / 60);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };

  /** Linhas da API → tabela no mesmo estilo do Codeforces. Exportado para os testes. */
  function buildApiTable(result, org) {
    const type = result.contest.type; // CF | IOI | ICPC
    const rows = result.rows.filter((r) => r.party.members.some((m) => org.members[norm(m.handle)]));
    const head = h('tr', {},
      h('th', { class: 'cfm-st-rank', title: T('stRankOrg') }, '#'),
      h('th', { class: 'cfm-st-rank', title: T('stRankAll') }, T('stGlobal')),
      h('th', { class: 'cfm-st-who' }, T('stWho')),
      h('th', {}, type === 'ICPC' ? '=' : T('stPoints')),
      h('th', {}, T('stPenalty')),
      ...result.problems.map((p) => h('th', { title: p.name || '' }, p.index)));
    const body = [head];
    let pos = 0;
    let prevKey = null;
    rows.forEach((r, i) => {
      const key = `${r.points}|${r.penalty}`;
      if (key !== prevKey) pos = i + 1;
      prevKey = key;
      const who = h('td', { class: 'cfm-st-who' });
      if (r.party.teamName) who.append(h('span', { class: 'cfm-st-team' }, r.party.teamName), ': ');
      r.party.members.forEach((m, j) => {
        if (j) who.append(', ');
        const info = org.members[norm(m.handle)];
        who.append(h('a', { href: `/profile/${m.handle}`, class: `rated-user ${info ? info.cls : ''}` }, m.handle));
      });
      if (r.party.participantType === 'OUT_OF_COMPETITION') who.append(h('sup', { title: T('stOoc') }, ' *'));
      const cells = result.problems.map((p, k) => {
        const pr = r.problemResults[k] || {};
        if (pr.points > 0) {
          const label = type === 'ICPC' ? `+${pr.rejectedAttemptCount || ''}` : String(pr.points);
          const t = pr.bestSubmissionTimeSeconds != null ? h('small', {}, clock(pr.bestSubmissionTimeSeconds)) : null;
          return h('td', { class: 'cfm-st-ok' }, h('b', {}, label), t);
        }
        if (pr.rejectedAttemptCount) return h('td', { class: 'cfm-st-bad' }, h('b', {}, `-${pr.rejectedAttemptCount}`));
        return h('td', {}, '');
      });
      body.push(h('tr', { participantid: String(r.party.participantId || '') },
        h('td', { class: 'cfm-st-rank' }, h('b', {}, String(pos))),
        h('td', { class: 'cfm-st-rank cfm-st-muted' }, String(r.rank)),
        who,
        h('td', {}, String(r.points)),
        h('td', {}, String(r.penalty || '')),
        ...cells));
    });
    const tbl = h('table', { class: 'standings cfm-st-table' }, h('tbody', {}, ...body));
    return { el: h('div', { class: 'datatable cfm-st-wrap' }, tbl), count: rows.length };
  }

  /** Gym/grupo: esconde da página aberta quem não é da organização. */
  function filterPageByOrg(org) {
    let n = 0;
    for (const tr of table.querySelectorAll('tr[participantid]')) {
      const handles = Array.from(tr.querySelectorAll('a[href^="/profile/"]')).map((a) => norm(a.textContent));
      const hit = handles.some((x) => org.members[x]);
      tr.toggleAttribute('data-cfm-st-out', !hit);
      if (hit) n++;
    }
    return n;
  }

  function clearPageFilter() {
    for (const tr of table.querySelectorAll('[data-cfm-st-out]')) tr.removeAttribute('data-cfm-st-out');
  }

  /** Busca por texto: vale para a tabela visível (a original ou a da instituição). */
  function applySearch() {
    const q = norm(ui.search.value);
    const scope = ui.alt && !ui.alt.hidden ? ui.alt : table;
    for (const tr of scope.querySelectorAll('tr[participantid]')) {
      const who = tr.querySelector('.contestant-cell, .cfm-st-who') || tr;
      tr.toggleAttribute('data-cfm-st-miss', !!q && !norm(who.textContent).includes(q));
    }
  }

  /* ------------------------------- UI ------------------------------- */

  function setStatus(text) {
    ui.status.textContent = text || '';
    ui.status.title = text || '';
  }

  function renderSeg() {
    for (const b of ui.seg.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === mode);
  }

  async function resolveOrg(onProgress, orgId = settings.orgId) {
    let id = parseOrgId(orgId);
    let name = '';
    if (!id) {
      const me = await myOrg();
      if (!me) throw new Error(T('stNoOrg'));
      id = me.id;
      name = me.name;
    }
    return orgMembers(id, name, onProgress);
  }

  async function showOrg() {
    if (busy) return;
    busy = true;
    mode = 'org';
    renderSeg();
    try {
      setStatus(T('stLoadingOrg'));
      const org = await resolveOrg((p, total) => setStatus(T('stLoadingOrgPage', { p, total })));
      ui.orgBtn.textContent = org.name || T('stMyOrg');
      const m = PATH.exec(location.pathname);
      const isContest = /^\/contest\//.test(location.pathname);
      if (isContest) {
        setStatus(T('stLoadingAll'));
        const result = await contestStandings(m[1]);
        const built = buildApiTable(result, org);
        if (ui.alt) ui.alt.remove();
        ui.alt = built.el;
        ui.wrap.after(ui.alt);
        ui.wrap.hidden = true;
        setStatus(T('stOrgCount', { n: built.count, total: result.rows.length, org: org.name }));
      } else {
        const n = filterPageByOrg(org);
        setStatus(T('stOrgPageCount', { n, org: org.name }));
      }
      applySearch();
    } catch (e) {
      mode = 'all';
      renderSeg();
      showAll();
      setStatus(e.message || String(e));
    } finally {
      busy = false;
    }
  }

  function showAll() {
    mode = 'all';
    renderSeg();
    if (ui.alt) ui.alt.hidden = true;
    ui.wrap.hidden = false;
    clearPageFilter();
    applySearch();
    setStatus('');
  }

  function mount() {
    table = document.querySelector('table.standings');
    if (!table || ui) return;
    const wrap = table.closest('.datatable') || table;
    const search = h('input', { type: 'search', class: 'cfm-st-search', placeholder: T('stSearch'), oninput: applySearch });
    const allBtn = h('button', { type: 'button', 'data-v': 'all', onclick: showAll }, T('stAll'));
    const orgBtn = h('button', { type: 'button', 'data-v': 'org', onclick: showOrg, title: T('stOrgTitle') }, T('stMyOrg'));
    const seg = h('div', { class: 'cfm-seg', role: 'group' }, allBtn, orgBtn);
    const status = h('span', { class: 'cfm-status' });
    const bar = h('div', { class: 'cfm-toolbar cfm-st-bar', translate: 'no', 'data-cfm-skip': '' },
      globalThis.CFM_MARK ? globalThis.CFM_MARK() : null, seg, search, status);
    wrap.before(bar);
    ui = { bar, search, seg, orgBtn, status, wrap, alt: null };
    renderSeg();
    if (settings.collegeDefault) showOrg();
  }

  globalThis.CFM_STANDINGS = {
    PATH,
    parseOrgId,
    buildApiTable,
    // reaproveitados pela página de analytics
    myOrg,
    orgMembers,
    /** Organização configurada (ou a do perfil) com a lista de membros. */
    org: (orgId, onProgress) => resolveOrg(onProgress, orgId ?? settings.orgId),
    setT(t) {
      T = t;
    },
    /** Chamado pelo content.js quando as configurações carregam ou mudam. */
    update(s, t) {
      settings = s;
      T = t;
      if (!PATH.test(location.pathname)) return;
      if (!ui) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
        else mount();
      } else {
        ui.search.placeholder = T('stSearch');
      }
    },
  };
})();
