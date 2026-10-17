// Textos da interface (English / Português). Cada contexto (popup, content
// script, background) cria seu `t` com CFM_I18N.make(idioma).
(function (g) {
  'use strict';

  const M = {
    en: {
      // popup
      tagline: 'Codeforces, redesigned',
      toggleTitle: 'Turn the new look on/off',
      appearance: 'Appearance',
      theme: 'Theme',
      themeAuto: 'Auto',
      themeLight: 'Light',
      themeDark: 'Dark',
      accent: 'Accent color',
      accentCustom: 'Custom color',
      font: 'Font',
      fontSystem: 'Sans-serif (system)',
      fontSerif: 'Serif (reading)',
      fontMono: 'Monospace',
      statementSize: 'Statement text size',
      uiLanguage: 'Interface language',
      uiAuto: 'Automatic',
      translation: 'Translation',
      engine: 'Service',
      engineGoogle: 'Google (free)',
      engineDeepl: 'DeepL (API key)',
      targetLang: 'Translate to',
      deeplKey: 'DeepL API key',
      deeplHint: 'Stored only in this browser. Free-plan keys end with :fx.',
      autoTranslate: 'Translate automatically when a problem opens',
      translateNow: 'Translate this page',
      showOriginal: 'Show original',
      test: 'Test service',
      shortcut: 'Shortcut:',
      shortcutDesc: 'switches between translation and original.',
      privacyNote: 'Statement text is sent to the chosen service only when you translate.',
      openProblem: 'Open a Codeforces problem page to translate.',
      testing: 'Testing…',
      testOk: 'Works: {text}',
      testFail: 'Failed.',
      noReach: "Couldn't reach the page. Reload it and try again.",
      // barra de tradução (content script)
      translate: 'Translate',
      translating: 'Translating {done}/{total}…',
      preparing: 'Preparing…',
      translateAgain: 'Translate again',
      optionsChanged: 'Options changed',
      translatedWith: 'Translated with {engine}',
      idleStatus: '{engine} → {lang}',
      keptOriginal: '{n} snippet(s) kept in the original',
      simpleMode: '{n} translated in simple mode',
      failed: 'Could not translate: {error}',
      unknownError: 'unknown error',
      unexpected: 'Unexpected error: {error}',
      noResponse: 'No response from the extension (reload the page).',
      targetLangTitle: 'Target language',
      // erros do background
      errGoogleNet: 'No connection to Google Translate',
      errGoogleBusy: 'Google responded {status} (usage limit reached?)',
      errGoogleHttp: 'Google responded {status}',
      errGoogleEmpty: 'Empty response from Google Translate',
      errGoogleGeneric: 'Could not talk to Google Translate',
      errDeeplNoKey: 'Enter your DeepL API key in the extension popup.',
      errDeeplLang: 'DeepL does not support this language. Use Google.',
      errDeeplNet: 'No connection to DeepL',
      errDeeplBusy: 'DeepL responded {status} (too many requests)',
      errDeeplKey: 'Invalid DeepL key.',
      errDeeplQuota: 'DeepL quota exhausted for this month.',
      errDeeplHttp: 'DeepL responded {status}',
      errDeeplBad: 'Unexpected response from DeepL',
      errDeeplGeneric: 'Could not talk to DeepL',
    },
    pt: {
      tagline: 'Codeforces, repaginado',
      toggleTitle: 'Ligar/desligar o novo visual',
      appearance: 'Aparência',
      theme: 'Tema',
      themeAuto: 'Auto',
      themeLight: 'Claro',
      themeDark: 'Escuro',
      accent: 'Cor de destaque',
      accentCustom: 'Cor personalizada',
      font: 'Fonte',
      fontSystem: 'Sans-serif (sistema)',
      fontSerif: 'Serifada (leitura)',
      fontMono: 'Monoespaçada',
      statementSize: 'Tamanho do texto do enunciado',
      uiLanguage: 'Idioma da interface',
      uiAuto: 'Automático',
      translation: 'Tradução',
      engine: 'Serviço',
      engineGoogle: 'Google (grátis)',
      engineDeepl: 'DeepL (chave de API)',
      targetLang: 'Traduzir para',
      deeplKey: 'Chave de API do DeepL',
      deeplHint: 'Fica só neste navegador. Chaves do plano gratuito terminam em :fx.',
      autoTranslate: 'Traduzir sozinho ao abrir um problema',
      translateNow: 'Traduzir esta página',
      showOriginal: 'Ver original',
      test: 'Testar serviço',
      shortcut: 'Atalho:',
      shortcutDesc: 'alterna entre tradução e original.',
      privacyNote: 'O texto do enunciado só é enviado ao serviço escolhido quando você traduz.',
      openProblem: 'Abra a página de um problema do Codeforces para traduzir.',
      testing: 'Testando…',
      testOk: 'Funcionou: {text}',
      testFail: 'Falhou.',
      noReach: 'Não consegui falar com a página. Recarregue-a e tente de novo.',
      translate: 'Traduzir',
      translating: 'Traduzindo {done}/{total}…',
      preparing: 'Preparando…',
      translateAgain: 'Traduzir de novo',
      optionsChanged: 'Opções mudaram',
      translatedWith: 'Traduzido com {engine}',
      idleStatus: '{engine} → {lang}',
      keptOriginal: '{n} trecho(s) mantido(s) no original',
      simpleMode: '{n} traduzido(s) em modo simples',
      failed: 'Não foi possível traduzir: {error}',
      unknownError: 'erro desconhecido',
      unexpected: 'Erro inesperado: {error}',
      noResponse: 'Sem resposta da extensão (recarregue a página).',
      targetLangTitle: 'Idioma de destino',
      errGoogleNet: 'Sem conexão com o Google Tradutor',
      errGoogleBusy: 'Google respondeu {status} (limite de uso atingido?)',
      errGoogleHttp: 'Google respondeu {status}',
      errGoogleEmpty: 'Resposta vazia do Google Tradutor',
      errGoogleGeneric: 'Falha ao falar com o Google Tradutor',
      errDeeplNoKey: 'Informe sua chave de API do DeepL no popup da extensão.',
      errDeeplLang: 'O DeepL não suporta este idioma. Use o Google.',
      errDeeplNet: 'Sem conexão com o DeepL',
      errDeeplBusy: 'DeepL respondeu {status} (muitas requisições)',
      errDeeplKey: 'Chave do DeepL inválida.',
      errDeeplQuota: 'Cota do DeepL esgotada neste mês.',
      errDeeplHttp: 'DeepL respondeu {status}',
      errDeeplBad: 'Resposta inesperada do DeepL',
      errDeeplGeneric: 'Falha ao falar com o DeepL',
    },
  };

  /** 'auto' → idioma do navegador (pt* → português, o resto → inglês). */
  function resolve(pref) {
    if (pref === 'en' || pref === 'pt') return pref;
    const ext = g.browser || g.chrome;
    let ui = '';
    try {
      ui = (ext && ext.i18n && ext.i18n.getUILanguage && ext.i18n.getUILanguage()) || '';
    } catch (e) {
      /* sem API */
    }
    ui = ui || (g.navigator && g.navigator.language) || 'en';
    return /^pt/i.test(ui) ? 'pt' : 'en';
  }

  /** Devolve t(chave, variáveis) para o idioma escolhido. */
  function make(pref) {
    const lang = resolve(pref);
    return (key, vars) => {
      let s = (M[lang] && M[lang][key]) ?? M.en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    };
  }

  g.CFM_I18N = { messages: M, resolve, make };
})(typeof globalThis !== 'undefined' ? globalThis : self);
