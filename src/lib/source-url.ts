export const CAIXA_ESCOLAR_API_BASE_URL =
  "https://transparencia-api.caixaescolar.educacao.mg.gov.br";

export const CAIXA_ESCOLAR_PORTAL_URL =
  "https://transparencia.caixaescolar.educacao.mg.gov.br/mg";

export type PurchaseOrderSourceKey = {
  idSubprogram: number;
  idSchool: number;
  idBudget: number;
};

export function buildPortalSourceUrl() {
  return CAIXA_ESCOLAR_PORTAL_URL;
}

export function buildPurchaseOrderDetailApiUrl(key: PurchaseOrderSourceKey) {
  const url = new URL(
    `/public/purchase-orders/by-subprogram/${key.idSubprogram}/by-school/${key.idSchool}/by-budget/${key.idBudget}/detail`,
    CAIXA_ESCOLAR_API_BASE_URL
  );
  url.searchParams.set("portalSlug", "mg");
  return url.toString();
}
