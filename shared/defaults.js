// Configurações padrão e lista de idiomas — compartilhado entre popup,
// content script e background.
(function (g) {
  'use strict';

  g.CFM_DEFAULTS = {
    enabled: true,          // aplica o novo visual
    theme: 'auto',          // auto | light | dark
    accent: '#ee3d8b',      // cor de destaque (rosa Hiraku)
    font: 'system',         // system | serif | mono
    fontSize: 16,           // tamanho do texto do enunciado (px)
    engine: 'google',       // google | deepl
    targetLang: 'pt',       // idioma de destino
    deeplKey: '',           // chave da API do DeepL (guardada só neste navegador)
    autoTranslate: false,   // traduzir sozinho ao abrir um problema
    uiLang: 'auto',         // idioma da interface: auto | en | pt
    mathWaitMs: 6000,       // quanto esperar o MathJax terminar antes de traduzir
    hideTags: false,        // anti-spoiler: borra tags e dificuldade até passar o mouse
    hideSolved: false,      // esconde problemas já resolvidos na lista de problemas
    orgId: '',              // organização do college standings ('' = a do seu perfil)
    collegeDefault: false,  // abrir standings já filtrado pela instituição
  };

  // `deepl` = código aceito pelo DeepL (ausente = DeepL não suporta).
  g.CFM_LANGS = [
    { code: 'pt', name: 'Português (Brasil)', deepl: 'PT-BR' },
    { code: 'es', name: 'Español', deepl: 'ES' },
    { code: 'en', name: 'English', deepl: 'EN-US' },
    { code: 'ru', name: 'Русский', deepl: 'RU' },
    { code: 'fr', name: 'Français', deepl: 'FR' },
    { code: 'de', name: 'Deutsch', deepl: 'DE' },
    { code: 'it', name: 'Italiano', deepl: 'IT' },
    { code: 'tr', name: 'Türkçe', deepl: 'TR' },
    { code: 'uk', name: 'Українська', deepl: 'UK' },
    { code: 'pl', name: 'Polski', deepl: 'PL' },
    { code: 'id', name: 'Bahasa Indonesia', deepl: 'ID' },
    { code: 'ja', name: '日本語', deepl: 'JA' },
    { code: 'ko', name: '한국어', deepl: 'KO' },
    { code: 'zh-CN', name: '中文 (简体)', deepl: 'ZH-HANS' },
    { code: 'ar', name: 'العربية', deepl: 'AR' },
    { code: 'vi', name: 'Tiếng Việt' },
    { code: 'hi', name: 'हिन्दी' },
  ];
})(typeof globalThis !== 'undefined' ? globalThis : self);
