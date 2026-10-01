import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/export/route";
import Home from "@/app/page";
import { opportunitySource, quotationSource } from "@/lib/data/source";
import { getCurrentUserId } from "@/lib/session";
import type { NormalizedOpportunity } from "@/lib/contracts/opportunity";

vi.mock("@/lib/data/source", () => ({
  opportunitySource: { listOpportunities: vi.fn() },
  quotationSource: { listOpportunities: vi.fn() },
  sanitizePageParam: () => 1
}));
vi.mock("@/lib/session", () => ({ getCurrentUserId: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/watch", () => ({ watchStore: { listWatchedExternalIds: vi.fn(async () => []) } }));
vi.mock("@/lib/data/freshness", () => ({
  loadCollectionFreshness: vi.fn(),
  describeFreshness: () => ({ label: "coleta", value: "hoje", stale: false })
}));
vi.mock("@/components/opportunity-card", () => ({ OpportunityCard: () => null }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/notification-bell", () => ({ NotificationBell: () => null }));

function opportunity(orderId: string): NormalizedOpportunity {
  return {
    externalId: orderId, orderId, sourceUrl: "", idSubprogram: 1, idSchool: 1, idBudget: 1,
    idSupplier: null, school: "Escola", city: "Ibirité", regional: null, expenseGroup: "",
    subprogram: "", year: "", purchaseDate: null, proposalDate: null, deliveryDate: null,
    purchaseOrderStatus: null, accountabilityStatus: null, supplierName: null,
    supplierDocument: null, initiativeDescription: null, items: [], attachments: [],
    totalValue: null, itemCount: 0, category: null, headline: "", summary: "", topItems: [], rawJson: {}
  };
}
function result(orderId: string) {
  return {
    data: [opportunity(orderId)], total: 1, totalAvailable: 1, page: 1, pageSize: 48,
    totalPages: 1, facets: { cities: [], categories: [], expenseGroups: [], schools: [] }
  };
}
const request = (query = "") => new NextRequest(`http://localhost/api/export?${query}`);

describe("exportação corresponde à listagem", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue(7);
    vi.mocked(opportunitySource.listOpportunities).mockResolvedValue(result("HISTORICO"));
    vi.mocked(quotationSource.listOpportunities).mockResolvedValue(result("COTACAO"));
  });

  it.each(["", "view=open", "view=invalid", "situation=invalid", "situation=actionable"])(
    "exporta cotações abertas por padrão: %s", async (query) => {
      const response = await GET(request(query));
      expect(await response.text()).toContain("COTACAO,");
      expect(quotationSource.listOpportunities).toHaveBeenCalledWith(
        { situation: "open", userId: 7 }, { page: 1, pageSize: 48 }
      );
      expect(opportunitySource.listOpportunities).not.toHaveBeenCalled();
      expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  );

  it.each(["open", "closed", "all", "watched"])("preserva situação %s e filtros", async (situation) => {
    const filters = {
      situation, city: "Ibirité", category: "alimentos", expenseGroup: "Merenda",
      school: "Escola", periodStart: "2026-01-01", periodEnd: "2026-12-31", query: "Arroz"
    };
    const params = new URLSearchParams({ ...filters, city: " Ibirité ", userId: "999", page: "8" });
    await (await GET(request(params.toString()))).text();
    expect(quotationSource.listOpportunities).toHaveBeenCalledWith(
      { ...filters, userId: 7 }, { page: 1, pageSize: 48 }
    );
  });

  it("não usa userId forjado quando não há sessão", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    await (await GET(request("situation=watched&userId=999"))).text();
    expect(quotationSource.listOpportunities).toHaveBeenCalledWith(
      { situation: "watched", userId: undefined }, { page: 1, pageSize: 48 }
    );
  });

  it("histórico usa compras, ignora situação e exporta todas as páginas", async () => {
    vi.mocked(opportunitySource.listOpportunities)
      .mockResolvedValueOnce({ ...result("HISTORICO-1"), totalPages: 2 })
      .mockResolvedValueOnce({ ...result("HISTORICO-2"), page: 2, totalPages: 2 });
    const response = await GET(request("view=history&situation=closed&city=Ibirité&page=9"));
    const csv = await response.text();
    expect(csv).toContain("HISTORICO-1,");
    expect(csv).toContain("HISTORICO-2,");
    expect(csv).not.toContain("COTACAO");
    expect(opportunitySource.listOpportunities).toHaveBeenNthCalledWith(2,
      { city: "Ibirité", situation: undefined, userId: 7 }, { page: 2, pageSize: 48 }
    );
    expect(quotationSource.listOpportunities).not.toHaveBeenCalled();
  });

  it.each([{}, { view: "history" }, { situation: "watched" }, { situation: "closed" }, { situation: "all" }])(
    "links de exportação preservam a consulta da tela: %j", async (params) => {
      const html = renderToStaticMarkup(await Home({ searchParams: Promise.resolve({ ...params, city: "Ibirité" }) }));
      const links = [...html.matchAll(/href="(\/api\/export\?[^"]+)"/g)].map(match => match[1].replaceAll("&amp;", "&"));
      expect(links).toHaveLength(2);
      expect(links[0]).toBe(links[1]);
      const url = new URL(links[0], "http://localhost");
      expect(url.searchParams.get("view")).toBe(params.view ?? "open");
      expect(url.searchParams.has("userId")).toBe(false);
      const source = params.view === "history" ? opportunitySource : quotationSource;
      const screenFilters = vi.mocked(source.listOpportunities).mock.calls[0][0];
      await (await GET(new NextRequest(url))).text();
      expect(source.listOpportunities).toHaveBeenLastCalledWith(screenFilters, { page: 1, pageSize: 48 });
    }
  );

  it("mantém erro de formato não suportado", async () => {
    expect((await GET(request("format=xlsx"))).status).toBe(400);
    expect(quotationSource.listOpportunities).not.toHaveBeenCalled();
    expect(opportunitySource.listOpportunities).not.toHaveBeenCalled();
  });
});
