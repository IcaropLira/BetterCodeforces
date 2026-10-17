// Proteção de fórmulas/markup durante a tradução.
//
// Um trecho do enunciado é representado como uma lista de "partes":
//   { t: 'text',  v }   texto comum (traduzível)
//   { t: 'atom',  id }  algo que NUNCA deve ser traduzido (fórmula, código, <img>…)
//   { t: 'open',  id }  abertura de um elemento inline (<b>, <i>, <a>…)
//   { t: 'close', id }  fechamento desse elemento
//
// Antes de enviar ao tradutor, atoms e tags viram marcadores; na volta, os
// marcadores são validados (todos presentes, uma vez só, bem aninhados) e
// convertidos de novo em partes. Se qualquer coisa vier errada, `decode`
// devolve null e o chamador usa um plano B — a fórmula nunca é corrompida.
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.CFM_TEX = lib;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Codeforces usa $$$...$$$ (inline) e $$$$$$...$$$$$$ (em bloco).
  const RAW_TEX = /\${6}[\s\S]*?\${6}|\${3}[\s\S]*?\${3}/g;

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const unesc = (s) =>
    s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

  /** Separa um texto em pedaços comuns e fórmulas $$$…$$$ ainda não renderizadas. */
  function splitTex(text) {
    const out = [];
    let last = 0;
    let m;
    RAW_TEX.lastIndex = 0;
    while ((m = RAW_TEX.exec(text))) {
      if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
      out.push({ t: 'tex', v: m[0] });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
    return out;
  }

  /** Há pelo menos uma "palavra" fora das fórmulas? (senão não vale traduzir) */
  function hasLetters(parts) {
    return parts.some((p) => p.t === 'text' && /\p{L}{2,}/u.test(p.v));
  }

  // mode 'tok': marcadores ⟦3⟧ ⟦/3⟧ (bom para Google, que só traduz texto puro)
  // mode 'xml': <x i="3"/> e <g i="3">…</g> (para o DeepL com tag_handling=xml)
  function encode(parts, mode) {
    const xml = mode === 'xml';
    let out = '';
    for (const p of parts) {
      if (p.t === 'text') out += xml ? esc(p.v) : p.v;
      else if (p.t === 'atom') out += xml ? `<x i="${p.id}"/>` : `⟦${p.id}⟧`;
      else if (p.t === 'open') out += xml ? `<g i="${p.id}">` : `⟦${p.id}⟧`;
      else out += xml ? '</g>' : `⟦/${p.id}⟧`;
    }
    return out;
  }

  /**
   * Converte a resposta do tradutor de volta em partes.
   * `srcParts` são as partes originais (dizem quais marcadores devem existir).
   * Devolve null se algum marcador sumiu, duplicou, apareceu do nada ou ficou
   * mal aninhado.
   */
  function decode(str, srcParts, mode) {
    const atoms = new Set();
    const wraps = new Set();
    for (const p of srcParts) {
      if (p.t === 'atom') atoms.add(p.id);
      else if (p.t === 'open') wraps.add(p.id);
    }
    const xml = mode === 'xml';
    const re = xml
      ? /<x\s+i="(\d+)"\s*\/?>|<g\s+i="(\d+)"\s*>|<\/g\s*>/g
      : /⟦\s*(\/)?\s*(\d+)\s*⟧/g;

    const out = [];
    const seenA = new Set();
    const seenO = new Set();
    const seenC = new Set();
    const stack = [];
    const pushText = (s) => {
      if (s) out.push({ t: 'text', v: xml ? unesc(s) : s });
    };

    let last = 0;
    let m;
    while ((m = re.exec(str))) {
      pushText(str.slice(last, m.index));
      last = m.index + m[0].length;

      let kind;
      let id;
      if (xml) {
        if (m[1] !== undefined) { kind = 'atom'; id = +m[1]; }
        else if (m[2] !== undefined) { kind = 'open'; id = +m[2]; }
        else { kind = 'close'; id = stack.length ? stack[stack.length - 1] : -1; }
      } else {
        id = +m[2];
        kind = m[1] ? 'close' : atoms.has(id) ? 'atom' : wraps.has(id) ? 'open' : 'bad';
      }

      if (kind === 'atom') {
        if (!atoms.has(id) || seenA.has(id)) return null;
        seenA.add(id);
        out.push({ t: 'atom', id });
      } else if (kind === 'open') {
        if (!wraps.has(id) || seenO.has(id)) return null;
        seenO.add(id);
        stack.push(id);
        out.push({ t: 'open', id });
      } else if (kind === 'close') {
        if (!stack.length || stack[stack.length - 1] !== id) return null;
        stack.pop();
        seenC.add(id);
        out.push({ t: 'close', id });
      } else {
        return null;
      }
    }
    pushText(str.slice(last));

    if (stack.length) return null;
    if (seenA.size !== atoms.size || seenO.size !== wraps.size || seenC.size !== wraps.size) return null;
    return out;
  }

  /** Quebra textos longos em fronteiras de frase (os marcadores nunca são cortados). */
  function chunk(str, max) {
    if (str.length <= max) return [str];
    const sentences = str.split(/(?<=[.!?。！？])\s+/);
    const chunks = [];
    let cur = '';
    const flush = () => {
      if (cur) chunks.push(cur);
      cur = '';
    };
    for (let s of sentences) {
      while (s.length > max) {
        // frase gigante: corta no último espaço antes do limite
        let cut = s.lastIndexOf(' ', max);
        if (cut < max * 0.5) cut = max;
        flush();
        chunks.push(s.slice(0, cut));
        s = s.slice(cut).trimStart();
      }
      if (cur && cur.length + 1 + s.length > max) flush();
      cur = cur ? cur + ' ' + s : s;
    }
    flush();
    return chunks;
  }

  return { splitTex, hasLetters, encode, decode, chunk };
});
