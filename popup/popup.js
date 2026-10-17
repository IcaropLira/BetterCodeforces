(() => {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const D = globalThis.CFM_DEFAULTS;
  const LANGS = globalThis.CFM_LANGS;
  const I18N = globalThis.CFM_I18N;
  const $ = (id) => document.getElementById(id);

  const ACCENTS = ['#5b7cfa', '#8b5cf6', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];
  let s = { ...D };
  let T = I18N.make(s.uiLang);

  const save = (patch) => {
    Object.assign(s, patch);
    ext.storage.local.set(patch);
  };

  function setStatus(text, kind = '') {
    const el = $('status');
    el.textContent = text;
    el.className = 'status ' + kind;
  }

  /** Troca todos os textos marcados com data-i18n pelo idioma atual. */
  function applyI18n() {
    T = I18N.make(s.uiLang);
    document.documentElement.lang = I18N.resolve(s.uiLang);
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = T(el.dataset.i18n);
    for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = T(el.dataset.i18nTitle);
    renderSwatches(); // o título da cor personalizada também muda
  }

  /* ---------- aparência ---------- */

  function renderTheme() {
    for (const b of $('theme').querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === s.theme);
  }

  function renderSwatches() {
    const box = $('swatches');
    box.textContent = '';
    for (const c of ACCENTS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (c.toLowerCase() === s.accent.toLowerCase() ? ' on' : '');
      b.style.setProperty('--c', c);
      b.title = c;
      b.addEventListener('click', () => {
        save({ accent: c });
        renderSwatches();
      });
      box.append(b);
    }
    const custom = document.createElement('input');
    custom.type = 'color';
    custom.value = /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : '#5b7cfa';
    custom.title = T('accentCustom');
    custom.addEventListener('input', () => save({ accent: custom.value }));
    custom.addEventListener('change', renderSwatches);
    box.append(custom);
  }

  function renderEngine() {
    $('deeplRow').hidden = s.engine !== 'deepl';
  }

  /* ---------- inicialização ---------- */

  async function init() {
    try {
      s = { ...D, ...(await ext.storage.local.get(D)) };
    } catch (e) {
      /* padrões */
    }

    $('enabled').checked = s.enabled;
    $('enabled').addEventListener('change', (e) => save({ enabled: e.target.checked }));

    renderTheme();
    for (const b of $('theme').querySelectorAll('button')) {
      b.addEventListener('click', () => {
        save({ theme: b.dataset.v });
        renderTheme();
      });
    }

    $('font').value = s.font;
    $('font').addEventListener('change', (e) => save({ font: e.target.value }));

    $('fontSize').value = s.fontSize;
    $('fontSizeVal').textContent = `${s.fontSize}px`;
    $('fontSize').addEventListener('input', (e) => {
      $('fontSizeVal').textContent = `${e.target.value}px`;
      save({ fontSize: Number(e.target.value) });
    });

    for (const l of LANGS) {
      const o = document.createElement('option');
      o.value = l.code;
      o.textContent = l.name;
      $('targetLang').append(o);
    }
    $('targetLang').value = s.targetLang;
    $('targetLang').addEventListener('change', (e) => save({ targetLang: e.target.value }));

    $('engine').value = s.engine;
    renderEngine();
    $('engine').addEventListener('change', (e) => {
      save({ engine: e.target.value });
      renderEngine();
    });

    $('deeplKey').value = s.deeplKey;
    $('deeplKey').addEventListener('change', (e) => save({ deeplKey: e.target.value.trim() }));

    $('autoTranslate').checked = s.autoTranslate;
    $('autoTranslate').addEventListener('change', (e) => save({ autoTranslate: e.target.checked }));

    $('uiLang').value = s.uiLang;
    $('uiLang').addEventListener('change', (e) => {
      save({ uiLang: e.target.value });
      applyI18n();
      checkTab();
    });

    $('test').addEventListener('click', testEngine);
    $('translateNow').addEventListener('click', translateNow);

    applyI18n();
    checkTab();
  }

  /* ---------- ações ---------- */

  async function activeTab() {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function checkTab() {
    const btn = $('translateNow');
    btn.disabled = true;
    btn.textContent = T('translateNow');
    try {
      const tab = await activeTab();
      const r = await ext.tabs.sendMessage(tab.id, { type: 'cfm-ping' });
      if (r?.hasStatement) {
        btn.disabled = false;
        btn.textContent = r.mode === 'trans' ? T('showOriginal') : T('translateNow');
        setStatus('');
      } else {
        setStatus(T('openProblem'));
      }
    } catch (e) {
      setStatus(T('openProblem'));
    }
  }

  async function translateNow() {
    try {
      const tab = await activeTab();
      await ext.tabs.sendMessage(tab.id, { type: 'cfm-toggle' });
      window.close();
    } catch (e) {
      setStatus(T('noReach'), 'err');
    }
  }

  async function testEngine() {
    // Mesmo formato que a tradução real usa: se isto passar, a chave/serviço estão ok.
    const xml = s.engine === 'deepl';
    const text = xml ? 'Hello, <x i="0"/> and <g i="1">world</g>!' : 'Hello, ⟦0⟧ and ⟦1⟧world⟦/1⟧!';
    setStatus(T('testing'));
    try {
      const r = await ext.runtime.sendMessage({
        type: 'translate',
        engine: s.engine,
        lang: s.targetLang,
        text,
        tags: xml ? 'xml' : 'none',
      });
      if (!r?.ok) setStatus(r?.error || T('testFail'), 'err');
      else setStatus(T('testOk', { text: r.text }), 'ok');
    } catch (e) {
      setStatus(e.message || String(e), 'err');
    }
  }

  init();
})();
