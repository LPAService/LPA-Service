# Classificação em Dados Reais

Data: 2026-08-12
Branch: main

## Base classificada

- Banco: `lpa_leo`
- Oportunidades encontradas na tabela: 198
- Itens encontrados na tabela: 955
- Oportunidades esperadas na tarefa: 201
- Itens esperados na tarefa: 974
- Oportunidades atualizadas com `category_id`, `headline`, `summary`, `top_items`: 198
- Categorias semeadas: 32

## Distribuição

| Categoria | Quantidade |
|---|---:|
| nao-pereciveis | 26 |
| carnes | 23 |
| lacticinios | 16 |
| panificacao | 15 |
| limpeza-higiene | 14 |
| material-de-escritorio | 12 |
| alimentos | 10 |
| servicos | 9 |
| frutas-e-verduras | 8 |
| manutencao | 8 |
| eletronicos | 6 |
| informatica | 6 |
| moveis | 6 |
| transporte | 6 |
| construcao | 5 |
| material-pedagogico | 5 |
| utensilios | 5 |
| seguranca | 4 |
| congelados | 3 |
| projetos-pedagogicos | 3 |
| eletrica | 2 |
| hidraulica | 2 |
| impressao-toner | 2 |
| material-de-consumo-geral | 1 |
| uniformes-textil | 1 |

- Outros: 0
- `needsFallback: true`: 0
- Categorias distintas usadas: 25
- `expenseGroup` fora dos 24 mapeados: nenhum

## Casos claramente errados

Não corrigi nesta rodada.

| orderId | Saída atual | Itens principais | Escola | Cidade | Observação |
|---|---|---|---|---|---|
| 2026151597 | Construção | saco plástico | EE SAO JOSE | Passos | Item real aponta consumo geral/embalagem, não construção. |
| 2026151742 | Não Perecíveis | abóbora, alface, alho, banana prata, batata doce | EE ELOY PEREIRA | Montes Claros | Card mostra hortifruti, mas categoria ficou não perecíveis. Provável efeito de compra alimentícia mista com maioria de itens secos. |
| 2026153312 | Informática | tela mosquiteiro milimétrica | EE JUQUINHA DE ALMEIDA | Sabará | `tela` foi interpretado como sinal de informática; deveria cair em manutenção/conservação ou consumo geral. |
| 2026153702 | Móveis | furadeira e parafusadeira | EE EMILIA CERDEIRA | Belo Horizonte | Mapa de `Mobiliários Administrativos` venceu item sem regra específica; card de móveis fica errado para ferramenta elétrica. |
| 2026163375 | Transporte | rede para pratica de esportes, apitos, bomba de ar para encher bolas, cones, cordas elasticas e de sisal | EE DA FAZENDA BELA VISTA | Nepomuceno | Itens são material esportivo/pedagógico, não transporte. |
| 2026161918 | Construção | ponta para marcador de quadro branco, pasta l, capa encadernação, papel colorsete, papel crepom | EE JOSE GONCALVES DE MELO | Itaúna | Itens são papelaria/escritório, não construção. |

## Próxima rodada sugerida

- Ajustar voto por itens para compra mista de alimentos: card não deve esconder hortifruti quando os primeiros/top itens são perecíveis.
- Adicionar proteção para falsos positivos de `tela` em informática.
- Cobrir ferramentas como furadeira/parafusadeira sem depender de `expenseGroup`.
- Tratar material esportivo como subcategoria pedagógica ou mapear para material pedagógico quando os itens forem rede, apito, cones, bolas e bomba de ar.
