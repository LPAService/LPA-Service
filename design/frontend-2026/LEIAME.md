# Proposta de front-end 2026 — LPA Leo

Protótipo estático de proposta visual, isolado do app Next.js (`src/app` não é alterado).

## Abrir

Sem build, sem dependências. Duplo clique em `index.html` ou:

```bash
open design/frontend-2026/index.html
# ou servir local:
python3 -m http.server 4173 --directory design/frontend-2026
```

## O que demonstra

- Aurora + glass suave (fundo orgânico, não sistemático), tema claro/escuro.
- Contadores animados, revelação escalonada, ring de prazo, spotlight/tilt nos cards.
- Filtros por situação e categoria, busca, abas abertas/histórico — tudo em JS puro.
- Respeita `prefers-reduced-motion`.

## Campos alinhados ao produto

escola · cidade · prazo · itens · resumo · categoria · valor de referência · ordem (dados fictícios de demo).

## Próximo passo sugerido

Portar direção visual (tokens de cor, raio, sombra, animações) para Tailwind no `src/app`, mantendo os componentes atuais.
