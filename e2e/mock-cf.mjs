// Codeforces "de mentira" para o teste ponta a ponta do heatmap e do analytics:
// respostas da API no mesmo formato da real (user.status, user.info, user.rating,
// problemset.problems) e as páginas /friends, /ratings/organization/<id> e /profile/<h>.
// Os dados são sintéticos e determinísticos (mesma semente → mesmos envios).
const DAY = 86400;
export const NOW = Math.floor(Date.now() / 1000);
export const OWNER = 'tester';
export const FRIENDS = ['alice', 'bob', 'carol'];
export const ORG = { id: '77', name: 'UFCG', members: ['tester', 'dave', 'erin', 'alice', 'ghost404'] }; // ghost404 não existe: testa o descarte
const RATINGS = { tester: 1350, alice: 1720, bob: 1180, carol: 1990, dave: 1460, erin: 2150 };

function rng(seed) {
  let x = 0;
  for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1e6) / 1e6;
  };
}

const TAGS = ['math', 'greedy', 'dp', 'implementation', 'brute force', 'constructive algorithms', 'graphs', 'strings', 'binary search', 'sortings'];
export const PROBLEMS = [];
for (let c = 0; c < 120; c++) {
  for (const idx of ['A', 'B', 'C']) {
    const rating = 800 + ((c * 7 + idx.charCodeAt(0) * 3) % 23) * 100;
    PROBLEMS.push({ contestId: 1900 + c, index: idx, name: `Problem ${1900 + c}${idx}`, type: 'PROGRAMMING', rating, tags: [TAGS[c % TAGS.length], TAGS[(c + 3) % TAGS.length]] });
  }
}
const STATS = PROBLEMS.map((p, i) => ({ contestId: p.contestId, index: p.index, solvedCount: 50000 - i * 97 }));

export function submissions(handle) {
  const r = rng(handle);
  const base = RATINGS[handle] || 1200;
  const subs = [];
  let id = 1;
  for (let d = 380; d >= 0; d--) {
    if (r() < 0.45) continue; // dias sem atividade
    const n = 1 + Math.floor(r() * 5);
    for (let k = 0; k < n; k++) {
      const p = PROBLEMS[Math.floor(r() * PROBLEMS.length)];
      if (p.rating > base + 400) continue;
      const ts = NOW - d * DAY - Math.floor(r() * 20000);
      const ok = r() < 0.55;
      subs.push({
        id: id++,
        contestId: p.contestId,
        creationTimeSeconds: ts,
        problem: { ...p },
        author: { members: [{ handle }], participantType: 'PRACTICE' },
        programmingLanguage: r() < 0.85 ? 'GNU G++23 14.2 (64 bit, msys2)' : 'Python 3',
        verdict: ok ? 'OK' : ['WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'RUNTIME_ERROR'][Math.floor(r() * 3)],
      });
    }
  }
  // uma tentativa recente sem AC, para "tentando agora"
  subs.push({ id: id++, contestId: 2019, creationTimeSeconds: NOW - 3600, problem: { contestId: 2019, index: 'C', name: 'Pending Problem', rating: base + 200, tags: ['dp'] }, programmingLanguage: 'GNU G++23 14.2 (64 bit, msys2)', verdict: 'WRONG_ANSWER' });
  return subs.sort((a, b) => b.creationTimeSeconds - a.creationTimeSeconds);
}

function ratingHistory(handle) {
  const target = RATINGS[handle] || 1200;
  const out = [];
  let r = 0;
  for (let i = 0; i < 10; i++) {
    const nr = Math.round(800 + ((target - 800) * (i + 1)) / 10);
    out.push({ contestId: 1900 + i, contestName: `Codeforces Round ${900 + i} (Div. 2)`, handle, rank: 1000 - i * 50, ratingUpdateTimeSeconds: NOW - (10 - i) * 30 * DAY, oldRating: r, newRating: nr });
    r = nr;
  }
  return out;
}

const json = (res, body) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
const html = (res, body) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
};

const userLink = (h) => `<a href="/profile/${h}" class="rated-user user-blue">${h}</a>`;

/** Responde se for uma rota do Codeforces falso; devolve false caso contrário. */
export function handle(pathname, searchParams, res, profileHtml) {
  if (pathname === '/api/user.status') return json(res, { status: 'OK', result: submissions(searchParams.get('handle')) }), true;
  if (pathname === '/api/user.rating') return json(res, { status: 'OK', result: ratingHistory(searchParams.get('handle')) }), true;
  if (pathname === '/api/problemset.problems') return json(res, { status: 'OK', result: { problems: PROBLEMS, problemStatistics: STATS } }), true;
  if (pathname === '/api/user.info') {
    const hs = (searchParams.get('handles') || '').split(';').filter(Boolean);
    const missing = hs.find((h) => !(h in RATINGS));
    if (missing) return json(res, { status: 'FAILED', comment: `handles: User with handle ${missing} not found` }), true;
    return json(res, {
      status: 'OK',
      result: hs.map((h, i) => ({ handle: h, rating: RATINGS[h], maxRating: RATINGS[h] + 60, rank: 'x', lastOnlineTimeSeconds: NOW - i * 3600, organization: ORG.members.includes(h) ? ORG.name : '' })),
    }), true;
  }
  if (pathname === '/friends') {
    return html(res, `<!doctype html><title>My friends - Codeforces</title><div class="datatable"><table>${FRIENDS.map((f) => `<tr><td>${userLink(f)}</td></tr>`).join('')}</table></div>`), true;
  }
  if (pathname === `/ratings/organization/${ORG.id}`) {
    return html(res, `<!doctype html><title>Rating - Codeforces</title><div class="datatable"><table>${ORG.members.map((m) => `<tr><td>${userLink(m)}</td></tr>`).join('')}</table></div>`), true;
  }
  if (/^\/profile\/[^/]+$/.test(pathname)) return html(res, profileHtml), true;
  return false;
}
