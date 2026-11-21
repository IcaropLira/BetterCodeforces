// Acesso a dados do Codeforces para o heatmap e o analytics.
//
// - API pública, sempre anônima (credentials: 'omit'). O Codeforces limita a uma chamada
//   a cada 2 s, então tudo passa por uma fila única, com nova tentativa se ele reclamar.
// - Amigos: a API exige chave, mas a página /friends funciona com a sua sessão — como este
//   script roda no próprio codeforces.com, basta lê-la.
// - Cache em storage.local: resumos por handle (30 min), lista de problemas (24 h).
//   Nada sai do Codeforces.
(() => {
  'use strict';
  if (globalThis.CFM_API) return;
  const ext = globalThis.browser ?? globalThis.chrome;
  const S = globalThis.CFM_STATS;

  const GAP_MS = 2100;
  const SUM_TTL = 30 * 60 * 1000;
  const PS_TTL = 24 * 3600 * 1000;

  let last = 0;
  let chain = Promise.resolve();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Chamada à API, em fila. Lança Error(comment) se o Codeforces recusar. */
  function call(method, params = {}) {
    const run = async () => {
      const qs = new URLSearchParams(params).toString();
      const url = `/api/${method}${qs ? `?${qs}` : ''}`;
      for (let attempt = 0; attempt < 3; attempt++) {
        const wait = last + GAP_MS - Date.now();
        if (wait > 0) await sleep(wait);
        last = Date.now();
        let data;
        try {
          const res = await fetch(url, { credentials: 'omit' });
          data = await res.json();
        } catch (e) {
          if (attempt === 2) throw new Error('Codeforces API indisponível');
          await sleep(1500);
          continue;
        }
        if (data.status === 'OK') return data.result;
        if (/call limit/i.test(data.comment || '')) {
          await sleep(2500);
          continue;
        }
        throw new Error(data.comment || 'Codeforces API');
      }
      throw new Error('Codeforces API: limite de chamadas');
    };
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  }

  async function getStore(key) {
    try {
      return (await ext.storage.local.get(key))[key];
    } catch (e) {
      return undefined;
    }
  }
  const setStore = (obj) => {
    try {
      return Promise.resolve(ext.storage.local.set(obj)).catch(() => {});
    } catch (e) {
      return Promise.resolve();
    }
  };

  const statusMem = new Map();

  /** Todos os envios de um handle (em memória por 10 min nesta aba). */
  async function status(handle) {
    const k = handle.toLowerCase();
    const hit = statusMem.get(k);
    if (hit && Date.now() - hit.t < 10 * 60 * 1000) return hit.v;
    const v = await call('user.status', { handle });
    statusMem.set(k, { v, t: Date.now() });
    return v;
  }

  /** user.info em lotes; handles inexistentes são descartados em vez de derrubar o lote. */
  async function info(handles) {
    const out = [];
    let rest = handles.slice();
    while (rest.length) {
      let batch = rest.slice(0, 300);
      rest = rest.slice(300);
      for (let i = 0; i < 5 && batch.length; i++) {
        try {
          out.push(...(await call('user.info', { handles: batch.join(';') })));
          break;
        } catch (e) {
          const m = /handles: User with handle (\S+) not found/i.exec(e.message);
          if (!m) throw e;
          batch = batch.filter((h) => h.toLowerCase() !== m[1].toLowerCase());
        }
      }
    }
    return out;
  }

  const rating = (handle) => call('user.rating', { handle });

  /** Resumo (completo) de um handle, e o compacto vai para o cache. */
  async function fullSummary(handle) {
    const sum = S.summarize(await status(handle));
    setStore({ [`an:sum:${handle.toLowerCase()}`]: { ...S.compact(sum), t: Date.now() } });
    return sum;
  }

  /** Resumo compacto (cache de 30 min). */
  async function summary(handle, { fresh = false } = {}) {
    const key = `an:sum:${handle.toLowerCase()}`;
    if (!fresh) {
      const c = await getStore(key);
      if (c && Date.now() - c.t < SUM_TTL) return c;
    }
    return S.compact(await fullSummary(handle));
  }

  /** Lista de problemas (só o necessário para sugestões), cache de 24 h. */
  async function problemset() {
    const c = await getStore('an:problemset');
    if (c && Date.now() - c.t < PS_TTL) return c;
    const r = await call('problemset.problems');
    const v = {
      t: Date.now(),
      problems: r.problems
        .filter((p) => p.rating)
        .map(({ contestId, index, name, rating: rt, tags }) => ({ contestId, index, name, rating: rt, tags })),
      problemStatistics: r.problemStatistics.map(({ contestId, index, solvedCount }) => ({ contestId, index, solvedCount })),
    };
    setStore({ 'an:problemset': v });
    return v;
  }

  /** Amigos do usuário logado, lidos da página /friends (precisa da sessão). */
  async function friends() {
    const res = await fetch('/friends', { credentials: 'include' });
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    if (res.status === 403 || /just a moment/i.test(doc.title)) throw new Error('Codeforces pediu para ir mais devagar');
    const seen = new Set();
    const out = [];
    for (const a of doc.querySelectorAll('.datatable a[href^="/profile/"]')) {
      const h = a.textContent.trim();
      if (!h || seen.has(h.toLowerCase())) continue;
      seen.add(h.toLowerCase());
      out.push({ h, cls: (a.className.match(/\buser-\w+/) || [''])[0] });
    }
    return out;
  }

  function me() {
    const a = document.querySelector('#header a[href^="/profile/"], .lang-chooser a[href^="/profile/"]');
    return a ? decodeURIComponent(a.getAttribute('href').split('/').pop()) : '';
  }

  globalThis.CFM_API = { call, status, info, rating, summary, fullSummary, problemset, friends, me, getStore, setStore };
})();
