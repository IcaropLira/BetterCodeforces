# Hiraku Codeforces

<img src="brand/hiraku-codeforces.svg" width="96" alt="">

[![CI](https://github.com/IcaropLira/BetterCodeforces/actions/workflows/ci.yml/badge.svg)](https://github.com/IcaropLira/BetterCodeforces/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue.svg)](LICENSE)

Extensão para **Chrome e Firefox** que dá ao [Codeforces](https://codeforces.com) um visual moderno e traduz enunciados **sem quebrar as fórmulas TeX**.

🇺🇸 English: [README.md](README.md)

> Projeto não oficial. Sem afiliação, endosso ou patrocínio do Codeforces, Google ou DeepL.

## Recursos

**Visual**
- Tema claro, escuro ou automático, com cor de destaque, fonte e tamanho do texto à sua escolha.
- Páginas de problema redesenhadas (enunciado legível, exemplos organizados com botão de copiar), cartões, tabelas, menus e formulários.
- **Motor de contraste no modo escuro:** o Codeforces tem centenas de elementos coloridos "à mão" (caixas brancas, texto preto, links azul-marinho, ícones claros). Além da folha de estilo, um script olha as cores *calculadas* e corrige o que ainda estiver ilegível, mantendo as cores dos ratings reconhecíveis.
- Interface em português e inglês.

**Tradução**
- Um clique (ou `Alt+Shift+T`) traduz o enunciado; outro clique mostra o original.
- Fórmulas, código e exemplos viram marcadores antes de traduzir e voltam depois — os *mesmos nós do MathJax já renderizados* são devolvidos ao lugar, nunca reconstruídos a partir de texto.
- A resposta é validada (todo marcador presente uma vez e bem aninhado). Se o serviço bagunçar, o trecho é refeito em modo "simples" (só frases) e, se ainda assim falhar, fica no original.
- Google Tradutor (sem chave) ou DeepL (sua própria chave de API); 17 idiomas de destino; cache local.

**Qualidade de vida**
- **College standings:** em qualquer standings, filtre por handle/equipe ou troque para *Minha instituição* — todo mundo da sua organização do Codeforces, com a posição dentro dela e a geral (contests normais); em gyms/grupos filtra a página aberta.
- **Anti-spoiler:** tags e dificuldade borradas até passar o mouse.
- **Esconder problemas resolvidos** na lista de problemas.

## Instalação

| Navegador | Como |
|---|---|
| Chrome / Edge / Brave | **[Chrome Web Store](https://chromewebstore.google.com/detail/hiraku-codeforces/kbjfgloamahakmngfecokkmffeakjnpk)**. Ou pelo zip: baixe `hiraku-codeforces-<versão>-chrome.zip` em [Releases](../../releases), descompacte, abra `chrome://extensions`, ative o *Modo do desenvolvedor* → *Carregar sem compactação*. |
| Firefox | **[Firefox Add-ons](https://addons.mozilla.org/firefox/addon/hiraku-for-codeforces/)**. Ou `about:debugging#/runtime/this-firefox` → *Carregar extensão temporária* → escolha o zip do Firefox (temporária até reiniciar). |

Requer Chrome 120+ / Firefox 140+.

## Uso

Clique no ícone da extensão para escolher tema, cor, fonte, tamanho, idioma/serviço de tradução e idioma da interface. Na página de um problema, use a barra **Traduzir** acima do enunciado.

## Privacidade

Sem conta, sem análise de uso, sem servidor do desenvolvedor. O texto do enunciado é enviado ao serviço de tradução **que você escolher**, só quando você traduz; fórmulas e exemplos não são enviados. Detalhes: [PRIVACY.pt-BR.md](PRIVACY.pt-BR.md).

## Desenvolvimento

```bash
npm ci
npm test          # testes unitários e de DOM (node:test, jsdom)
npm run build     # dist/chrome, dist/firefox e os zips das lojas
npm run lint      # web-ext lint no build do Firefox
npm run check     # tudo acima
npm run test:e2e  # Chromium de verdade com a extensão carregada (veja e2e/run.mjs)
```

### Corrigindo um glitch visual
Clique com o botão direito no elemento → *Inspecionar*, anote a classe e acrescente uma regra na seção correspondente de `content/theme.css`. A maioria das cores avulsas já é tratada pelo motor de contraste, então olhe também `content/contrast.js` antes de criar casos especiais. Ao abrir uma issue, inclua um print e a URL da página.

### Publicação
Veja [docs/PUBLISHING.md](docs/PUBLISHING.md) (em inglês) e [docs/STORE_LISTING.md](docs/STORE_LISTING.md).

## Licença

[MIT](LICENSE)
