import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const TEX = require('../shared/tex-protect.js');

const parts = [
  { t: 'text', v: 'Given an array ' },
  { t: 'atom', id: 0 },
  { t: 'text', v: ' of ' },
  { t: 'open', id: 1 },
  { t: 'text', v: 'length ' },
  { t: 'atom', id: 2 },
  { t: 'close', id: 1 },
  { t: 'text', v: ' & more <ok>.' },
];

test('splitTex separa $$$ inline e $$$$$$ em bloco', () => {
  const r = TEX.splitTex('a $$$x_i < y$$$ b $$$$$$\\sum_{i=1}^n a_i$$$$$$ c');
  assert.deepEqual(
    r.map((x) => x.t),
    ['text', 'tex', 'text', 'tex', 'text']
  );
  assert.equal(r[1].v, '$$$x_i < y$$$');
  assert.equal(r[3].v, '$$$$$$\\sum_{i=1}^n a_i$$$$$$');
});

for (const mode of ['tok', 'xml']) {
  test(`encode → decode é identidade (${mode})`, () => {
    const enc = TEX.encode(parts, mode);
    assert.deepEqual(TEX.decode(enc, parts, mode), parts);
  });
}

test('modo xml escapa & < > no texto', () => {
  const enc = TEX.encode(parts, 'xml');
  assert.ok(enc.includes('&amp; more &lt;ok&gt;.'));
});

test('tok: tolera espaços dentro dos marcadores', () => {
  const enc = TEX.encode(parts, 'tok').replace(/⟦/g, '⟦ ').replace(/⟧/g, ' ⟧');
  assert.deepEqual(TEX.decode(enc, parts, 'tok'), parts);
});

test('decode rejeita marcador ausente, duplicado, desconhecido ou mal aninhado', () => {
  const enc = TEX.encode(parts, 'tok');
  assert.equal(TEX.decode(enc.replace('⟦0⟧', ''), parts, 'tok'), null, 'ausente');
  assert.equal(TEX.decode(enc + '⟦0⟧', parts, 'tok'), null, 'duplicado');
  assert.equal(TEX.decode(enc + '⟦9⟧', parts, 'tok'), null, 'desconhecido');
  assert.equal(TEX.decode(enc.replace('⟦/1⟧', ''), parts, 'tok'), null, 'fecha faltando');
  assert.equal(
    TEX.decode('⟦0⟧ ⟦/1⟧ ⟦1⟧ ⟦2⟧', parts, 'tok'),
    null,
    'fecha antes de abrir'
  );
});

test('decode xml rejeita tag a menos / a mais', () => {
  const enc = TEX.encode(parts, 'xml');
  assert.equal(TEX.decode(enc.replace('</g>', ''), parts, 'xml'), null);
  assert.equal(TEX.decode(enc + '</g>', parts, 'xml'), null);
  assert.equal(TEX.decode(enc.replace('<x i="0"/>', ''), parts, 'xml'), null);
});

test('hasLetters ignora trechos só com fórmula/números', () => {
  assert.equal(TEX.hasLetters([{ t: 'atom', id: 0 }, { t: 'text', v: ' 12, ' }]), false);
  assert.equal(TEX.hasLetters([{ t: 'atom', id: 0 }, { t: 'text', v: ' and the' }]), true);
});

test('chunk respeita o limite e nunca corta um marcador', () => {
  const sentence = 'Alice has ⟦0⟧ apples and ⟦1⟧bob⟦/1⟧ has none. ';
  const text = sentence.repeat(60).trim();
  const chunks = TEX.chunk(text, 300);
  assert.ok(chunks.length > 1);
  for (const c of chunks) {
    assert.ok(c.length <= 300, `tamanho ${c.length}`);
    // nenhum marcador cortado ao meio
    assert.equal((c.match(/⟦/g) || []).length, (c.match(/⟧/g) || []).length);
  }
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), text.replace(/\s+/g, ' '));
});

test('chunk divide frase gigante sem espaços', () => {
  const chunks = TEX.chunk('x'.repeat(1000), 300);
  assert.ok(chunks.every((c) => c.length <= 300));
  assert.equal(chunks.join(''), 'x'.repeat(1000));
});
