// Testa o content script inteiro dentro de um DOM simulado (jsdom), com um
// "tradutor" falso que se comporta bem, mal, ou quebra os marcadores.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
const SRC = [read('shared/defaults.js'), read('shared/i18n.js'), read('shared/tex-protect.js'), read('content/content.js')];

const math = (n, tex) =>
  `<span class="MathJax_Preview"></span><span class="MathJax" id="MathJax-Element-${n}-Frame"><span class="mjx-chtml">${tex}</span></span>` +
  `<script type="math/tex" id="MathJax-Element-${n}">${tex}</script>`;

const PAGE = `<!doctype html><html><body><div class="ttypography"><div class="problem-statement">
<div class="header"><div class="title">A. Test Problem</div>
<div class="time-limit"><div class="property-title">time limit per test</div>2 seconds</div>
<div class="memory-limit"><div class="property-title">memory limit per test</div>256 megabytes</div>
<div class="input-file"><div class="property-title">input</div>standard input</div>
<div class="output-file"><div class="property-title">output</div>standard output</div></div>
<div><p>You are given an array ${math(1, 'a')} of <b>length ${math(2, 'n')}</b>. Find the maximum element, see <a href="/x">this link</a>.</p>
<ul><li>First item with <i>emphasis</i> and ${math(3, 'x_i')} inside.<ul><li>Nested item here.</li></ul></li></ul></div>
<div class="input-specification"><div class="section-title">Input</div><p>The first line contains one integer ${math(4, 'n')}.</p></div>
<div class="output-specification"><div class="section-title">Output</div><p>Print the answer.</p><p>${math(5, '1')}</p></div>
<div class="sample-tests"><div class="section-title">Example</div><div class="sample-test">
<div class="input"><div class="title">Input</div><pre>3\n1 2 3</pre></div>
<div class="output"><div class="title">Output</div><pre>3</pre></div></div></div>
</div></div></body></html>`;

/**
 * mode:
 *  - 'good':   devolve em MAIÚSCULAS, com espaços dentro dos marcadores
 *  - 'drop':   perde um marcador (força o plano B)
 *  - 'fail':   erro de rede
 *  - 'fatal':  erro de configuração
 */
function setup({ mode = 'good', html = PAGE, settings = {} } = {}) {
  const dom = new JSDOM(html, { url: 'https://codeforces.com/contest/1/problem/A', runScripts: 'outside-only' });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  const calls = [];
  w.chrome = {
    storage: {
      local: {
        get: async (d) => ({ ...d, mathWaitMs: 300, uiLang: 'pt', ...settings }),
        set: async (p) => {
          Object.assign(settings, p);
          for (const l of listeners) l(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { newValue: v }])), 'local');
        },
      },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
    runtime: {
      onMessage: { addListener() {} },
      sendMessage: async (msg) => {
        calls.push(msg);
        if (mode === 'fail') return { ok: false, error: 'rede' };
        if (mode === 'fatal') return { ok: false, error: 'chave inválida', fatal: true };
        let out = msg.text;
        if (msg.tags === 'none' && /⟦/.test(out)) {
          // modo tok
          out = out.replace(/⟦\s*(\/?)\s*(\d+)\s*⟧/g, (m, s, n) => (mode === 'good' ? `⟦ ${s}${n} ⟧` : m));
          if (mode === 'drop') out = out.replace('⟦0⟧', '');
        }
        // maiúsculas só no texto (fora de marcadores)
        out = out
          .split(/(⟦[^⟧]*⟧|<[^>]+>)/)
          .map((p, i) => (i % 2 ? p : p.toUpperCase()))
          .join('');
        return { ok: true, text: out };
      },
    },
  };
  const listeners = [];
  for (const code of SRC) w.eval(code);
  return { w, calls, doc: w.document };
}

const until = async (fn, ms = 4000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('timeout esperando condição');
};
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const click = (w) => w.document.querySelector('.cfm-btn').click();
const label = (w) => w.document.querySelector('.cfm-btn span').textContent;

test('monta a barra de tradução no problema', async () => {
  const { doc } = setup();
  await until(() => doc.querySelector('.cfm-toolbar'));
  assert.ok(doc.querySelector('.cfm-lang'));
  assert.equal(doc.documentElement.getAttribute('data-cfm'), 'on');
});

test('traduz o texto e mantém EXATAMENTE os mesmos nós de fórmula', async () => {
  const { w, doc } = setup();
  await until(() => doc.querySelector('.cfm-toolbar'));
  const mathBefore = Array.from(doc.querySelectorAll('.MathJax, script[type="math/tex"], .MathJax_Preview'));
  assert.equal(mathBefore.length, 15);
  const originalHtml = norm(doc.querySelector('.problem-statement').innerHTML);

  click(w);
  await until(() => label(w) === 'Ver original');

  const st = doc.querySelector('.problem-statement');
  assert.match(st.textContent, /YOU ARE GIVEN AN ARRAY/);
  assert.match(st.textContent, /PRINT THE ANSWER/);
  assert.match(st.textContent, /NESTED ITEM HERE/); // <li> dentro de <li>

  const mathAfter = Array.from(doc.querySelectorAll('.MathJax, script[type="math/tex"], .MathJax_Preview'));
  assert.equal(mathAfter.length, mathBefore.length, 'nenhuma fórmula duplicada ou perdida');
  mathBefore.forEach((n, i) => assert.equal(mathAfter[i], n, 'mesmo nó, na mesma ordem'));

  // formatação inline acompanhou o texto
  assert.match(st.querySelector('b').textContent, /^LENGTH /);
  assert.ok(st.querySelector('b .MathJax'), 'fórmula continua dentro do <b>');
  assert.equal(st.querySelector('a').getAttribute('href'), '/x');
  assert.match(st.querySelector('a').textContent, /THIS LINK/i);

  // exemplos NÃO foram traduzidos
  assert.equal(st.querySelector('.sample-test pre').textContent, '3\n1 2 3');

  // volta ao original sem sobras
  click(w);
  await until(() => label(w) === 'Traduzir');
  assert.equal(norm(st.innerHTML.replace(/<!--cfm-->/g, '')), originalHtml);
  mathBefore.forEach((n) => assert.ok(st.contains(n)));
});

test('rótulos: dicionário pt (Entrada/Saída/limites)', async () => {
  const { w, doc } = setup();
  await until(() => doc.querySelector('.cfm-toolbar'));
  click(w);
  await until(() => label(w) === 'Ver original');
  const titles = Array.from(doc.querySelectorAll('.section-title')).map((e) => e.textContent);
  assert.deepEqual(titles, ['Entrada', 'Saída', 'Exemplo']);
  assert.match(doc.querySelector('.time-limit').textContent, /2 segundos/);
  assert.match(doc.querySelector('.input-file').textContent, /entrada padrão/);
  assert.match(doc.querySelector('.header .title').textContent, /^A\. TEST PROBLEM/); // prefixo "A." preservado
});

test('plano B: marcador perdido → traduz só as frases, fórmulas intactas', async () => {
  const { w, doc } = setup({ mode: 'drop' });
  await until(() => doc.querySelector('.cfm-toolbar'));
  const mathBefore = Array.from(doc.querySelectorAll('.MathJax'));
  click(w);
  await until(() => label(w) === 'Ver original');
  const st = doc.querySelector('.problem-statement');
  assert.match(st.textContent, /YOU ARE GIVEN AN ARRAY/);
  const mathAfter = Array.from(doc.querySelectorAll('.MathJax'));
  assert.deepEqual(mathAfter, mathBefore);
  assert.match(doc.querySelector('.cfm-status').textContent, /modo simples/);
});

test('erro de rede: nada muda e aparece a mensagem', async () => {
  const { w, doc } = setup({ mode: 'fail' });
  await until(() => doc.querySelector('.cfm-toolbar'));
  const before = doc.querySelector('.problem-statement').innerHTML;
  click(w);
  await until(() => !doc.querySelector('.cfm-btn').disabled && /Não foi possível/.test(doc.querySelector('.cfm-status').textContent));
  assert.equal(doc.querySelector('.problem-statement').innerHTML, before);
  assert.equal(label(w), 'Traduzir');
});

test('erro fatal (chave) interrompe cedo', async () => {
  const { w, calls, doc } = setup({ mode: 'fatal' });
  await until(() => doc.querySelector('.cfm-toolbar'));
  click(w);
  await until(() => /chave inválida/.test(doc.querySelector('.cfm-status').textContent));
  assert.ok(calls.length <= 4, `só ${calls.length} chamadas (não insistiu)`);
});

test('DeepL usa o formato xml e valida a volta', async () => {
  const { w, calls, doc } = setup({ settings: { engine: 'deepl' } });
  await until(() => doc.querySelector('.cfm-toolbar'));
  click(w);
  await until(() => label(w) === 'Ver original');
  const withTags = calls.filter((c) => c.tags === 'xml');
  assert.ok(withTags.length > 0);
  assert.ok(withTags.every((c) => /<x i="\d+"\/>|<g i="\d+">/.test(c.text) || !/⟦/.test(c.text)));
  assert.ok(withTags.some((c) => c.text.includes('<g i=')), 'pares <g> enviados para <b>/<i>/<a>');
  assert.match(doc.querySelector('.problem-statement').textContent, /YOU ARE GIVEN AN ARRAY/);
});

test('fórmula $$$…$$$ ainda não renderizada é preservada como texto', async () => {
  const page = `<html><body><div class="problem-statement"><div><p>Consider $$$a_i &lt; 10$$$ and the <b>sum</b> of all values.</p></div></div></body></html>`;
  const { w, doc } = setup({ html: page, settings: { mathWaitMs: 200 } });
  await until(() => doc.querySelector('.cfm-toolbar'));
  click(w);
  await until(() => label(w) === 'Ver original', 6000);
  const p = doc.querySelector('p');
  assert.match(p.textContent, /CONSIDER/);
  assert.ok(p.textContent.includes('$$$a_i < 10$$$'), p.textContent);
  click(w);
  await until(() => label(w) === 'Traduzir');
  assert.equal(norm(p.textContent), 'Consider $$$a_i < 10$$$ and the sum of all values.');
});

test('trocar o idioma pede nova tradução; mesmo idioma volta do cache local', async () => {
  const { w, calls, doc } = setup();
  await until(() => doc.querySelector('.cfm-toolbar'));
  click(w);
  await until(() => label(w) === 'Ver original');
  click(w); // original
  await until(() => label(w) === 'Traduzir');
  const n = calls.length;
  click(w); // de volta à tradução: instantâneo, sem novas chamadas
  await until(() => label(w) === 'Ver original');
  assert.equal(calls.length, n);

  await w.chrome.storage.local.set({ targetLang: 'es' });
  await until(() => label(w) === 'Traduzir de novo');
});

test('ignora páginas sem enunciado', async () => {
  const { doc } = setup({ html: '<html><body><p>Hello</p></body></html>' });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(doc.querySelector('.cfm-toolbar'), null);
});
