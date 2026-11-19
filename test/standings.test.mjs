// College standings: parser da organização, tabela montada a partir da API e
// filtro/busca na página (gym), num DOM simulado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

const STANDINGS = `<!doctype html><html><body>
<div id="header"><a href="/profile/me">me</a></div>
<div class="datatable"><table class="standings">
<tr><th>#</th><th>Who</th><th>=</th></tr>
<tr participantid="1"><td>1</td><td class="contestant-cell"><a href="/profile/Alice" class="rated-user user-red">Alice</a></td><td>3</td></tr>
<tr participantid="2"><td>2</td><td class="contestant-cell">Team X: <a href="/profile/bob">bob</a>, <a href="/profile/Carol">Carol</a></td><td>2</td></tr>
<tr participantid="3"><td>3</td><td class="contestant-cell"><a href="/profile/dave">dave</a></td><td>1</td></tr>
<tr class="standingsStatisticsRow"><td>stats</td></tr>
</table></div></body></html>`;

async function setup(url, { store = {}, fetchImpl } = {}) {
  const dom = new JSDOM(STANDINGS, { url, runScripts: 'outside-only' });
  const w = dom.window;
  const mem = { ...store };
  w.chrome = {
    storage: { local: { get: async (k) => ({ [k]: mem[k] }), set: async (o) => Object.assign(mem, o) } },
  };
  w.fetch = fetchImpl || (async () => { throw new Error('sem rede no teste'); });
  for (const f of ['shared/i18n.js', 'content/mark.js', 'content/standings.js']) w.eval(read(f));
  const T = w.CFM_I18N.make('pt');
  if (w.document.readyState === 'loading') await new Promise((r) => w.document.addEventListener('DOMContentLoaded', r));
  return { w, doc: w.document, S: w.CFM_STANDINGS, T, mem };
}

const ORG = {
  id: '7',
  name: 'UFCG',
  members: { alice: { h: 'Alice', cls: 'user-red' }, carol: { h: 'Carol', cls: 'user-blue' } },
  ts: Date.now(),
};

test('parseOrgId aceita ID, link e link com barra', async () => {
  const { S } = await setup('https://codeforces.com/gym/1/standings');
  assert.equal(S.parseOrgId('58605'), '58605');
  assert.equal(S.parseOrgId('https://codeforces.com/ratings/organization/297'), '297');
  assert.equal(S.parseOrgId(' https://codeforces.com/ratings/organization/297/ '), '297');
  assert.equal(S.parseOrgId('ufcg'), '');
  assert.equal(S.parseOrgId(''), '');
});

test('PATH reconhece contest, gym e grupo', async () => {
  const { S } = await setup('https://codeforces.com/gym/1/standings');
  for (const p of ['/contest/1950/standings', '/gym/105020/standings/page/2', '/group/abc/contest/123/standings'])
    assert.ok(S.PATH.test(p), p);
  assert.ok(!S.PATH.test('/contest/1950/problem/A'));
});

test('buildApiTable: só membros, posição na instituição com empates e posição geral', async () => {
  const { S, T, w } = await setup('https://codeforces.com/contest/9/standings');
  S.update({}, T);
  const party = (members, extra = {}) => ({ members: members.map((handle) => ({ handle })), participantType: 'CONTESTANT', ...extra });
  const result = {
    contest: { type: 'ICPC' },
    problems: [{ index: 'A' }, { index: 'B' }],
    rows: [
      { rank: 1, points: 2, penalty: 30, party: party(['zed']), problemResults: [{ points: 1 }, { points: 1 }] },
      { rank: 2, points: 2, penalty: 40, party: party(['Alice']), problemResults: [{ points: 1, rejectedAttemptCount: 2, bestSubmissionTimeSeconds: 3720 }, { points: 1 }] },
      { rank: 3, points: 2, penalty: 40, party: party(['bob', 'carol'], { teamName: 'Rocket' }), problemResults: [{ points: 1 }, { points: 1 }] },
      { rank: 4, points: 0, penalty: 0, party: party(['CAROL'], { participantType: 'OUT_OF_COMPETITION' }), problemResults: [{ points: 0, rejectedAttemptCount: 3 }, {}] },
    ],
  };
  const { el, count } = S.buildApiTable(result, ORG);
  assert.equal(count, 3, 'zed não é da organização');
  const rows = [...el.querySelectorAll('tr[participantid]')];
  const cell = (r, i) => rows[r].children[i].textContent;
  assert.deepEqual(rows.map((_, i) => cell(i, 0)), ['1', '1', '3'], 'empate divide a posição');
  assert.deepEqual(rows.map((_, i) => cell(i, 1)), ['2', '3', '4'], 'posição geral preservada');
  assert.equal(cell(1, 2), 'Rocket: bob, carol');
  assert.ok(rows[0].querySelector('a.rated-user.user-red'), 'cor do rating vem da lista da organização');
  assert.equal(cell(0, 5), '+201:02', '+2 com o horário do AC');
  assert.equal(cell(2, 5), '-3');
  assert.ok(rows[2].querySelector('sup'), 'fora de competição marcado');
  assert.ok(el instanceof w.HTMLElement);
});

test('gym: filtra a página aberta pela organização e a busca funciona por cima', async () => {
  const { S, T, doc } = await setup('https://codeforces.com/gym/5/standings', { store: { 'st:org:7': ORG } });
  S.update({ orgId: '7' }, T);
  const bar = doc.querySelector('.cfm-st-bar');
  assert.ok(bar, 'barra montada acima da tabela');
  assert.ok(bar.querySelector('svg.cfm-mark'), 'com a marca da extensão');
  bar.querySelector('[data-v="org"]').click();
  await new Promise((r) => setTimeout(r, 20));
  const shown = () => [...doc.querySelectorAll('table.standings tr[participantid]')]
    .filter((tr) => !tr.hasAttribute('data-cfm-st-out') && !tr.hasAttribute('data-cfm-st-miss'))
    .map((tr) => tr.getAttribute('participantid'));
  assert.deepEqual(shown(), ['1', '2'], 'Alice e a equipe com a Carol');
  assert.match(bar.querySelector('.cfm-status').textContent, /2 de UFCG/);

  const search = bar.querySelector('.cfm-st-search');
  search.value = 'team';
  search.dispatchEvent(new doc.defaultView.Event('input'));
  assert.deepEqual(shown(), ['2']);

  bar.querySelector('[data-v="all"]').click();
  search.value = '';
  search.dispatchEvent(new doc.defaultView.Event('input'));
  assert.deepEqual(shown(), ['1', '2', '3'], 'voltar para "Todos" desfaz o filtro');
});

test('sem organização: avisa e volta para "Todos"', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    text: async () => '<html><head><title>me - Codeforces</title></head><body>sem organização</body></html>',
  });
  const { S, T, doc } = await setup('https://codeforces.com/gym/5/standings', { fetchImpl });
  S.update({ orgId: '' }, T);
  const bar = doc.querySelector('.cfm-st-bar');
  bar.querySelector('[data-v="org"]').click();
  await new Promise((r) => setTimeout(r, 30));
  assert.match(bar.querySelector('.cfm-status').textContent, /Nenhuma organização/);
  assert.ok(bar.querySelector('[data-v="all"]').classList.contains('on'));
});
