import { afterEach, describe, expect, it } from "vitest";
import {
  bestPriceProviderChain,
  parseBrazilianPrice,
  parseMercadoLivreResponse,
  parseRealdistSearchResponse,
  parseZoomSearchResponse,
  searchBestPrice
} from "@/lib/search/best-price";

describe("parseMercadoLivreResponse", () => {
  it("extrai ofertas válidas com preço e link", () => {
    const offers = parseMercadoLivreResponse({
      results: [
        {
          id: "MLB1",
          title: "Papel A4 500 folhas",
          price: 21.9,
          currency_id: "BRL",
          permalink: "https://produto.mercadolivre.com.br/MLB-1",
          thumbnail: "https://img.test/1.jpg",
          condition: "new",
          available_quantity: 10,
          seller: { nickname: "PAPELARIA X" }
        },
        {
          id: "MLB2",
          title: "Papel A4 500 folhas premium",
          price: 25.5,
          currency_id: "BRL",
          permalink: "https://produto.mercadolivre.com.br/MLB-2",
          seller: { official_store_name: "LOJA OFICIAL" }
        }
      ]
    });

    expect(offers).toHaveLength(2);
    expect(offers[0]).toEqual({
      provider: "mercadolivre",
      title: "Papel A4 500 folhas",
      price: 21.9,
      currency: "BRL",
      url: "https://produto.mercadolivre.com.br/MLB-1",
      thumbnail: "https://img.test/1.jpg",
      seller: "PAPELARIA X",
      condition: "new",
      available: 10
    });
    expect(offers[1].seller).toBe("LOJA OFICIAL");
  });

  it("descarta entradas sem título, preço ou link", () => {
    const offers = parseMercadoLivreResponse({
      results: [
        { title: "Sem preço", permalink: "https://x.test/1" },
        { title: "Sem link", price: 10 },
        { price: 10, permalink: "https://x.test/3" },
        { title: "Ok", price: 12.34, permalink: "https://x.test/4" }
      ]
    });

    expect(offers).toEqual([
      expect.objectContaining({ title: "Ok", price: 12.34, url: "https://x.test/4" })
    ]);
  });

  it("tolera payload inválido", () => {
    expect(parseMercadoLivreResponse(null)).toEqual([]);
    expect(parseMercadoLivreResponse({ results: "nope" })).toEqual([]);
    expect(parseMercadoLivreResponse("texto")).toEqual([]);
  });
});

describe("parseRealdistSearchResponse", () => {
  const item = ({
    title,
    price,
    href,
    ean = "7898616520097",
    thumbnail = "https://cdn.awsli.com.br/300x300/123/produto.jpg",
    priceClass = "preco-promocional"
  }: {
    title: string;
    price?: string;
    href: string;
    ean?: string;
    thumbnail?: string;
    priceClass?: "preco-promocional" | "preco-venda";
  }) => `
    <li class="listagem-item prod-id-10" data-id="10">
      <a href="${href}" class="nome-produto cor-secundaria">${title}</a>
      <div class="produto-sku hide">${ean}</div>
      ${
        price
          ? `<strong class="${priceClass} cor-principal titulo" data-sell-price="${price}"> R$ 99,99 </strong>`
          : ""
      }
      <img src="${thumbnail}" class="imagem-principal" />
    </li>`;

  it("extrai título, preço, URL absoluta, thumbnail e EAN", () => {
    const offers = parseRealdistSearchResponse(
      item({
        title: "Papel Sulfite A4 &amp; Carta",
        price: "42.31",
        href: "/papel-sulfite-a4"
      })
    );

    expect(offers).toHaveLength(1);
    expect(offers[0]).toEqual({
      provider: "realdist",
      title: "Papel Sulfite A4 & Carta",
      price: 42.31,
      currency: "BRL",
      url: "https://www.realdist.com.br/papel-sulfite-a4",
      thumbnail: "https://cdn.awsli.com.br/300x300/123/produto.jpg",
      seller: "Real Distribuidora",
      condition: "new",
      available: null,
      ean: "7898616520097"
    });
  });

  it("descarta template de minicart e item sem preço válido", () => {
    const html = [
      `<li class="listagem-item minicart-item-modelo">
        <a href="--PRODUTO_URL--" class="nome-produto cor-secundaria">--PRODUTO_NOME--</a>
        <strong class="preco-promocional" data-sell-price="999">--PRODUTO_PRECO_POR--</strong>
      </li>`,
      item({ title: "Sem preço", href: "/sem-preco" }),
      item({ title: "Preço zero", price: "0", href: "/preco-zero" }),
      item({ title: "Produto válido", price: "12.5", href: "https://www.realdist.com.br/produto-valido" })
    ].join("");

    const offers = parseRealdistSearchResponse(html);

    expect(offers.map((offer) => offer.title)).toEqual(["Produto válido"]);
    expect(offers[0].url).toBe("https://www.realdist.com.br/produto-valido");
  });

  it("aceita preco-venda e ordena pelo menor preço", () => {
    const html = [
      item({ title: "Produto caro", price: "30.10", href: "/caro" }),
      item({ title: "Produto barato", price: "8.99", href: "/barato", priceClass: "preco-venda" }),
      item({ title: "Produto médio", price: "15.50", href: "/medio" })
    ].join("");

    const offers = parseRealdistSearchResponse(html);

    expect(offers.map((offer) => offer.title)).toEqual(["Produto barato", "Produto médio", "Produto caro"]);
    expect(offers.map((offer) => offer.price)).toEqual([8.99, 15.5, 30.1]);
  });
});

describe("parseZoomSearchResponse", () => {
  const card = (name: string, price: string, href: string, merchant = "Via Amazon") => `
    <a class="ClickableArea_OrqProductCard_ClickableArea__jkrb3" href="${href}" data-testid="product-card::card" data-area="card">
      <div class="ProductImage_OrqProductCard_Image__xCbn_"><img src="https://i.zst.com.br/thumbs/45/2c/1f/x.jpg"/></div>
      <div class="Body_OrqProductCard_Body__mVk5s">
        <div><h2 data-testid="product-card::name" class="Name_OrqProductCard_Name__KsaTM">${name}</h2></div>
        <div>
          <div class="BestOfferMerchant_OrqProductCard_BestOfferMerchant__GByb1" aria-label="Menor preço" data-area="price"><span>${merchant}</span></div>
          <div data-testid="product-card::price" class="Price_OrqProductCard_Price__TNBZB" aria-label="Preço" data-area="price"><strong>${price}</strong></div>
        </div>
      </div>
    </a>`;

  it("extrai produto, preço, loja e link de cards do Zoom", () => {
    const html = card(
      "Chamex - Papel Sulfite, A4, 75g, 500 folhas",
      "R$ 32,99",
      "/papeis/chamex-papel-sulfite-a4?_lc=88&amp;searchterm=papel%20a4"
    );
    const offers = parseZoomSearchResponse(html);

    expect(offers).toHaveLength(1);
    expect(offers[0]).toEqual({
      provider: "zoom",
      title: "Chamex - Papel Sulfite, A4, 75g, 500 folhas",
      price: 32.99,
      currency: "BRL",
      url: "https://www.zoom.com.br/papeis/chamex-papel-sulfite-a4?_lc=88&searchterm=papel%20a4",
      thumbnail: "https://i.zst.com.br/thumbs/45/2c/1f/x.jpg",
      seller: "Via Amazon",
      condition: null,
      available: null
    });
  });

  it("ordena pelo menor preço e ignora cards sem preço", () => {
    const html = [
      card("Produto caro", "R$ 1.299,00", "/a"),
      card("Produto barato", "R$ 9,90", "/b"),
      "<a class='ClickableArea_OrqProductCard_x' href='/sem-preco' data-testid='product-card::card'><h2 data-testid='product-card::name'>Sem preço</h2></a>"
    ].join("");
    const offers = parseZoomSearchResponse(html);

    expect(offers.map((offer) => offer.title)).toEqual(["Produto barato", "Produto caro"]);
    expect(offers[0].price).toBe(9.9);
  });
});

describe("parseBrazilianPrice", () => {
  it("converte formatos brasileiros", () => {
    expect(parseBrazilianPrice("R$ 32,99")).toBe(32.99);
    expect(parseBrazilianPrice("R$ 1.299,00")).toBe(1299);
    expect(parseBrazilianPrice("R$ 9,90")).toBe(9.9);
    expect(parseBrazilianPrice("invalido")).toBeNull();
  });
});

describe("searchBestPrice", () => {
  const original = process.env.WEB_SEARCH_PROVIDER;
  afterEach(() => {
    if (original === undefined) delete process.env.WEB_SEARCH_PROVIDER;
    else process.env.WEB_SEARCH_PROVIDER = original;
  });

  it("rejeita termo vazio sem rede", async () => {
    const result = await searchBestPrice("   ");

    expect(result.offers).toEqual([]);
    expect(result.error).toBe("Termo de busca vazio.");
  });

  it("reporta desativação quando WEB_SEARCH_PROVIDER=none", async () => {
    process.env.WEB_SEARCH_PROVIDER = "none";
    const result = await searchBestPrice("papel a4");

    expect(result.provider).toBe("none");
    expect(result.offers).toEqual([]);
    expect(result.error).toContain("desativada");
  });

  it("limita quantidade de ofertas ao teto de 10", async () => {
    process.env.WEB_SEARCH_PROVIDER = "none";
    const result = await searchBestPrice("papel a4", 999);

    expect(result.query).toBe("papel a4");
    expect(result.offers).toEqual([]);
  });
});

describe("bestPriceProviderChain", () => {
  const original = process.env.WEB_SEARCH_PROVIDER;
  afterEach(() => {
    if (original === undefined) delete process.env.WEB_SEARCH_PROVIDER;
    else process.env.WEB_SEARCH_PROVIDER = original;
  });

  it("usa Real Distribuidora antes dos provedores gerais no modo auto", () => {
    delete process.env.WEB_SEARCH_PROVIDER;
    expect(bestPriceProviderChain().map((provider) => provider.name)).toEqual([
      "realdist",
      "mercadolivre",
      "zoom"
    ]);

    process.env.WEB_SEARCH_PROVIDER = "auto";
    expect(bestPriceProviderChain().map((provider) => provider.name)).toEqual([
      "realdist",
      "mercadolivre",
      "zoom"
    ]);
  });

  it("aceita Real Distribuidora como provider único nomeado", () => {
    process.env.WEB_SEARCH_PROVIDER = "realdist";
    expect(bestPriceProviderChain().map((provider) => provider.name)).toEqual(["realdist"]);
  });
});
