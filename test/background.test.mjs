// Testa o background (Google/DeepL/cache) com fetch e storage simulados.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const defaults = readFileSync(join(root, 'shared/defaults.js'), 'utf8');
const i18n = readFileSync(join(root, 'shared/i18n.js'), 'utf8');
const colorLib = readFileSync(join(root, 'shared/color.js'), 'utf8');
const code = readFileSync(join(root, 'background.js'), 'utf8');

function boot({ fetchImpl, store: extra = {}, canvas = null }) {
  const store = { uiLang: 'pt', ...extra };
  let listener;
  const fetchCalls = [];
  const ctx = {
    console,
    setTimeout: (fn) => setTimeout(fn, 1), // sem esperar o backoff de verdade
    crypto: globalThis.crypto,
    TextEncoder,
    URL,
    URLSearchParams,
    Error,
    Date,
    Promise,
    encodeURIComponent,
    JSON,
    ...(canvas || {}),
    fetch: async (url, opts) => {
      fetchCalls.push({ url, opts });
      return fetchImpl(url, opts, fetchCalls.length);
    },
    chrome: {
      runtime: {
        onMessage: { addListener: (fn) => (listener = fn) },
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
      },
      storage: {
        local: {
          get: async (k) => {
            if (k === null) return { ...store };
            if (typeof k === 'string') return k in store ? { [k]: store[k] } : {};
            return { ...k, ...Object.fromEntries(Object.keys(k).filter((x) => x in store).map((x) => [x, store[x]])) };
          },
          set: async (o) => Object.assign(store, o),
          remove: async (keys) => [].concat(keys).forEach((k) => delete store[k]),
        },
      },
    },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(defaults, ctx);
  vm.runInContext(i18n, ctx);
  vm.runInContext(colorLib, ctx);
  vm.runInContext(code, ctx);
  // A resposta nasce em outro "realm" do vm: normaliza para que deepStrictEqual compare só os dados.
  const send = (msg) =>
    new Promise((resolve) => listener(msg, {}, (res) => resolve(JSON.parse(JSON.stringify(res)))));
  return { send, fetchCalls, store };
}

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

test('Google: junta os segmentos devolvidos', async () => {
  const { send, fetchCalls } = boot({
    fetchImpl: () => json([[['Olá, ', 'Hello, '], ['⟦0⟧ mundo', '⟦0⟧ world']], null, 'en']),
  });
  const r = await send({ type: 'translate', engine: 'google', lang: 'pt', text: 'Hello, ⟦0⟧ world' });
  assert.deepEqual(r, { ok: true, text: 'Olá, ⟦0⟧ mundo' });
  assert.match(fetchCalls[0].url, /tl=pt/);
  assert.match(fetchCalls[0].url, /q=Hello%2C%20%E2%9F%A60%E2%9F%A7%20world/);
});

test('cache: a segunda chamada igual não vai à rede', async () => {
  const { send, fetchCalls } = boot({ fetchImpl: () => json([[['Oi', 'Hi']]]) });
  const msg = { type: 'translate', engine: 'google', lang: 'pt', text: 'Hi' };
  await send(msg);
  await new Promise((r) => setTimeout(r, 10)); // deixa o set() terminar
  const r2 = await send(msg);
  assert.equal(r2.text, 'Oi');
  assert.equal(r2.cached, true);
  assert.equal(fetchCalls.length, 1);
});

test('Google: tenta de novo em 429 e depois funciona', async () => {
  const { send, fetchCalls } = boot({
    fetchImpl: (u, o, n) => (n < 3 ? json({}, 429) : json([[['Ok', 'ok']]])),
  });
  const r = await send({ type: 'translate', engine: 'google', lang: 'pt', text: 'ok' });
  assert.equal(r.ok, true);
  assert.equal(fetchCalls.length, 3);
});

test('Google: desiste depois de 3 tentativas com mensagem clara', async () => {
  const { send } = boot({ fetchImpl: () => json({}, 429) });
  const r = await send({ type: 'translate', engine: 'google', lang: 'pt', text: 'ok' });
  assert.equal(r.ok, false);
  assert.match(r.error, /429/);
});

test('DeepL sem chave → erro fatal e nenhuma requisição', async () => {
  const { send, fetchCalls } = boot({ fetchImpl: () => json({}) });
  const r = await send({ type: 'translate', engine: 'deepl', lang: 'pt', text: 'Hi', tags: 'xml' });
  assert.equal(r.ok, false);
  assert.equal(r.fatal, true);
  assert.equal(fetchCalls.length, 0);
});

test('DeepL: host free/pro, cabeçalho, tag_handling e idioma', async () => {
  const { send, fetchCalls } = boot({
    store: { deeplKey: 'abc:fx' },
    fetchImpl: () => json({ translations: [{ text: 'Olá <x i="0"/>' }] }),
  });
  const r = await send({ type: 'translate', engine: 'deepl', lang: 'pt', text: 'Hi <x i="0"/>', tags: 'xml' });
  assert.deepEqual(r, { ok: true, text: 'Olá <x i="0"/>' });
  const { url, opts } = fetchCalls[0];
  assert.equal(url, 'https://api-free.deepl.com/v2/translate');
  assert.equal(opts.headers.Authorization, 'DeepL-Auth-Key abc:fx');
  const body = JSON.parse(opts.body);
  assert.equal(body.target_lang, 'PT-BR');
  assert.equal(body.tag_handling, 'xml');
  assert.deepEqual(body.ignore_tags, ['x']);

  const pro = boot({ store: { deeplKey: 'abc' }, fetchImpl: () => json({ translations: [{ text: 'x' }] }) });
  await pro.send({ type: 'translate', engine: 'deepl', lang: 'es', text: 'Hi', tags: 'none' });
  assert.equal(pro.fetchCalls[0].url, 'https://api.deepl.com/v2/translate');
  assert.equal(JSON.parse(pro.fetchCalls[0].opts.body).tag_handling, undefined);
});

test('DeepL: 403 e 456 são fatais; idioma sem suporte também', async () => {
  for (const [status, re] of [[403, /inválida/], [456, /Cota/]]) {
    const { send } = boot({ store: { deeplKey: 'k' }, fetchImpl: () => json({}, status) });
    const r = await send({ type: 'translate', engine: 'deepl', lang: 'pt', text: 'Hi' });
    assert.equal(r.fatal, true);
    assert.match(r.error, re);
  }
  const { send } = boot({ store: { deeplKey: 'k' }, fetchImpl: () => json({}) });
  const r = await send({ type: 'translate', engine: 'deepl', lang: 'vi', text: 'Hi' });
  assert.equal(r.fatal, true);
  assert.match(r.error, /não suporta/);
});

test('interface em inglês: mensagens de erro saem em inglês', async () => {
  const { send } = boot({ store: { uiLang: 'en', deeplKey: 'k' }, fetchImpl: () => json({}, 403) });
  const r = await send({ type: 'translate', engine: 'deepl', lang: 'pt', text: 'Hi' });
  assert.equal(r.fatal, true);
  assert.match(r.error, /Invalid DeepL key/);
});

// ---- análise de ícones ----
const fakeCanvas = (rgba) => ({
  createImageBitmap: async () => ({ width: 16, height: 16 }),
  OffscreenCanvas: class {
    constructor(w, h) { this.w = w; this.h = h; }
    getContext() {
      const { w, h } = this;
      return {
        drawImage() {},
        getImageData: () => ({ data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => rgba[i % 4]) }),
      };
    }
  },
});
const pngResponse = () => ({ ok: true, status: 200, blob: async () => ({ size: 120, type: 'image/png' }) });

test('ícone: fundo branco opaco de um domínio do Codeforces → light, e fica em cache', async () => {
  const { send, fetchCalls } = boot({ canvas: fakeCanvas([255, 255, 255, 255]), fetchImpl: () => pngResponse() });
  const url = 'https://codeforces.org/s/1/images/icons/x.png';
  assert.deepEqual(await send({ type: 'cfm-icon', url }), { mode: 'light' });
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(await send({ type: 'cfm-icon', url }), { mode: 'light' });
  assert.equal(fetchCalls.length, 1);
});

test('ícone: preto sobre fundo transparente → dark', async () => {
  const { send } = boot({
    canvas: (() => {
      const base = fakeCanvas([0, 0, 0, 255]);
      return base;
    })(),
    fetchImpl: () => pngResponse(),
  });
  // todos os pixels pretos e opacos: nas bordas luminância ~0 → não é "light"; é um desenho escuro
  assert.deepEqual(await send({ type: 'cfm-icon', url: 'https://codeforces.com/i.png' }), { mode: 'dark' });
});

test('ícone: só baixa https de domínios do Codeforces (não vira proxy)', async () => {
  const { send, fetchCalls } = boot({ canvas: fakeCanvas([255, 255, 255, 255]), fetchImpl: () => pngResponse() });
  for (const url of ['http://codeforces.com/a.png', 'https://evil.example/a.png', 'https://codeforces.com.evil.example/a.png', 'javascript:alert(1)', 'not a url']) {
    assert.deepEqual(await send({ type: 'cfm-icon', url }), { mode: 'none' }, url);
  }
  assert.equal(fetchCalls.length, 0);
});
