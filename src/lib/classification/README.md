# Taxonomia e Classificação Determinística

SaaS Caixa Escolar MG: transforma o texto de cada processo de compra em uma categoria de fornecedor. **Determinístico primeiro, IA só como fallback.**

## Arquivos

| Arquivo | Papel |
|---|---|
| `categories.json` | Árvore de categorias (slugs, keywords, itens exemplo, prioridade). |
| `rules.json` | Regras determinísticas ORDENADAS por prioridade (regex sobre texto normalizado). |
| `expense-group-map.json` | Mapa explícito de todos os `txExpenseGroup` da fonte para uma categoria interna. |
| `classify.ts` | Função pura `classify(texto, itens?)` — ZERO dependência externa (só lê os dois JSON). |
| `classify.test.ts` | Vitest, 85 casos de linguagem real de licitação. |
| `README.md` | Guia de manutenção. |

## Cascata de classificação (ordem rígida)

1. **Regra determinística** — `rules.json`, da maior para a menor `priority`. Primeira que casar vence.
2. **Keyword** — palavras-chave das categorias (exige **2+** keywords casando, sem nenhuma negativa). Desempate por `prioridade` da categoria.
3. **Score semântico simples** — overlap de tokens entre o texto e o vocabulário da categoria (keywords + `exemplos_itens`). Exige **2+** tokens. Sem lib.
4. **`needsFallback: true`** — nada confiável; sobra para IA no futuro.

Retorno: `{ categoryId, confidence, matchedRules, needsFallback }`.

## Mapa de grupos da fonte

`expense-group-map.json` cobre todos os `txExpenseGroup` retornados por `/public/portal/filters`.
Na normalização, esse mapa roda depois de itens reais e descrição específica, e antes do fallback semântico.
Grupo novo da fonte deve ser resolvido editando um único JSON:

```json
{
  "Novo Grupo da Fonte": "categoria-interna"
}
```

Não crie regra regex para cobrir grupo de despesa novo quando o texto é exatamente um `txExpenseGroup`.
Se a fonte criar um grupo desconhecido em runtime, a normalização cai em `Outros` com `needsFallback: true`.

## Normalização automática

Aplicada em tudo antes de casar: lowercase → remove acentos → singulariza PT-BR básico (`gêneros→genero`, `toners→toner`, `pães→pao`, `televisores→televisor`) → junta em uma string.

**Regras e keywords devem ser escritas na forma SINGULAR e SEM acento** (ex.: `"pao"`, `"papel higienico"`).

## Como adicionar uma categoria NOVA (sem mexer em código)

### 1. `categories.json` — criar a categoria

Adicione um objeto no array. Siga o modelo:

```json
{
  "slug": "minha-categoria",
  "name": "Minha Categoria",
  "parent": null,
  "prioridade": 7,
  "keywords": ["item-chave", "outro-item"],
  "keywords_negativas": ["palavra-que-engana"],
  "exemplos_itens": ["item real que aparece em edital"]
}
```

- `slug`: identifica a categoria, minúsculas, sem acento, hífens no lugar de espaços.
- `parent`: slug da categoria-pai ou `null`. Use para subcategorias (ex.: `carnes` tem `parent: "alimentos"`).
- `keywords`: palavras/expressões que indicam a categoria. **Sempre no singular, sem acento.**
- `keywords_negativas`: termos que anulam o casamento por keyword (ex.: `"registro de preco"` em hidráulica).
- `exemplos_itens`: alimentam o score semântico — adicione itens reais de edital.
- `prioridade`: desempate (maior vence). `outros` fica em `1`.

### 2. `rules.json` — regras de desempate (opcional, recomendado)

Se a nova categoria precisar vencer casos ambíguos, adicione uma regra:

```json
{
  "id": "R31",
  "name": "Nome legível da regra",
  "categoryId": "minha-categoria",
  "priority": 85,
  "weight": 0.9,
  "pattern": "\\btermo\\b|\\boutra expressao\\b",
  "negacoes": ["\\btermo-conflitante\\b"]
}
```

- `priority`: quanto maior, antes roda (0–100). Regras específicas acima das genéricas.
- `weight`: `confidence` quando a regra vence.
- `pattern`: regex sobre o texto **normalizado (singular, sem acento)**. Use `\b...\b` em palavras isoladas.
- `negacoes`: se casar, a regra NÃO dispara (ex.: `"tinta para impressora"` não pode virar construção).

### 3. `classify.test.ts` — provar o comportamento

Adicione casos no `describe` adequado (regra, keyword, semântico, ambíguo ou fallback) e rode:

```bash
cd research/taxonomy
npm test
```

**Regra dura:** toda categoria nova deve ter teste cobrindo a classificação esperada.

## Guia rápido de prioridades

- 100 — consumíveis impressão, manutenção predial, suporte de informática.
- 98 — serviços elétrico/hidráulico, ar-condicionado, transporte.
- 95 — limpeza/higiene, congelados, combate a incêndio.
- 90 — carnes, informática HW, uniformes, utensílios, eletrônicos, móveis, não perecíveis, panificação, construção, elétrica, hidráulica.
- 88 — frutas/verduras/perecíveis.
- 70–80 — segurança, serviços, material de escritório.
- 60 — alimentos genéricos (merenda, gêneros alimentícios sem especificação).
