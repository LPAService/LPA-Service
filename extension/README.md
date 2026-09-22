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

## Por que dá para digitar sem teclado de verdade

O campo de valor usa a máscara de moeda do portal (ngx-currency, confirmado em `research/portal/chunk-CWW7GISC.js`). A diretiva registra host listeners de `keydown`/`keypress`/`keyup`/`paste`, e `handleKeypress` lê `event.which || event.charCode || event.keyCode` antes de chamar `addNumber()` + `onModelChange()`.

Host listener do Angular é `addEventListener` comum: dispara também com evento sintético (`isTrusted: false`). Então `KeyboardEvent('keypress')` com o charCode certo alimenta o modelo — coisa que `input.value = "6,90"` **não** faz (medido em 15/09/2026: a tela mostrava 6,90 e `totalValue` continuava `R$ 0,00`).

`tests/pilot-portal-fill.test.ts` roda o motor contra um porte fiel dessa máscara, extraído do bundle do portal.

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
