// Métricas a partir dos envios do Codeforces (API user.status). Funções puras, sem DOM
// nem rede — usadas pelo heatmap do perfil e pela página de analytics, testadas em test/.
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.CFM_STATS = lib;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DAY = 86400;

  /* --------------------------- ranks e cores --------------------------- */

  // Faixas oficiais do Codeforces. As cores "dark" são as mesmas matizes, reajustadas
  // para o fundo #160f26 e validadas (contraste ≥ 3:1, separação para daltonismo e
  // visão normal entre vizinhas). O cinza do "newbie" é cinza de propósito.
  const RANKS = [
    { min: -Infinity, key: 'newbie', light: '#808080', dark: '#8f879f' },
    { min: 1200, key: 'pupil', light: '#008000', dark: '#4da23a' },
    { min: 1400, key: 'specialist', light: '#03a89e', dark: '#1aa3b4' },
    { min: 1600, key: 'expert', light: '#0000ff', dark: '#6878f5' },
    { min: 1900, key: 'cm', light: '#aa00aa', dark: '#b852c4' },
    { min: 2100, key: 'master', light: '#ff8c00', dark: '#cf8f10' },
    { min: 2400, key: 'gm', light: '#ff0000', dark: '#e8384f' },
  ];

  function rankOf(rating) {
    if (typeof rating !== 'number' || !isFinite(rating)) return null;
    let r = RANKS[0];
    for (const x of RANKS) if (rating >= x.min) r = x;
    return r;
  }

  function rankColor(rating, dark) {
    const r = rankOf(rating);
    if (!r) return dark ? '#5d5470' : '#b8b0c8';
    return dark ? r.dark : r.light;
  }

  /* ------------------------------ datas ------------------------------ */

  const pad = (n) => String(n).padStart(2, '0');

  /** "AAAA-MM-DD" no fuso do navegador (o mesmo que o calendário do Codeforces usa). */
  function dayKey(sec) {
    const d = new Date(sec * 1000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** "11/23/2025" ou "1/5/2026" (data-date do Codeforces) → "2025-11-23". */
  function cfDateToKey(s) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '').trim());
    return m ? `${m[3]}-${pad(+m[1])}-${pad(+m[2])}` : null;
  }

  function keyToDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(key, n) {
    const d = keyToDate(key);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  const monthKey = (sec) => dayKey(sec).slice(0, 7);

  /* ----------------------------- problemas ----------------------------- */

  function problemKey(p) {
    if (!p) return '';
    if (p.contestId) return `${p.contestId}${p.index}`;
    return `${p.problemsetName || 'x'}:${p.index}:${p.name}`;
  }

  function problemUrl(p) {
    if (!p || !p.contestId) return null;
    return p.contestId >= 100000
      ? `/gym/${p.contestId}/problem/${p.index}`
      : `/problemset/problem/${p.contestId}/${p.index}`;
  }

  const LANG_FAMILY = [
    [/c\+\+|g\+\+|clang\+\+|msvc/i, 'C++'],
    [/pypy/i, 'PyPy'],
    [/python/i, 'Python'],
    [/java\b|java \d|openjdk/i, 'Java'],
    [/kotlin/i, 'Kotlin'],
    [/rust/i, 'Rust'],
    [/go\b|golang/i, 'Go'],
    [/c#|mono|\.net/i, 'C#'],
    [/javascript|node\.?js|v8/i, 'JavaScript'],
    [/haskell/i, 'Haskell'],
    [/gnu c11|gnu c\b|\bc11\b|\bc\b/i, 'C'],
  ];
  function langFamily(lang) {
    for (const [re, name] of LANG_FAMILY) if (re.test(lang || '')) return name;
    return lang || '?';
  }

  /* --------------------------- resumo principal --------------------------- */

  /**
   * Resume os envios de um usuário.
   * @param {Array} subs  resultado de user.status (mais recente primeiro, como a API devolve)
   * @param {number} now  agora, em segundos (injetável para os testes)
   */
  function summarize(subs, now = Date.now() / 1000) {
    const list = Array.isArray(subs) ? subs.filter((s) => s && s.problem) : [];
    const ordered = list.slice().sort((a, b) => a.creationTimeSeconds - b.creationTimeSeconds);

    const solved = new Map(); // chave → { rating, tags, name, url, ts }
    const attempts = new Map(); // chave → { problem, n, last }
    const byDay = {}; // AAAA-MM-DD → { subs, ac, solved, ratings: [] }
    const verdicts = {};
    const langs = {};
    const hours = new Array(24).fill(0); // envios por hora do dia
    const weekdaySolved = new Array(7).fill(0); // resolvidos por dia da semana (0 = domingo)
    const inContest = new Map(); // problemas tentados durante um contest (para o upsolve)
    let acSubs = 0;

    for (const s of ordered) {
      const key = problemKey(s.problem);
      const day = dayKey(s.creationTimeSeconds);
      const d = (byDay[day] ||= { subs: 0, ac: 0, solved: 0, ratings: [] });
      d.subs++;
      const v = s.verdict || 'TESTING';
      verdicts[v] = (verdicts[v] || 0) + 1;
      const lf = langFamily(s.programmingLanguage);
      langs[lf] = (langs[lf] || 0) + 1;
      const when = new Date(s.creationTimeSeconds * 1000);
      hours[when.getHours()]++;
      const pt = s.author && s.author.participantType;
      if (pt === 'CONTESTANT' || pt === 'OUT_OF_COMPETITION' || pt === 'VIRTUAL') {
        inContest.set(key, { problem: s.problem, ts: s.creationTimeSeconds, type: pt });
      }

      const a = attempts.get(key) || { problem: s.problem, n: 0, last: 0 };
      a.n++;
      a.last = s.creationTimeSeconds;
      attempts.set(key, a);

      if (v === 'OK') {
        acSubs++;
        d.ac++;
        if (!solved.has(key)) {
          const rating = typeof s.problem.rating === 'number' ? s.problem.rating : null;
          solved.set(key, {
            key,
            rating,
            tags: s.problem.tags || [],
            name: s.problem.name,
            url: problemUrl(s.problem),
            ts: s.creationTimeSeconds,
            tries: a.n, // envios até o primeiro AC (inclusive)
            contestId: s.problem.contestId,
            index: s.problem.index,
          });
          d.solved++;
          weekdaySolved[when.getDay()]++;
          if (rating) d.ratings.push(rating);
        }
      }
    }

    const solvedList = Array.from(solved.values());
    const rated = solvedList.filter((p) => p.rating);
    const since = (days) => solvedList.filter((p) => p.ts >= now - days * DAY);
    const avg = (arr) => (arr.length ? Math.round(arr.reduce((x, y) => x + y, 0) / arr.length) : null);

    const last30 = since(30);
    const rated30 = last30.filter((p) => p.rating).map((p) => p.rating);
    const recentRated = rated
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 50)
      .map((p) => p.rating);

    const byRating = {};
    for (const p of rated) byRating[p.rating] = (byRating[p.rating] || 0) + 1;

    const byTag = {};
    for (const p of solvedList) for (const t of p.tags) byTag[t] = (byTag[t] || 0) + 1;

    // "tentando agora": tentou e ainda não resolveu, do mais recente para o mais antigo
    const trying = [];
    for (const [key, a] of attempts) {
      if (solved.has(key)) continue;
      trying.push({
        key,
        name: a.problem.name,
        rating: typeof a.problem.rating === 'number' ? a.problem.rating : null,
        url: problemUrl(a.problem),
        tries: a.n,
        ts: a.last,
      });
    }
    trying.sort((a, b) => b.ts - a.ts);

    // por mês (últimos 12, do mais antigo ao mais recente)
    const months = [];
    {
      const d = new Date(now * 1000);
      d.setDate(1);
      for (let i = 11; i >= 0; i--) {
        const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
        months.push(`${x.getFullYear()}-${pad(x.getMonth() + 1)}`);
      }
    }
    const perMonth = Object.fromEntries(months.map((m) => [m, 0]));
    for (const p of solvedList) {
      const m = monthKey(p.ts);
      if (m in perMonth) perMonth[m]++;
    }

    const lastTs = ordered.length ? ordered[ordered.length - 1].creationTimeSeconds : null;

    // nível (dificuldade média dos resolvidos com rating) e acumulado, mês a mês
    const monthLevel = Object.fromEntries(months.map((m) => [m, []]));
    for (const p of rated) {
      const m = monthKey(p.ts);
      if (m in monthLevel) monthLevel[m].push(p.rating);
    }
    const levelByMonth = Object.fromEntries(months.map((m) => [m, avg(monthLevel[m])]));
    const cumulative = {};
    {
      const firstMonth = months[0];
      let acc = solvedList.filter((p) => monthKey(p.ts) < firstMonth).length;
      for (const m of months) cumulative[m] = acc += perMonth[m];
    }

    // força por tag: entre os problemas que você tentou, quantos resolveu
    const tagStats = {};
    for (const [key, a] of attempts) {
      for (const t of a.problem.tags || []) {
        const x = (tagStats[t] ||= { solved: 0, unsolved: 0 });
        if (solved.has(key)) x.solved++;
        else x.unsolved++;
      }
    }

    // upsolve: tentou num contest e nunca resolveu
    const upsolve = [];
    for (const [key, c] of inContest) {
      if (solved.has(key)) continue;
      upsolve.push({ key, name: c.problem.name, rating: typeof c.problem.rating === 'number' ? c.problem.rating : null, url: problemUrl(c.problem), ts: c.ts, contestId: c.problem.contestId });
    }
    upsolve.sort((a, b) => b.ts - a.ts);

    const firstTry = solvedList.filter((p) => p.tries === 1).length;
    const solved90 = since(90).length;
    const solved365 = since(365).length;
    const solvedDays30 = Object.keys(byDay).filter((k) => k >= dayKey(now - 29 * DAY) && byDay[k].solved > 0).length;

    return {
      total: list.length,
      acSubs,
      acRate: list.length ? acSubs / list.length : 0,
      solved: solvedList.length,
      solvedList,
      solved7: since(7).length,
      solved30: last30.length,
      avg30: avg(rated30),
      avgRecent: avg(recentRated),
      maxRating: rated.length ? Math.max(...rated.map((p) => p.rating)) : null,
      max30: rated30.length ? Math.max(...rated30) : null,
      byDay,
      byRating,
      byTag,
      verdicts,
      langs,
      perMonth,
      trying,
      tryingNow: trying.filter((t) => t.ts >= now - 30 * DAY),
      lastTs,
      activeDays30: Object.keys(byDay).filter((k) => k >= dayKey(now - 29 * DAY)).length,
      solved90,
      solved365,
      solvedDays30,
      perDay: {
        d30: solvedList.length ? last30.length / 30 : 0,
        d90: solved90 / 90,
        d365: solved365 / 365,
        active30: solvedDays30 ? last30.length / solvedDays30 : 0, // nos dias em que resolveu algo
      },
      firstTry,
      firstTryRate: solvedList.length ? firstTry / solvedList.length : 0,
      triesPerSolved: solvedList.length ? solvedList.reduce((x, p) => x + p.tries, 0) / solvedList.length : 0,
      hours,
      weekdaySolved,
      levelByMonth,
      cumulative,
      tagStats,
      upsolve,
      ...streaks(byDay, now),
    };
  }

  /** Sequências de dias com pelo menos um problema novo resolvido. */
  function streaks(byDay, now = Date.now() / 1000) {
    const days = Object.keys(byDay)
      .filter((k) => byDay[k].solved > 0)
      .sort();
    let longest = 0;
    let run = 0;
    let prev = null;
    for (const k of days) {
      run = prev && addDays(prev, 1) === k ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = k;
    }
    // a atual vale se terminou hoje ou ontem (ainda dá para manter hoje)
    const today = dayKey(now);
    const set = new Set(days);
    let cur = 0;
    let k = set.has(today) ? today : addDays(today, -1);
    while (set.has(k)) {
      cur++;
      k = addDays(k, -1);
    }
    return { streak: cur, longestStreak: longest };
  }

  /** Versão pequena do resumo, para guardar em cache e montar tabelas de comparação. */
  function compact(sum) {
    return {
      solved: sum.solved,
      solved7: sum.solved7,
      solved30: sum.solved30,
      avg30: sum.avg30,
      avgRecent: sum.avgRecent,
      maxRating: sum.maxRating,
      max30: sum.max30,
      streak: sum.streak,
      longestStreak: sum.longestStreak,
      acRate: sum.acRate,
      lastTs: sum.lastTs,
      activeDays30: sum.activeDays30,
      solved90: sum.solved90,
      solved365: sum.solved365,
      perDay30: sum.perDay.d30,
      firstTryRate: sum.firstTryRate,
      tryingNow: sum.tryingNow.slice(0, 3).map(({ name, url, rating, ts, tries }) => ({ name, url, rating, ts, tries })),
    };
  }

  /* ----------------------------- heatmap ----------------------------- */

  const HEAT_MODES = ['cf', 'solved', 'subs', 'max', 'avg'];

  /**
   * Limites dos 4 tons de um modo de contagem, adaptados ao período (como o GitHub):
   * 1 e os quartis do maior valor. Com máximo ≤ 4 vira [1, 2, 3, 4].
   * @param {object} byDay  resumo por dia
   * @param {string} mode   'solved' | 'subs'
   * @param {string} [from] só dias a partir desta chave (ex.: últimos 12 meses)
   */
  function heatThresholds(byDay, mode, from = '') {
    let max = 0;
    for (const [k, d] of Object.entries(byDay || {})) if (k >= from) max = Math.max(max, dayValue(d, mode));
    const t = [1, Math.ceil(max * 0.25), Math.ceil(max * 0.5), Math.ceil(max * 0.75)];
    for (let i = 1; i < t.length; i++) t[i] = Math.max(t[i], t[i - 1] + 1);
    return t;
  }

  // Rampa sequencial de uma matiz (rosa Hiraku), do vazio ao mais intenso.
  const RAMP = {
    dark: ['#231a36', '#5c2147', '#93285f', '#cc3279', '#ff6aa8'],
    light: ['#ece6f2', '#f8c6dc', '#f290bd', '#e2508f', '#b0185d'],
  };

  /** Valor do dia num modo: contagem (solved/subs) ou rating (max/avg). */
  function dayValue(day, mode) {
    if (!day) return 0;
    if (mode === 'solved') return day.solved;
    if (mode === 'subs') return day.subs;
    if (!day.ratings.length) return day.solved ? -1 : 0; // -1 = resolveu, mas sem rating
    if (mode === 'max') return Math.max(...day.ratings);
    return Math.round(day.ratings.reduce((a, b) => a + b, 0) / day.ratings.length);
  }

  /** Cor do dia. dark = tema escuro; thr = heatThresholds(). Retorna null em 'cf' (cor original). */
  function heatColor(day, mode, dark, thr = [1, 2, 3, 4]) {
    if (mode === 'cf') return null;
    const ramp = dark ? RAMP.dark : RAMP.light;
    const v = dayValue(day, mode);
    if (!v) return ramp[0];
    if (mode === 'solved' || mode === 'subs') {
      const t = thr;
      let lvl = 0;
      for (let i = 0; i < t.length; i++) if (v >= t[i]) lvl = i + 1;
      return ramp[lvl];
    }
    if (v === -1) return dark ? '#5d5470' : '#b8b0c8';
    return rankColor(v, dark);
  }

  /** Itens da legenda de cada modo: [{ color, label }]. */
  function heatLegend(mode, dark, thr = [1, 2, 3, 4]) {
    const ramp = dark ? RAMP.dark : RAMP.light;
    if (mode === 'solved' || mode === 'subs') {
      const t = thr;
      const range = (a, b) => (b > a ? `${a}–${b}` : `${a}`);
      return [
        { color: ramp[0], label: '0' },
        { color: ramp[1], label: range(t[0], t[1] - 1) },
        { color: ramp[2], label: range(t[1], t[2] - 1) },
        { color: ramp[3], label: range(t[2], t[3] - 1) },
        { color: ramp[4], label: `${t[3]}+` },
      ];
    }
    if (mode === 'max' || mode === 'avg') {
      return RANKS.map((r, i) => ({
        color: dark ? r.dark : r.light,
        label: i === 0 ? '<1200' : i === RANKS.length - 1 ? `${r.min}+` : `${r.min}–${RANKS[i + 1].min - 1}`,
      }));
    }
    return [];
  }

  /* ---------------------------- sugestões ---------------------------- */

  /**
   * Problemas ainda não resolvidos perto do seu nível (um pouco acima da média recente),
   * dos mais resolvidos pela comunidade para os menos.
   * @param {Array} problems   problemset.problems → result.problems
   * @param {Array} stats      problemset.problems → result.problemStatistics
   */
  function suggest(problems, stats, sum, { count = 8, tag = null } = {}) {
    const base = sum.avgRecent || sum.maxRating || 1000;
    const lo = Math.max(800, Math.round((base + 0) / 100) * 100);
    const hi = lo + 300;
    const done = new Set(sum.solvedList.map((p) => p.key));
    const tried = new Set(sum.trying.map((t) => t.key));
    const solvedCount = new Map((stats || []).map((s) => [`${s.contestId}${s.index}`, s.solvedCount]));
    return (problems || [])
      .filter((p) => p.rating >= lo && p.rating <= hi && !done.has(problemKey(p)) && !tried.has(problemKey(p)))
      .filter((p) => !tag || (p.tags || []).includes(tag))
      .filter((p) => !(p.tags || []).includes('*special'))
      .map((p) => ({ p, n: solvedCount.get(problemKey(p)) || 0 }))
      .sort((a, b) => b.n - a.n)
      .slice(0, count)
      .map(({ p, n }) => ({ name: p.name, rating: p.rating, url: problemUrl(p), tags: p.tags || [], solvedBy: n, key: problemKey(p) }));
  }

  /* ------------------------- contests e grupos ------------------------- */

  /** Números dos contests com rating (user.rating). */
  function contestStats(hist) {
    const h = Array.isArray(hist) ? hist : [];
    if (!h.length) return { count: 0 };
    const deltas = h.map((r) => ({ d: r.newRating - r.oldRating, name: r.contestName, rank: r.rank, id: r.contestId }));
    const best = deltas.reduce((a, b) => (b.d > a.d ? b : a));
    const worst = deltas.reduce((a, b) => (b.d < a.d ? b : a));
    const bestRank = deltas.reduce((a, b) => (b.rank < a.rank ? b : a));
    const last = h[h.length - 1];
    const last5 = h.slice(-5);
    return {
      count: h.length,
      current: last.newRating,
      max: Math.max(...h.map((r) => r.newRating)),
      best,
      worst,
      bestRank,
      avgDelta: Math.round(deltas.reduce((a, b) => a + b.d, 0) / deltas.length),
      last5: last5.length ? last.newRating - last5[0].oldRating : 0,
      positive: deltas.filter((x) => x.d > 0).length,
    };
  }

  /** Força por tag em lista ordenável: taxa = resolvidos / tentados. */
  function tagStrength(tagStats, { min = 3 } = {}) {
    return Object.entries(tagStats || {})
      .map(([tag, x]) => ({ tag, solved: x.solved, unsolved: x.unsolved, total: x.solved + x.unsolved, rate: x.solved / Math.max(1, x.solved + x.unsolved) }))
      .filter((x) => x.total >= min);
  }

  /** Resumo de um grupo (amigos / instituição) a partir das linhas carregadas. */
  function groupSummary(rows) {
    const done = (rows || []).filter((r) => r && r.sum);
    if (!done.length) return { n: 0 };
    const total30 = done.reduce((a, r) => a + (r.sum.solved30 || 0), 0);
    const levels = done.map((r) => r.sum.avgRecent).filter(Boolean);
    const top = (f) => done.reduce((a, r) => (f(r) > f(a) ? r : a));
    const most = top((r) => r.sum.solved30 || 0);
    const lvl = top((r) => r.sum.avgRecent || 0);
    const streak = top((r) => r.sum.streak || 0);
    return {
      n: done.length,
      active7: done.filter((r) => r.sum.solved7 > 0).length,
      total30,
      avg30: total30 / done.length,
      perDayPerPerson: total30 / done.length / 30,
      avgLevel: levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : null,
      mostActive: { handle: most.handle, n: most.sum.solved30 || 0 },
      highestLevel: { handle: lvl.handle, n: lvl.sum.avgRecent || null },
      longestStreak: { handle: streak.handle, n: streak.sum.streak || 0 },
    };
  }

  /* ------------------------------ exportação ------------------------------ */

  /** CSV (RFC 4180, separador vírgula, BOM para o Excel abrir acentos). */
  function toCSV(header, rows) {
    const cell = (v) => {
      if (v == null) return '';
      const t = String(v);
      // evita injeção de fórmula ao abrir no Excel/Sheets
      const safe = /^[=+\-@\t\r]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t) ? `'${t}` : t;
      return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    return '\ufeff' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  const isoDate = (ts) => (ts ? dayKey(ts) : '');

  /** Problemas resolvidos de uma pessoa, uma linha por problema. */
  function solvedCSV(sum, base = 'https://codeforces.com') {
    const rows = sum.solvedList
      .slice()
      .sort((a, b) => a.ts - b.ts)
      .map((p) => [isoDate(p.ts), p.key, p.name, p.rating ?? '', p.tries, p.tags.join('; '), p.url ? base + p.url : '']);
    return toCSV(['date', 'problem', 'name', 'rating', 'submissions_until_ac', 'tags', 'url'], rows);
  }

  /** Tabela de um grupo (amigos / instituição). */
  function groupCSV(rows) {
    const out = (rows || []).map((r) => {
      const m = r.sum || {};
      const t = (m.tryingNow || [])[0];
      return [r.handle, r.rating ?? '', m.solved ?? '', m.solved7 ?? '', m.solved30 ?? '', m.solved90 ?? '', m.solved365 ?? '',
        m.perDay30 != null ? m.perDay30.toFixed(2) : '', m.avgRecent ?? '', m.max30 ?? '', m.maxRating ?? '', m.streak ?? '', m.longestStreak ?? '',
        m.firstTryRate != null ? (m.firstTryRate * 100).toFixed(1) : '', m.acRate != null ? (m.acRate * 100).toFixed(1) : '',
        t ? t.name : '', isoDate(m.lastTs)];
    });
    return toCSV(['handle', 'rating', 'solved', 'solved_7d', 'solved_30d', 'solved_90d', 'solved_365d', 'per_day_30d', 'level', 'hardest_30d',
      'hardest_ever', 'streak', 'best_streak', 'first_try_pct', 'acceptance_pct', 'trying_now', 'last_submission'], out);
  }

  /* ---------------------- quem resolveu (página do problema) ---------------------- */

  /** Índice compacto: chave do problema → ts do 1º AC (positivo) ou da última tentativa (negativo). */
  function solvedIndex(sum) {
    const idx = {};
    for (const t of sum.trying) idx[t.key] = -t.ts;
    for (const p of sum.solvedList) idx[p.key] = p.ts;
    return idx;
  }

  /** "/contest/1950/problem/A", "/problemset/problem/1950/A", "/gym/105020/problem/B" → "1950A". */
  function problemKeyFromPath(path) {
    const m = /^\/(?:contest|gym)\/(\d+)\/problem\/(\w+)/.exec(path) ||
      /^\/problemset\/problem\/(\d+)\/(\w+)/.exec(path) ||
      /^\/group\/[^/]+\/contest\/(\d+)\/problem\/(\w+)/.exec(path);
    return m ? `${m[1]}${m[2].toUpperCase()}` : null;
  }

  return {
    DAY,
    RANKS,
    rankOf,
    rankColor,
    dayKey,
    cfDateToKey,
    addDays,
    problemKey,
    problemUrl,
    langFamily,
    summarize,
    streaks,
    compact,
    HEAT_MODES,
    heatThresholds,
    dayValue,
    heatColor,
    heatLegend,
    suggest,
    contestStats,
    tagStrength,
    groupSummary,
    toCSV,
    solvedCSV,
    groupCSV,
    solvedIndex,
    problemKeyFromPath,
  };
});
