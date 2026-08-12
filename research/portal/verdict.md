API-first é viável? SIM.

Há API pública dedicada em `transparencia-api.caixaescolar.educacao.mg.gov.br` para listagem, filtros, detalhe, itens e metadata de anexos, sem autenticação.
Paginação e totais são nativos (`page`, `pageSize`, `meta.total`, `meta.totalPages`).
Não construir scraper HTML: usar endpoints públicos do frontend de transparência.
Ponto pendente: download efetivo de anexos; metadata existe, mas URL de arquivo retornou vazio/404 nos testes.
