// Métricas (shared/stats.js): resumo dos envios, sequências, heatmap e sugestões.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const S = createRequire(import.meta.url)('../shared/stats.js');

// datas locais fixas (o resumo usa o fuso do navegador, como o calendário do Codeforces)
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime() / 1000;
const NOW = at(2026, 11, 21, 18);

let id = 0;
const sub = (ts, contestId, index, verdict, extra = {}) => ({
  id: ++id,
  creationTimeSeconds: ts,
  problem: { contestId, index, name: `P${contestId}${index}`, rating: extra.rating, tags: extra.tags || [] },
  verdict,
  programmingLanguage: extra.lang || 'GNU G++23 14.2 (64 bit, msys2)',
});

const SUBS = [
  sub(at(2026, 11, 21), 100, 'A', 'OK', { rating: 800, tags: ['math'] }),
  sub(at(2026, 11, 21, 13), 100, 'A', 'OK', { rating: 800, tags: ['math'] }), // AC repetido não conta
  sub(at(2026, 11, 20), 100, 'B', 'WRONG_ANSWER', { rating: 1200 }),
  sub(at(2026, 11, 20, 14), 100, 'B', 'OK', { rating: 1200, tags: ['greedy', 'math'] }),
  sub(at(2026, 11, 19), 101, 'C', 'OK', { rating: 1600, tags: ['dp'], lang: 'Python 3' }),
  sub(at(2026, 11, 17), 102, 'D', 'TIME_LIMIT_EXCEEDED', { rating: 1900 }), // tentando
  sub(at(2026, 11, 17, 15), 102, 'D', 'WRONG_ANSWER', { rating: 1900 }),
  sub(at(2026, 9, 1), 103, 'A', 'OK', { tags: [] }), // sem rating
  sub(at(2026, 6, 1), 104, 'E', 'WRONG_ANSWER', { rating: 2000 }), // tentativa antiga
].reverse(); // a API devolve do mais recente para o mais antigo

test('summarize: resolvidos únicos, taxa de AC, médias e máximos', () => {
  const s = S.summarize(SUBS, NOW);
  assert.equal(s.total, 9);
  assert.equal(s.solved, 4, '100A, 100B, 101C, 103A');
  assert.equal(s.acSubs, 5);
  assert.equal(s.solved30, 3);
  assert.equal(s.solved7, 3);
  assert.equal(s.avg30, Math.round((800 + 1200 + 1600) / 3));
  assert.equal(s.maxRating, 1600);
  assert.deepEqual(s.byRating, { 800: 1, 1200: 1, 1600: 1 });
  assert.equal(s.byTag.math, 2);
  assert.equal(s.verdicts.WRONG_ANSWER, 3);
  assert.equal(s.langs['C++'], 8);
  assert.equal(s.langs.Python, 1);
});

test('summarize: dias, sequências e "tentando agora"', () => {
  const s = S.summarize(SUBS, NOW);
  const d21 = s.byDay['2026-11-21'];
  assert.equal(d21.subs, 2);
  assert.equal(d21.solved, 1, 'só o primeiro AC conta como resolvido');
  assert.deepEqual(s.byDay['2026-11-20'].ratings, [1200]);
  assert.equal(s.streak, 3, '19, 20 e 21 de novembro');
  assert.equal(s.longestStreak, 3);
  assert.deepEqual(s.tryingNow.map((t) => t.key), ['102D'], 'a tentativa de junho é antiga demais');
  assert.equal(s.tryingNow[0].tries, 2);
  assert.equal(s.trying.length, 2);
  assert.equal(s.perMonth['2026-11'], 3);
  assert.equal(Object.keys(s.perMonth).length, 12);
});

test('streak: sequência que parou ontem ainda vale; anteontem zera', () => {
  const day = (k) => ({ [k]: { solved: 1 } });
  assert.equal(S.streaks({ ...day('2026-11-20'), ...day('2026-11-19') }, NOW).streak, 2);
  assert.equal(S.streaks(day('2026-11-19'), NOW).streak, 0);
  assert.equal(S.streaks({}, NOW).longestStreak, 0);
});

test('datas: data-date do Codeforces e virada de mês', () => {
  assert.equal(S.cfDateToKey('11/23/2025'), '2025-11-23');
  assert.equal(S.cfDateToKey('1/5/2026'), '2026-01-05');
  assert.equal(S.cfDateToKey('ontem'), null);
  assert.equal(S.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(S.addDays('2026-12-31', 1), '2027-01-01');
});

test('rank e cor por rating', () => {
  assert.equal(S.rankOf(1199).key, 'newbie');
  assert.equal(S.rankOf(1200).key, 'pupil');
  assert.equal(S.rankOf(2400).key, 'gm');
  assert.equal(S.rankOf(null), null);
  assert.equal(S.rankColor(1650, false), '#0000ff');
  assert.notEqual(S.rankColor(1650, true), '#0000ff', 'no escuro usa a versão legível');
});

test('heatmap: cores por modo e legenda', () => {
  const s = S.summarize(SUBS, NOW);
  assert.equal(S.heatColor(s.byDay['2026-11-21'], 'cf', true), null, "'cf' mantém a cor original");
  const empty = S.heatColor(undefined, 'solved', true);
  assert.equal(S.heatColor(s.byDay['2026-11-21'], 'solved', true) !== empty, true);
  assert.equal(S.heatColor(s.byDay['2026-11-19'], 'max', false), S.rankColor(1600, false));
  assert.equal(S.dayValue(s.byDay['2026-09-01'], 'max'), -1, 'resolveu, mas sem rating');
  assert.equal(S.heatLegend('solved', true).length, 5);
  assert.deepEqual(S.heatThresholds({ a: { solved: 2, subs: 9, ratings: [] } }, 'solved'), [1, 2, 3, 4], 'máximo pequeno usa a rampa toda');
  assert.deepEqual(S.heatThresholds({ a: { solved: 12, subs: 1, ratings: [] } }, 'solved'), [1, 3, 6, 9]);
  assert.deepEqual(S.heatThresholds({ '2020-01-01': { solved: 50, ratings: [] }, '2026-01-01': { solved: 4, ratings: [] } }, 'solved', '2025-01-01'), [1, 2, 3, 4], 'só o período visível conta');
  const thr = S.heatThresholds(s.byDay, 'solved');
  const lvls = new Set([0, 1, 2, 3, 4].map((n) => S.heatColor({ solved: n, subs: n, ratings: [] }, 'solved', true, [1, 2, 3, 4])));
  assert.equal(lvls.size, 5, 'cada contagem 0..4 cai num tom diferente');
  assert.ok(thr.every((x, i) => i === 0 || x > thr[i - 1]));
  assert.deepEqual(S.heatLegend('solved', false, [1, 3, 6, 9]).map((x) => x.label), ['0', '1–2', '3–5', '6–8', '9+']);
  assert.equal(S.heatLegend('max', true).length, S.RANKS.length);
  assert.deepEqual(S.heatLegend('cf', true), []);
});

test('suggest: perto do nível, sem repetir resolvidos/tentados, mais populares primeiro', () => {
  const s = S.summarize(SUBS, NOW);
  const problems = [
    { contestId: 200, index: 'A', name: 'fácil', rating: 800, tags: [] },
    { contestId: 200, index: 'B', name: 'no nível', rating: 1200, tags: ['dp'] },
    { contestId: 200, index: 'C', name: 'no nível 2', rating: 1300, tags: ['math'] },
    { contestId: 102, index: 'D', name: 'tentado', rating: 1300, tags: [] },
    { contestId: 100, index: 'B', name: 'resolvido', rating: 1200, tags: [] },
    { contestId: 200, index: 'D', name: 'difícil', rating: 2500, tags: [] },
  ];
  const stats = [
    { contestId: 200, index: 'B', solvedCount: 10 },
    { contestId: 200, index: 'C', solvedCount: 50 },
  ];
  const out = S.suggest(problems, stats, s, { count: 5 });
  assert.deepEqual(out.map((p) => p.name), ['no nível 2', 'no nível']);
  assert.deepEqual(S.suggest(problems, stats, s, { tag: 'dp' }).map((p) => p.name), ['no nível']);
  assert.equal(out[0].url, '/problemset/problem/200/C');
});

test('compact: cabe em cache (sem listas grandes)', () => {
  const c = S.compact(S.summarize(SUBS, NOW));
  assert.equal(c.solved, 4);
  assert.ok(!('solvedList' in c) && !('byDay' in c));
  assert.ok(JSON.stringify(c).length < 1000);
});

test('problemUrl: gym e problemset', () => {
  assert.equal(S.problemUrl({ contestId: 104059, index: 'A' }), '/gym/104059/problem/A');
  assert.equal(S.problemUrl({ contestId: 1950, index: 'B' }), '/problemset/problem/1950/B');
  assert.equal(S.problemUrl({ index: 'A' }), null);
});
