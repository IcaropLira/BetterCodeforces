# Política de Privacidade — Hiraku Codeforces

_Última atualização: 2026-11-22 · English: [PRIVACY.md](PRIVACY.md)_

O Hiraku Codeforces é uma extensão de navegador que muda o visual do Codeforces e pode traduzir enunciados de problemas. Esta política explica o que ela faz com os seus dados. Resumindo: **o desenvolvedor não coleta nada.** Não há servidor, conta, análise de uso nem rastreamento.

## O que fica no seu dispositivo
- **Configurações** (tema, cor de destaque, fonte, tamanho do texto, idioma de tradução, serviço, idioma da interface, traduzir automaticamente, anti-spoiler, esconder resolvidos, organização, modo do heatmap, opções do "quem você conhece") ficam no armazenamento da extensão (`storage.local`).
- **Sua chave de API do DeepL**, se você optar pelo DeepL, fica no mesmo lugar. Ela só sai do navegador para autenticar pedidos ao DeepL (veja abaixo).
- **Um cache de traduções** (trechos traduzidos, por até 21 dias / 1.000 itens) e um **cache de ícones** (se um ícone pequeno precisa de ajuste no tema escuro) ficam guardados localmente para não repetir trabalho.

Você pode apagar tudo isso a qualquer momento desinstalando a extensão ou limpando os dados dela.

## O que é enviado pela rede, e só quando você pede
- **Tradução.** Quando você clica em *Traduzir* (ou ativa *Traduzir sozinho*), o texto do enunciado da página atual é enviado **diretamente do seu navegador** ao serviço escolhido:
  - **Google Tradutor** (`translate.googleapis.com`, o endpoint público usado pelas ferramentas de tradução do Google), ou
  - **DeepL** (`api-free.deepl.com` / `api.deepl.com`), autenticado com a sua própria chave de API.

  Fórmulas matemáticas, código e entradas/saídas de exemplo são trocados por marcadores antes do envio e **não** são transmitidos. Esses serviços tratam o texto conforme as próprias políticas: [Google](https://policies.google.com/privacy), [DeepL](https://www.deepl.com/privacy). O desenvolvedor da extensão nunca recebe esse texto.
- **Ícones.** Para corrigir ícones pequenos com fundo branco no tema escuro, a extensão baixa ícones **somente de domínios do Codeforces** (`codeforces.com`, `codeforces.org`, `codeforc.es`) e analisa os pixels localmente. Nada disso é enviado a outro lugar.

- **College standings,** só quando você aperta *Minha instituição* num standings: a extensão lê, **do próprio Codeforces**, o seu perfil público (para achar a organização), a lista pública de rating da organização e a classificação pública do contest (`codeforces.com/api/contest.standings`, chamada anônima). A lista de membros fica guardada localmente por 3 dias. Nada é enviado para outro lugar.

- **"Quem você conhece" na página do problema** (dá para desligar no popup): usa os mesmos dados públicos abaixo para os seus amigos e, se quiser, os 30 membros mais ativos da sua organização, guardando só quais problemas cada pessoa resolveu ou tentou, por 12 horas, no seu navegador.
- **Exportações** (CSV / JSON) são geradas no seu navegador e salvas direto no seu computador; nada é enviado.
- **Heatmap e Hiraku Analytics,** só quando você escolhe um modo de heatmap diferente das cores do Codeforces ou abre a página de analytics: a extensão lê, **do próprio Codeforces**, dados públicos pela API oficial (`user.status`, `user.info`, `user.rating`, `problemset.problems`, chamadas anônimas) e, na aba *Amigos*, a sua própria página `codeforces.com/friends`. Os resumos ficam guardados localmente por 30 minutos e a lista de problemas por um dia. Nada é enviado para outro lugar.

Nenhuma outra requisição de rede é feita. A extensão não carrega nem executa código remoto.

## O que a extensão não faz
Não coleta informações pessoais, histórico de navegação, credenciais ou identificadores; não lê páginas fora do Codeforces; não usa cookies próprios; não vende, compartilha nem transfere dados a terceiros além do serviço de tradução que você escolher, e apenas para traduzir.

## Permissões, em português claro
- `storage` — guardar suas configurações e os caches locais.
- Acesso a `codeforces.com`, `codeforces.org` e `codeforc.es` — aplicar o tema e traduzir enunciados nesses sites.
- Acesso a `translate.googleapis.com`, `api-free.deepl.com`, `api.deepl.com` — enviar o texto do enunciado ao serviço de tradução escolhido.

## Crianças
A extensão não é direcionada a crianças e não coleta dados pessoais de ninguém.

## Mudanças
Se esta política mudar, a nova versão será publicada neste repositório com a data atualizada e a página da extensão será atualizada.

## Contato
Abra uma issue em <https://github.com/IcaropLira/BetterCodeforces/issues>.

_O Hiraku Codeforces é um projeto independente e não oficial. Não é afiliado, endossado nem patrocinado pelo Codeforces, Google ou DeepL._
