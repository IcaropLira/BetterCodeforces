// Background (service worker no Chrome / event page no Firefox).
// - Faz as chamadas de tradução (o content script não pode, por causa do CORS)
//   e guarda um cache local.
// - Analisa ícones pequenos do Codeforces para o tema escuro.
// - Repassa o atalho de teclado para a aba ativa.
'use strict';

if (typeof importScripts === 'function') {
  try {
    importScripts('shared/defaults.js', 'shared/i18n.js', 'shared/color.js');
  } catch (e) {
    console.error('[Hiraku Codeforces]', e);
  }
}

const ext = globalThis.browser ?? globalThis.chrome;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class TranslateError extends Error {
  constructor(message, fatal = false) {
    super(message);
    this.fatal = fatal; // erro de configuração: não adianta tentar plano B
  }
}

/** Mensagem no idioma da interface escolhido pelo usuário. */
async function tr(key, vars) {
  let pref = 'auto';
  try {
    pref = (await ext.storage.local.get({ uiLang: 'auto' })).uiLang;
  } catch (e) {
    /* padrão */
  }
  return globalThis.CFM_I18N.make(pref)(key, vars);
}

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------ Google ------------------------------ */

async function googleTranslate(text, lang) {
  const base =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&ie=UTF-8&oe=UTF-8&tl=' +
    encodeURIComponent(lang);
  let lastErr = new TranslateError(await tr('errGoogleGeneric'));
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch(base + '&q=' + encodeURIComponent(text));
    } catch (e) {
      lastErr = new TranslateError(await tr('errGoogleNet'));
      await sleep(600 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = new TranslateError(await tr('errGoogleBusy', { status: res.status }));
      await sleep(900 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new TranslateError(await tr('errGoogleHttp', { status: res.status }));
    const data = await res.json();
    const out = (Array.isArray(data[0]) ? data[0] : [])
      .map((seg) => seg && seg[0])
      .filter((s) => typeof s === 'string')
      .join('');
    if (!out) throw new TranslateError(await tr('errGoogleEmpty'));
    return out;
  }
  throw lastErr;
}

/* ------------------------------ DeepL ------------------------------- */

async function deeplTranslate(text, lang, tags) {
  const { deeplKey } = await ext.storage.local.get({ deeplKey: '' });
  const key = (deeplKey || '').trim();
  if (!key) throw new TranslateError(await tr('errDeeplNoKey'), true);

  const target = (globalThis.CFM_LANGS || []).find((l) => l.code === lang)?.deepl;
  if (!target) throw new TranslateError(await tr('errDeeplLang'), true);

  const host = key.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
  const body = { text: [text], target_lang: target, preserve_formatting: true };
  if (tags === 'xml') {
    body.tag_handling = 'xml';
    body.ignore_tags = ['x']; // <x i="3"/> = fórmula: o DeepL não toca
  }

  let lastErr = new TranslateError(await tr('errDeeplGeneric'));
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch(`https://${host}/v2/translate`, {
        method: 'POST',
        headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      lastErr = new TranslateError(await tr('errDeeplNet'));
      await sleep(600 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      lastErr = new TranslateError(await tr('errDeeplBusy', { status: res.status }));
      await sleep(900 * (attempt + 1));
      continue;
    }
    if (res.status === 403) throw new TranslateError(await tr('errDeeplKey'), true);
    if (res.status === 456) throw new TranslateError(await tr('errDeeplQuota'), true);
    if (!res.ok) throw new TranslateError(await tr('errDeeplHttp', { status: res.status }));
    const data = await res.json();
    const out = data?.translations?.[0]?.text;
    if (typeof out !== 'string') throw new TranslateError(await tr('errDeeplBad'));
    return out;
  }
  throw lastErr;
}

/* ------------------------- cache + tradução ------------------------- */

async function handleTranslate({ engine, lang, text, tags = 'none' }) {
  if (!text || !text.trim()) return { ok: true, text: text || '' };

  const cacheKey = 'tc:' + (await sha([engine, lang, tags, text].join('\u0001')));
  const hit = (await ext.storage.local.get(cacheKey))[cacheKey];
  if (hit && typeof hit.t === 'string') return { ok: true, text: hit.t, cached: true };

  const out = engine === 'deepl' ? await deeplTranslate(text, lang, tags) : await googleTranslate(text, lang);
  ext.storage.local.set({ [cacheKey]: { t: out, ts: Date.now() } }).catch(() => {});
  return { ok: true, text: out };
}

/* ------------------------ análise de ícones ------------------------- */

const ICON_HOST = /(^|\.)(codeforces\.(org|com)|codeforc\.es)$/i;

/**
 * Baixa um ícone do próprio Codeforces e diz se ele tem fundo claro ('light'),
 * é um desenho preto ('dark') ou está ok ('none'). Só aceita https em domínios
 * do Codeforces — não serve de "proxy" para outros sites.
 */
async function handleIcon(url) {
  let u;
  try { u = new URL(url); } catch (e) { return { mode: 'none' }; }
  if (u.protocol !== 'https:' || !ICON_HOST.test(u.hostname)) return { mode: 'none' };

  const cacheKey = 'ic:' + (await sha(url));
  const hit = (await ext.storage.local.get(cacheKey))[cacheKey];
  if (hit && typeof hit.m === 'string') return { mode: hit.m };

  let mode = 'none';
  try {
    const res = await fetch(url, { credentials: 'omit' });
    const blob = res.ok ? await res.blob() : null;
    if (blob && blob.size <= 200000 && /^image\//.test(blob.type)) {
      const bmp = await createImageBitmap(blob);
      const w = Math.max(1, Math.min(32, bmp.width));
      const h = Math.max(1, Math.round((bmp.height * w) / bmp.width));
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0, w, h);
      mode = globalThis.CFM_COLOR.classifyIcon(ctx.getImageData(0, 0, w, h).data, w, h);
    }
  } catch (e) {
    mode = 'none'; // formato que o navegador não decodifica, rede etc.
  }
  ext.storage.local.set({ [cacheKey]: { m: mode, ts: Date.now() } }).catch(() => {});
  return { mode };
}

/* ----------------------------- mensagens ---------------------------- */

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'translate') {
    handleTranslate(msg).then(sendResponse, (e) =>
      sendResponse({ ok: false, error: e.message || String(e), fatal: !!e.fatal })
    );
    return true; // resposta assíncrona
  }
  if (msg && msg.type === 'cfm-icon') {
    handleIcon(String(msg.url || '')).then(sendResponse, () => sendResponse({ mode: 'none' }));
    return true;
  }
  return false;
});

// Atalho de teclado (Alt+Shift+T por padrão; o usuário pode mudar no navegador).
ext.commands?.onCommand.addListener(async (command) => {
  if (command !== 'toggle-translate') return;
  try {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) await ext.tabs.sendMessage(tab.id, { type: 'cfm-toggle' });
  } catch (e) {
    /* aba sem o content script (não é Codeforces) */
  }
});

// Limpeza do cache: 21 dias e no máximo 1000 entradas de cada tipo.
async function pruneCache() {
  try {
    const all = await ext.storage.local.get(null);
    const cutoff = Date.now() - 21 * 864e5;
    const drop = [];
    for (const prefix of ['tc:', 'ic:']) {
      const entries = Object.entries(all).filter(([k]) => k.startsWith(prefix));
      drop.push(...entries.filter(([, v]) => !v || v.ts < cutoff).map(([k]) => k));
      const keep = entries.filter(([, v]) => v && v.ts >= cutoff).sort((a, b) => a[1].ts - b[1].ts);
      if (keep.length > 1000) drop.push(...keep.slice(0, keep.length - 1000).map(([k]) => k));
    }
    if (drop.length) await ext.storage.local.remove(drop);
  } catch (e) {
    /* sem problema */
  }
}
ext.runtime.onStartup?.addListener(pruneCache);
ext.runtime.onInstalled.addListener(pruneCache);
