# LPA Modo Piloto — extensão do Chrome

Preenche a proposta no portal Caixa Escolar MG a partir de um pré-orçamento do LPA Service, sem copiar e colar comando.

Fluxo: no pré-orçamento, botão **Modo piloto** → a extensão acha (ou abre) a aba do portal, navega até `Compras › Orçamento`, busca o `orderId`, abre o formulário de proposta e preenche item a item, conferindo `totalValue`.

## Instalar

1. `chrome://extensions`
2. Ligar **Modo do desenvolvedor**
3. **Carregar sem compactação** → selecionar a pasta `extension/`
4. Recarregar a aba do LPA Service

O botão passa a mostrar **"Modo piloto — preencher no portal"**. Sem a extensão, o botão continua copiando `/lance-portal <id>` para o Claude in Chrome.

## O que ela preenche

- `nuValueByItem_<n>` — valor unitário já com margem
- `txItemObservation_<n>` — observações (o portal exige)
- `txWarrantyDescription_<n>` — garantia, quando o item tem o campo

E confere `totalValue_<n>` item a item antes de dizer que terminou.

## O que ela NUNCA faz

- Prazo de entrega dos bens/serviços
- Aceite `Declaro estar apto...`
- `Enviar Cotação` / `send-proposal`
- Login, senha, token, certificado ou qualquer credencial
- Fechar a aba do portal
- `alert` / `confirm` / `prompt` (dialog nativo trava automação de navegador)

Envio de lance em licitação pública é decisão do humano. O piloto para na tela preenchida e mostra: *"Falta você preencher a data de entrega, marcar o Declaro e clicar Enviar Cotação."*

## Digitação do valor

O portal real ignorou `KeyboardEvent` sintético: em 22/09/2026 os campos mostraram `R$ 0,00` após três tentativas. Teclas reais atualizaram o total imediatamente. A extensão usa a permissão `debugger` para enviar somente Backspace e dígitos à aba oficial do portal, soltando o depurador após cada campo.

O piloto só aceita o item quando `totalValue_<n>` confere com o pré-orçamento. Se o Chrome recusar a depuração, ele para e mostra o erro no painel.

`tests/pilot-background.test.ts` verifica o escopo da aba e a sequência de teclas. `tests/pilot-portal-fill.test.ts` exercita o cálculo e a conferência com um porte da máscara.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `manifest.json` | MV3. Host permission só do portal. |
| `content-app.js` | Ponte na origem do app: `window.postMessage` ↔ service worker. |
| `background.js` | Guarda o job em `storage.session` (efêmero, TTL 5 min, entrega única) e acha/abre a aba do portal. |
| `content-portal.js` | Navegação no portal, orquestração e painel de status. |
| `portal-fill.js` | Motor de preenchimento e conferência. |
| `hud.css` | Painel de status. |

## Origens do app reconhecidas

`http://localhost/*`, `http://127.0.0.1/*` e `https://lpa-service-silk.vercel.app/*`. Outro domínio precisa entrar em `content_scripts.matches` no `manifest.json`.
