<div align="center">

<img src="https://cdn.jsdelivr.net/gh/kwy404/breakhound@main/assets/mascot.svg" alt="Sniff, o bloodhound detetive do breakhound com uma lupa" width="160">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/breakhound@main/assets/banner-dark.svg">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/breakhound@main/assets/banner.svg" alt="banner do breakhound" width="100%">
</picture>

# breakhound: encontre bugs em qualquer biblioteca JavaScript automaticamente, sem escrever testes

**Aponte para qualquer pacote JavaScript. Ele fareja os bugs.**

[![npm version](https://img.shields.io/npm/v/breakhound.svg)](https://www.npmjs.com/package/breakhound)
[![npm downloads](https://img.shields.io/npm/dm/breakhound.svg)](https://www.npmjs.com/package/breakhound)
[![CI](https://github.com/kwy404/breakhound/actions/workflows/ci.yml/badge.svg)](https://github.com/kwy404/breakhound/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/kwy404/breakhound/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6.svg)](https://www.typescriptlang.org/)

[English](https://github.com/kwy404/breakhound/blob/main/README.md) | Português (Brasil)

[Site](https://kwy404.github.io/breakhound/) · [npm](https://www.npmjs.com/package/breakhound)

</div>

O breakhound é um caçador de bugs sem configuração para bibliotecas JavaScript e TypeScript. Ele lê os tipos TypeScript do pacote, gera entradas difíceis para cada parâmetro (fusos horários, horário de verão, emoji e unicode, `-0`, `NaN`, datas antes de 1970), executa cada chamada em um processo filho isolado com timeout e verifica invariantes que bibliotecas reais quebram o tempo todo. Cada achado vem com uma reprodução mínima e um teste Vitest pronto para colar.

## Sumário

- [Início rápido](#início-rápido)
- [O que ele verifica](#o-que-ele-verifica)
- [Exemplo de saída](#exemplo-de-saída)
- [Uso em CI](#uso-em-ci)
- [Segurança](#segurança)
- [Perguntas frequentes](#perguntas-frequentes)
- [Comparação com fast-check e Jazzer.js](#comparação-com-fast-check-e-jazzerjs)
- [Nascido de 130 correções de bugs reais](#nascido-de-130-correções-de-bugs-reais)
- [Mais de kwy404](#mais-de-kwy404)
- [Licença](#licença)

## Início rápido

Sem instalação, sem configuração, sem testes para escrever:

```bash
# qualquer pacote do npm
npx breakhound date-fns

# um projeto ou biblioteca local
npx breakhound ./caminho/para/sua-lib
```

Saída para máquinas e bloqueio em CI:

```bash
npx breakhound minha-lib --json > findings.json
npx breakhound minha-lib --fail-on high
```

## O que ele verifica

| Invariante | O que quebra | Causa comum |
| --- | --- | --- |
| Surrogate solto na saída | Um emoji é cortado ao meio | `slice`, `substr` ou `charAt` cortando unidades UTF-16 |
| Depende do fuso do host | A mesma entrada muda quando `TZ` muda | Mistura de `getUTC*` com getters locais |
| Crash com entrada válida | `TypeError` inesperado para um valor que os tipos aceitam | Strings vazias, `-0`, datas antigas, unicode |
| Vazamento de NaN | `NaN` onde se esperava um número | Parsing ou contas sem proteção |
| Roundtrip quebrado | `decode(encode(x))` diferente de `x` | Escape com perda, perda de precisão |
| Normalize não idempotente | `normalize(normalize(x))` diferente de `normalize(x)` | Substituições dependentes de ordem |
| Sinal negativo perdido | `-0.5` vira `0.5` | Sinal tirado da parte inteira |
| Não determinismo | Mesma chamada, resultados diferentes | Estado global, `Date.now`, `Math.random` |

As entradas vêm do [edgegoat](https://kwy404.github.io/edgegoat/), um catálogo de casos extremos para JavaScript.

## Exemplo de saída

> Exemplo ilustrativo. A saída real depende do pacote analisado.

```text
breakhound v0.1.0  scanning example-format@2.3.1

  HIGH  formatRelative  output depends on host time zone
        input:  new Date("2024-12-31T23:30:00Z")
        TZ=UTC            "this year"
        TZ=Asia/Tokyo     "last year"

  MED   formatNumber    negative number lost its sign
        input:  -0.5
        output: "0.5"

  2 findings  (1 high, 1 medium)
```

```ts
import { test, expect } from "vitest";
import { formatNumber } from "example-format";

test("formatNumber mantém o sinal de valores entre -1 e 0", () => {
  expect(formatNumber(-0.5)).toBe("-0.5");
});
```

## Uso em CI

```yaml
name: breakhound
on: [push, pull_request]
jobs:
  sniff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci --ignore-scripts
      - run: npx breakhound . --fail-on high
```

## Segurança

O breakhound **executa o código analisado**. Rode em código confiável ou dentro de um container. Instalações a partir do npm usam `--ignore-scripts`, e cada chamada roda em um processo filho com timeout. Isso garante robustez, não é um sandbox de segurança.

## Perguntas frequentes

### Como encontrar bugs automaticamente em uma biblioteca JavaScript?

Rode `npx breakhound <pacote ou caminho>`. Ele lê os tipos, gera entradas extremas e relata chamadas que violam invariantes, sem que você escreva nenhum teste.

### Qual a diferença para property based testing?

Ferramentas como fast-check pedem que você escreva propriedades e geradores. O breakhound já traz as propriedades e deriva os geradores das assinaturas de tipo, e entrega um teste Vitest comum para cada achado.

### É seguro rodar em qualquer pacote?

Ele executa o código do pacote. Use um container para pacotes não confiáveis.

## Comparação com fast-check e Jazzer.js

São ferramentas complementares. fast-check é uma biblioteca de property based testing em que você escreve as propriedades. Jazzer.js faz fuzzing guiado por cobertura, ótimo para crashes em parsers. O breakhound faz uma varredura sem configuração focada em unicode, fusos horários e formatação de números em APIs públicas.

## Nascido de 130 correções de bugs reais

Criado por Alexandre Kohler ([kwy404](https://github.com/kwy404)), com 130 correções de bugs aceitas em projetos do Google, Microsoft, GitHub, Vue e outros:

- [github/relative-time-element#384](https://github.com/github/relative-time-element/pull/384): checagem de ano usava UTC em vez do fuso de exibição.
- [google/budoux#1411](https://github.com/google/budoux/pull/1411): pares surrogate cortados.
- [microsoft/vscode-js-debug#2423](https://github.com/microsoft/vscode-js-debug/pull/2423): pares surrogate cortados.
- [mozilla/pdf.js#22017](https://github.com/mozilla/pdf.js/pull/22017): números negativos acima de -1 perdiam o sinal.
- [vuejs/core#15618](https://github.com/vuejs/core/pull/15618)

## Mais de kwy404

- [graphemely](https://kwy404.github.io/graphemely/)
- [edgegoat](https://kwy404.github.io/edgegoat/)
- [vueleap](https://kwy404.github.io/vueleap/)
- [numberparrot](https://kwy404.github.io/numberparrot/)
- [Voodoo.js](https://github.com/kwy404/Voodoo.js)

## Licença

[MIT](https://github.com/kwy404/breakhound/blob/main/LICENSE). Copyright (c) Alexandre Kohler
