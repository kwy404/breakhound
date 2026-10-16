<div align="center">

<img src="https://cdn.jsdelivr.net/gh/kwy404/breakhound@main/assets/mascot.svg" alt="Sniff, o bloodhound detetive do breakhound com uma lupa" width="160">

# breakhound

**Aponte para qualquer pacote JavaScript. Ele fareja os bugs.**

[![npm version](https://img.shields.io/npm/v/breakhound.svg)](https://www.npmjs.com/package/breakhound)
[![CI](https://github.com/kwy404/breakhound/actions/workflows/ci.yml/badge.svg)](https://github.com/kwy404/breakhound/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/kwy404/breakhound/blob/main/LICENSE)

[English](https://github.com/kwy404/breakhound/blob/main/README.md) | Português (Brasil)

[Site e demo ao vivo](https://kwy404.github.io/breakhound/) · [Guias](https://kwy404.github.io/breakhound/guides.html) · [npm](https://www.npmjs.com/package/breakhound)

</div>

O breakhound lê as declarações TypeScript de uma biblioteca, testa cada função exportada com entradas de casos extremos (fusos horários, datas antes de 1970, emoji, `-0`, `NaN` e outras), executa cada chamada em um processo filho com timeout e verifica algumas regras que bibliotecas reais quebram o tempo todo. Cada achado vem com uma reprodução mínima e um teste Vitest pronto para colar.

## Início rápido

```bash
npx breakhound date-fns           # um pacote do npm
npx breakhound ./caminho/da-lib   # uma pasta local
npx breakhound                    # o pacote da pasta atual
```

Opções úteis:

```bash
npx breakhound minha-lib --fail-on high            # sai com código 1 se houver achado high
npx breakhound minha-lib --json --output report.json
npx breakhound minha-lib --only 'format*' --rules nan-leak,roundtrip
```

Rode `npx breakhound --help` para ver todas as opções. Um erro de digitação como `--jsn` recebe uma sugestão.

## Comparar duas versões

Salve um relatório e passe ele como base de uma execução posterior. O breakhound lista os achados novos e os corrigidos, e o `--fail-on` conta só os novos.

```bash
npx breakhound minha-lib@1 --json --output v1.json
npx breakhound minha-lib@2 --baseline v1.json --fail-on high
```

`--baseline last` compara com a execução anterior salva em `.breakhound/report.json`. O [site](https://kwy404.github.io/breakhound/#try) também tem uma demo no navegador: cole duas versões de uma função e veja cada entrada em que as respostas mudam.

## O que ele verifica

| Regra | O que quebra |
| --- | --- |
| `lone-surrogate-output` | Um emoji ou caractere astral é cortado ao meio |
| `timezone-dependent` | A mesma entrada dá outro resultado quando o `TZ` muda |
| `unexpected-crash` | Um valor aceito pelos tipos lança `TypeError` |
| `nan-leak` | Sai `NaN` de uma entrada finita |
| `roundtrip` | `decode(encode(x))` não é `x` |
| `not-idempotent` | `normalize(normalize(x))` difere de `normalize(x)` |
| `negative-zero-sign` | `-0.5` é impresso sem o sinal de menos |
| `nondeterministic` | A mesma chamada devolve resultados diferentes |

As entradas vêm do [edgegoat](https://kwy404.github.io/edgegoat/), um catálogo de casos extremos para JavaScript. O breakhound precisa das declarações TypeScript (arquivos `.d.ts` no pacote ou `@types`); sem elas ele para com uma mensagem clara.

## Uso em CI

```yaml
- run: npm ci --ignore-scripts
- run: npx breakhound . --fail-on high
```

No GitHub Actions, o breakhound também escreve anotações e um resumo do job. Veja o [guia do GitHub Actions](https://kwy404.github.io/breakhound/automated-testing-in-github-actions.html).

## Segurança

O breakhound **executa o código que analisa**. Rode em código confiável ou dentro de um contêiner. Instalações do npm usam `--ignore-scripts`, e cada chamada roda em um processo filho com timeout. Esse isolamento evita que um travamento pare a execução; não é uma sandbox de segurança.

## De onde vêm as regras

Cada regra vem de um bug que Alexandre Kohler corrigiu em código aberto, por exemplo [github/relative-time-element#384](https://github.com/github/relative-time-element/pull/384) (fuso horário), [google/budoux#1411](https://github.com/google/budoux/pull/1411) (pares substitutos cortados) e [mozilla/pdf.js#22017](https://github.com/mozilla/pdf.js/pull/22017) (sinal de menos perdido).

## Mais de kwy404

- [graphemely](https://kwy404.github.io/graphemely/): utilitários de string que respeitam grafemas.
- [edgegoat](https://kwy404.github.io/edgegoat/): entradas de casos extremos para testes em JavaScript.
- [vueleap](https://kwy404.github.io/vueleap/): migre de Vue 2 para Vue 3 com um comando.
- [numberparrot](https://kwy404.github.io/numberparrot/): leia números e moedas localizados.
- [Voodoo.js](https://kwy404.github.io/Voodoo.js/): atributos reativos para HTML puro.
- [Monsoon](https://kwy404.github.io/monsoon/): CSS utilitário sem etapa de build.
- [cookieowl](https://kwy404.github.io/cookieowl/): banner de consentimento de cookies para LGPD e GDPR que bloqueia rastreadores até o consentimento.
- [installkite](https://kwy404.github.io/installkite/): torne um site instalável e com funcionamento offline.
- [a11ymedic](https://kwy404.github.io/a11ymedic/): verificador de acessibilidade que explica cada problema e a correção.
- [fontsketch](https://kwy404.github.io/fontsketch/): transforme sua letra em uma fonte no navegador.
- [kastor](https://kwy404.github.io/kastor/): um ORM TypeScript para vários bancos de dados.

## Autor

Feito por Alexandre Kohler ([GitHub](https://github.com/kwy404), [LinkedIn](https://www.linkedin.com/in/alexandre-silva-173687256/)).

O [site](https://kwy404.github.io/breakhound/) é feito com [Monsoon](https://kwy404.github.io/monsoon/), e as partes interativas com [Voodoo.js](https://kwy404.github.io/Voodoo.js/).

## Licença

[MIT](https://github.com/kwy404/breakhound/blob/main/LICENSE). Copyright (c) Alexandre Kohler
